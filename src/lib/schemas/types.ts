/** ISO YYYY-MM-DD date range */
export type DateRange = { start: string; end: string };

export type MonthPeriod = { year: number; month: number };

export type Currency = "USD";

export type AttributionWindow =
  | "1d_click"
  | "7d_click"
  | "28d_click"
  | "1d_view"
  | "7d_view"
  | "none";

export type DataSource =
  | "meta_ads"
  | "google_ads"
  | "bigquery"
  | "ga4"
  | "quickbooks_gl"
  | "google_sheets"
  | "monthly_analytics";

export type ComparisonDirection = "mom" | "yoy";

export type DataProvenance = {
  source: DataSource;
  fetchedAt: string;
  dateRange: DateRange;
  attributionWindow?: AttributionWindow;
  currency: Currency;
  notes?: string[];
  /** true only for BigQuery */
  isGroundTruth: boolean;
};

export type MetricComparison = {
  direction: ComparisonDirection;
  currentValue: number;
  previousValue: number;
  absoluteChange: number;
  /** Decimal: 0.10 = 10% */
  percentChange: number;
  previousPeriod: DateRange;
};
