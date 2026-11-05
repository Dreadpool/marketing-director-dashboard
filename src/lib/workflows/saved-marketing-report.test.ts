import { describe, expect, it } from "vitest";
import { savedMarketingReport } from "./saved-marketing-report";

describe("historical marketing reports", () => {
  it("preserves saved counts while withholding company sales and customer-level records", () => {
    const report = savedMarketingReport("monthly-analytics-review", {
      current_month: {
        revenue: { net_bookings: 999, total_orders: 7, unique_customers: 5 },
        customers: { new_customers: 1 },
        top_customers: { top_10_list: [{ email: "private@example.com" }] },
        marketing: { ad_spend: 0, cac: 0 },
      },
      metadata: { missing_sources: ["quickbooks_gl"] },
    });
    expect(report).toMatchObject({
      current: {
        orders: 7,
        purchasers: 5,
        newPurchasers: 1,
        adSpend: null,
        costPerNewPurchaser: null,
      },
    });
    expect(JSON.stringify(report)).not.toMatch(
      /999|private@example|net_bookings/,
    );
  });

  it("preserves promo counts and cost per purchaser without exposing old nested sales values", () => {
    const report = savedMarketingReport("promo-code-analysis", {
      promoCode: "TEST",
      totalOrders: 3,
      grossRevenue: 999,
      baselineAov: 50,
      roi: { revenueReturn: 2, spendPerFirstPurchaser: 5 },
      topRoutes: [{ route: "A", orders: 3, revenue: 600 }],
    });
    expect(report).toMatchObject({
      totalOrders: 3,
      spendPerFirstPurchaser: 5,
      topRoutes: [{ route: "A", orders: 3 }],
    });
    expect(JSON.stringify(report)).not.toMatch(
      /revenue|grossRevenue|baselineAov/,
    );
  });
});
