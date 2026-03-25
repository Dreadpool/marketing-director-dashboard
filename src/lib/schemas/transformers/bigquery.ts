import type { BigQueryPeriodSummary } from "../sources/bigquery";
import type { DateRange } from "../types";
import type {
  NormalizedConversions,
  NormalizedRevenue,
  NormalizedCustomers,
  RevenueOverview,
} from "../metrics";
import { createProvenance } from "../utils";

export function normalizeBigQueryData(
  summary: BigQueryPeriodSummary,
  dateRange: DateRange,
): {
  revenue: RevenueOverview;
  conversions: NormalizedConversions;
  customers: NormalizedCustomers;
} {
  const provenance = createProvenance("bigquery", dateRange, {
    isGroundTruth: true,
    notes: [
      "Revenue from vw_sle_active_orders",
      "Emails normalized LOWER(TRIM())",
      "Filtered to selling_company = Salt Lake Express",
    ],
  });

  const actualRevenue: NormalizedRevenue = {
    source: "bigquery",
    amount: summary.total_revenue,
    attributionWindow: "none",
    isGroundTruth: true,
    provenance,
  };

  const revenue: RevenueOverview = {
    actual: actualRevenue,
    platformAttributed: [],
    totalOrders: summary.total_orders,
    avgOrderValue: summary.avg_order_value,
    revenuePerCustomer:
      summary.unique_customers > 0
        ? summary.total_revenue / summary.unique_customers
        : 0,
  };

  const conversions: NormalizedConversions = {
    source: "bigquery",
    count: summary.total_orders,
    attributionWindow: "none",
    isGroundTruth: true,
    label: "Actual Orders (BigQuery)",
    provenance,
  };

  const customers: NormalizedCustomers = {
    total: summary.unique_customers,
    new: summary.new_customers,
    returning: summary.returning_customers,
    newRevenue: summary.new_customer_revenue,
    returningRevenue: summary.returning_customer_revenue,
    newAvgRevenue:
      summary.new_customers > 0
        ? summary.new_customer_revenue / summary.new_customers
        : 0,
    returningAvgRevenue:
      summary.returning_customers > 0
        ? summary.returning_customer_revenue / summary.returning_customers
        : 0,
    provenance,
  };

  return { revenue, conversions, customers };
}
