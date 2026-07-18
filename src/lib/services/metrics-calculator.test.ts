import { describe, expect, it } from "vitest";
import type { SalesOrderRow } from "./bigquery-sales";
import {
  calculateCAC,
  calculateCustomerSegmentation,
  calculateRevenueBreakdown,
  calculateTopCustomers,
} from "./metrics-calculator";
import { calculateRevenueVariance } from "@/lib/workflows/executors/fetch-monthly-analytics";

function row(overrides: Partial<SalesOrderRow>): SalesOrderRow {
  return {
    order_id: 1,
    purchase_date: "2026-07-01",
    purchaser_email: "customer@example.com",
    purchaser_first_name: "Test",
    purchaser_last_name: "Customer",
    total_sale: 100,
    amount_discounted: 0,
    promotion_code: null,
    payment_type_1: "Visa",
    payment_amount_1: 100,
    payment_type_2: null,
    payment_amount_2: 0,
    payment_type_3: null,
    payment_amount_3: 0,
    payment_type_4: null,
    payment_amount_4: 0,
    trip_origin_stop: "Salt Lake City",
    trip_destination_stop: "St George",
    previous_order: null,
    revenue_after_cancellations: 100,
    total_canceled_amount: 0,
    num_cancel_records: 0,
    is_paid_in: false,
    is_fee_only_cancellation: false,
    ...overrides,
  };
}

describe("Monthly analytics sales metrics", () => {
  const rows: SalesOrderRow[] = [
    row({
      order_id: 1,
      purchaser_email: "new@example.com",
      total_sale: 100,
      payment_amount_1: 100,
      revenue_after_cancellations: 100,
    }),
    row({
      order_id: 2,
      purchaser_email: "paid-in@example.com",
      total_sale: 20,
      payment_amount_1: 20,
      revenue_after_cancellations: 20,
      trip_origin_stop: null,
      trip_destination_stop: null,
      is_paid_in: true,
    }),
    row({
      order_id: 3,
      purchaser_email: "fee-only@example.com",
      total_sale: 100,
      payment_amount_1: 100,
      revenue_after_cancellations: 6,
      total_canceled_amount: 94,
      num_cancel_records: 2,
      is_fee_only_cancellation: true,
    }),
    row({
      order_id: 4,
      purchaser_email: "returning@example.com",
      total_sale: 50,
      payment_type_1: "Cash",
      payment_amount_1: 50,
      revenue_after_cancellations: 50,
    }),
    row({
      order_id: 5,
      purchaser_email: "new@example.com",
      total_sale: 30,
      payment_amount_1: 30,
      revenue_after_cancellations: 30,
    }),
    row({
      order_id: 6,
      purchaser_email: "fully-canceled@example.com",
      total_sale: 100,
      payment_amount_1: 100,
      revenue_after_cancellations: 0,
      total_canceled_amount: 100,
      num_cancel_records: 1,
      is_fee_only_cancellation: true,
    }),
  ];

  it("retains paid-in and fee-only revenue while excluding them from order and customer denominators", () => {
    const revenue = calculateRevenueBreakdown(rows, null);

    expect(revenue.gross_bookings).toBe(400);
    expect(revenue.net_bookings).toBe(206);
    expect(revenue.total_cancels).toBe(194);
    expect(revenue.total_orders).toBe(3);
    expect(revenue.unique_customers).toBe(2);
    expect(revenue.avg_order_value).toBe(60);
    expect(revenue.revenue_per_customer).toBe(90);
    expect(revenue.orders_per_customer).toBe(1.5);
  });

  it("segments only countable booking customers and uses net revenue", () => {
    const customers = calculateCustomerSegmentation(
      rows,
      new Map([
        ["new@example.com", "2026-07-01"],
        ["returning@example.com", "2026-01-15"],
        ["paid-in@example.com", "2026-07-02"],
        ["fee-only@example.com", "2026-07-03"],
      ]),
      { year: 2026, month: 7 },
    );

    expect(customers.new_customers + customers.returning_customers).toBe(2);
    expect(customers.new_customers).toBe(1);
    expect(customers.returning_customers).toBe(1);
    expect(customers.new_customer_orders).toBe(2);
    expect(customers.returning_customer_orders).toBe(1);
    expect(customers.new_customer_revenue).toBe(130);
    expect(customers.returning_customer_revenue).toBe(50);
  });

  it("excludes paid-in and fee-only rows from top-customer membership", () => {
    const topCustomers = calculateTopCustomers(rows);
    const emails = topCustomers.top_10_list.map((customer) => customer.email);

    expect(emails).toEqual(["new@example.com", "returning@example.com"]);
    expect(topCustomers.top_10_list[0]).toMatchObject({
      email: "new@example.com",
      revenue: 130,
      orders: 2,
    });
  });

  it("does not let a fee-only replacement remove the original booking from denominators", () => {
    const revenue = calculateRevenueBreakdown([
      row({
        order_id: 20,
        purchaser_email: "original@example.com",
        total_sale: 80,
        payment_amount_1: 80,
        revenue_after_cancellations: 80,
      }),
      row({
        order_id: 21,
        purchaser_email: "replacement@example.com",
        previous_order: 20,
        total_sale: 80,
        payment_amount_1: 80,
        revenue_after_cancellations: 6,
        total_canceled_amount: 74,
        num_cancel_records: 1,
        is_fee_only_cancellation: true,
      }),
    ], null);

    expect(revenue.total_orders).toBe(1);
    expect(revenue.unique_customers).toBe(1);
    expect(revenue.avg_order_value).toBe(80);
  });

  it("compares payment slots to gross total_sale for revenue variance", () => {
    const variance = calculateRevenueVariance([
      row({
        order_id: 10,
        total_sale: 100,
        payment_amount_1: 100,
        revenue_after_cancellations: 60,
        total_canceled_amount: 40,
      }),
    ]);

    expect(variance).toBe(0);
  });
});

describe("Monthly marketing efficiency", () => {
  it("reports spend per first purchaser without retired profit estimates", () => {
    const result = calculateCAC({
      newCustomers: 10,
      adSpend: 1_000,
      adSpendCategories: { targeted: 1_000 },
      transactionCount: 2,
      avgCustomerValue: 75,
      avgCustomerValueSource: "tds_sales_orders",
    });

    expect(result.cac).toBe(100);
    expect(result).not.toHaveProperty("avg_customer_gross_profit");
    expect(result).not.toHaveProperty("cac_to_value_ratio");
  });
});
