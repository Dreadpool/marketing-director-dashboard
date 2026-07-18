import { describe, expect, it } from "vitest";

import { buildExploreQuery } from "./bigquery-interview-segment";

describe("customer interview segment query", () => {
  it("builds customer history from normalized real SLE bookings", () => {
    const query = buildExploreQuery({ customer_segment: "first_timer" });

    expect(query).toContain("vw_sle_active_orders");
    expect(query).toContain("selling_company = 'Salt Lake Express'");
    expect(query).toContain("is_paid_in = FALSE");
    expect(query).toContain("is_fee_only_cancellation = FALSE");
    expect(query).toContain("COUNT(DISTINCT order_id) = 1");
    expect(query).toContain("GROUP BY LOWER(TRIM(purchaser_email))");
    expect(query).not.toContain("FROM `test-project.tds_sales.sales_orders`");
  });
});
