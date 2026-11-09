import { describe, expect, it } from "vitest";
import { savedMarketingReport } from "./saved-marketing-report";

describe("historical reporting boundaries", () => {
  it.each(["monthly-analytics-review", "promo-code-analysis"])("withholds %s without mutating its stored snapshot", slug => {
    const snapshot = { totalOrders: 3, current: { orders: 7 }, private: "retained" };
    expect(savedMarketingReport(slug, snapshot)).toBeNull();
    expect(snapshot).toEqual({ totalOrders: 3, current: { orders: 7 }, private: "retained" });
  });
  it("retains Google platform metrics while removing historical TDS comparisons", () => {
    const platform = { total_spend: 123, total_conversions: 8 };
    const snapshot = { account_health: platform, campaigns: [], trends: {},
      ground_truth: { bigquery_bookings: 999 }, unexpectedLegacyReport: { orders: 999 },
      metadata: { generated_at: "2026-10-01", loaded_sources: ["google_ads_current", "bigquery_sales"],
        missing_sources: ["bigquery_sales"], source_details: { google_ads_current: { status: "ok" }, bigquery_sales: { message: "999 bookings" } } } };
    const result = savedMarketingReport("google-ads-analysis", snapshot);
    expect(result).toMatchObject({ account_health: platform, metadata: { loaded_sources: ["google_ads_current"], missing_sources: [] } });
    expect(JSON.stringify(result)).not.toMatch(/999|ground_truth|bigquery_sales|unexpectedLegacyReport/);
    expect(snapshot.ground_truth.bigquery_bookings).toBe(999);
  });
});
