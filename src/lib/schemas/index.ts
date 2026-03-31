// Foundation types
export type {
  DateRange,
  MonthPeriod,
  Currency,
  AttributionWindow,
  DataSource,
  ComparisonDirection,
  DataProvenance,
  MetricComparison,
} from "./types";

// Source-specific raw types
export type { MetaAdsInsightRow, MetaAdsAction, MetaAdsActionValue } from "./sources/meta-ads";
export type { GoogleAdsCampaignRow } from "./sources/google-ads";
export type { BigQueryRevenueRow, BigQueryCustomerRow, BigQueryPeriodSummary } from "./sources/bigquery";
export type { GA4TrafficRow, GA4EcommerceRow } from "./sources/ga4";
export type { SheetsSEORankingRow } from "./sources/google-sheets";
export type { MasterMetrics } from "./sources/monthly-analytics";

// Normalized metric interfaces
export type {
  NormalizedAdSpend,
  NormalizedAdPerformance,
  NormalizedConversions,
  NormalizedRevenue,
  RevenueOverview,
  NormalizedCustomers,
  NormalizedCPA,
  NormalizedCAC,
  NormalizedROAS,
  NormalizedTraffic,
  NormalizedSEO,
  NormalizedPromotions,
  MonthlyComparison,
} from "./metrics";

// Dashboard aggregate type
export type { DashboardMetrics } from "./dashboard";

// Utilities
export {
  microsToUSD,
  normalizeEmail,
  percentChange,
  formatUSD,
  createProvenance,
} from "./utils";
