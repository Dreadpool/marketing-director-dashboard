import type {
  DataSource,
  AttributionWindow,
  DataProvenance,
  MetricComparison,
  DateRange,
} from "./types";

export type NormalizedAdSpend = {
  total: number;
  byPlatform: {
    source: DataSource;
    amount: number;
    /** Breakdown by campaign or category */
    breakdown?: Record<string, number>;
  }[];
  provenance: DataProvenance[];
  comparison?: MetricComparison;
};

export type NormalizedAdPerformance = {
  source: DataSource;
  campaignName: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  provenance: DataProvenance;
};

export type NormalizedConversions = {
  source: DataSource;
  count: number;
  attributionWindow: AttributionWindow;
  /** true only for BigQuery */
  isGroundTruth: boolean;
  label: string;
  provenance: DataProvenance;
};

export type NormalizedRevenue = {
  source: DataSource;
  amount: number;
  attributionWindow: AttributionWindow;
  isGroundTruth: boolean;
  provenance: DataProvenance;
};

export type RevenueOverview = {
  /** BigQuery ground truth revenue */
  actual: NormalizedRevenue;
  /** Platform-attributed revenue from Meta, Google, GA4 */
  platformAttributed: NormalizedRevenue[];
  totalOrders: number;
  avgOrderValue: number;
  revenuePerCustomer: number;
  comparison?: MetricComparison;
};

export type NormalizedCustomers = {
  total: number;
  new: number;
  returning: number;
  newRevenue: number;
  returningRevenue: number;
  newAvgRevenue: number;
  returningAvgRevenue: number;
  provenance: DataProvenance;
  comparison?: MetricComparison;
};

/** Platform-level cost per acquisition: platform spend / platform conversions */
export type NormalizedCPA = {
  source: DataSource;
  value: number;
  spend: number;
  conversions: number;
  attributionWindow: AttributionWindow;
  provenance: DataProvenance;
};

/** True customer acquisition cost: total spend / BigQuery new customers */
export type NormalizedCAC = {
  value: number;
  totalSpend: number;
  newCustomers: number;
  paybackRatio: number;
  provenance: DataProvenance[];
  comparison?: MetricComparison;
};

export type NormalizedROAS = {
  source: DataSource;
  value: number;
  revenue: number;
  spend: number;
  attributionWindow: AttributionWindow;
  provenance: DataProvenance;
};

export type NormalizedTraffic = {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  /** 0-1 scale */
  bounceRate: number;
  avgSessionDuration: number;
  byChannel: {
    channel: string;
    sessions: number;
    users: number;
    bounceRate: number;
  }[];
  provenance: DataProvenance;
  comparison?: MetricComparison;
};

export type NormalizedSEO = {
  site: string;
  keyword: string;
  rank: number | null;
  previousRank: number | null;
  change: number | null;
  dateRange: DateRange;
  provenance: DataProvenance;
};

export type NormalizedPromotions = {
  totalOrders: number;
  promoOrders: number;
  promoPercentage: number;
  totalDiscountAmount: number;
  avgDiscountPerPromo: number;
  revenueWithPromo: number;
  revenueWithoutPromo: number;
  aovWithPromo: number;
  aovWithoutPromo: number;
  topCodes: {
    code: string;
    uses: number;
    revenue: number;
    discount: number;
    uniqueCustomers: number;
  }[];
  provenance: DataProvenance;
};

export type MonthlyComparison = {
  revenue: MetricComparison;
  customers: MetricComparison;
  orders: MetricComparison;
  adSpend?: MetricComparison;
  cac?: MetricComparison;
};
