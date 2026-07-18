import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("./bigquery-client", () => ({
  getBigQueryClient: () => ({ query: queryMock }),
  PROJECT_ID: "test-project",
}));

import { getCustomerSegmentation, getMonthlyRevenueSummary } from "./bigquery";

describe("dashboard BigQuery metrics", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("keeps retained fees in revenue but excludes non-bookings from counts and AOV", async () => {
    queryMock.mockResolvedValueOnce([[
      {
        total_revenue: 106,
        total_orders: 2,
        unique_customers: 2,
        countable_order_revenue: 100,
      },
    ]]);

    const result = await getMonthlyRevenueSummary({ year: 2026, month: 7 });
    const query = String(queryMock.mock.calls[0][0].query);

    expect(result).toEqual({
      totalRevenue: 106,
      totalOrders: 2,
      uniqueCustomers: 2,
      avgOrderValue: 50,
    });
    expect(query).toContain("selling_company = 'Salt Lake Express'");
    expect(query).toContain("is_paid_in = FALSE AND is_fee_only_cancellation = FALSE");
    expect(query).toContain("countable_order_revenue");
  });

  it("classifies customers from real bookings and the canonical first-purchase view", async () => {
    queryMock.mockResolvedValueOnce([[
      {
        new_customers: 3,
        returning_customers: 7,
        new_customer_revenue: 120,
        returning_customer_revenue: 280,
      },
    ]]);

    const result = await getCustomerSegmentation({ year: 2026, month: 7 });
    const query = String(queryMock.mock.calls[0][0].query);

    expect(result.newCustomers + result.returningCustomers).toBe(10);
    expect(query).toContain("customer_first_order");
    expect(query).toContain("o.is_paid_in = FALSE");
    expect(query).toContain("o.is_fee_only_cancellation = FALSE");
    expect(query).toContain("o.purchaser_email IS NOT NULL");
    expect(query).toContain("TRIM(o.purchaser_email) != ''");
  });
});
