import type { MonthPeriod, DateRange, DataProvenance } from "./types";
import type {
  RevenueOverview,
  NormalizedCustomers,
  NormalizedAdSpend,
  NormalizedCAC,
  NormalizedCPA,
  NormalizedROAS,
  NormalizedTraffic,
  NormalizedSEO,
  NormalizedAdPerformance,
  NormalizedConversions,
  NormalizedPromotions,
  MonthlyComparison,
} from "./metrics";

/** Single type the dashboard page consumes */
export type DashboardMetrics = {
  period: MonthPeriod;
  dateRange: DateRange;
  /** Maps to "Revenue" card */
  revenue: RevenueOverview;
  /** Maps to "New Customers" card */
  customers: NormalizedCustomers;
  /** Maps to "Ad Spend" card */
  adSpend: NormalizedAdSpend;
  /** Maps to "ROAS" card */
  efficiency: {
    cac: NormalizedCAC;
    cpa: NormalizedCPA[];
    roas: NormalizedROAS[];
  };
  traffic?: NormalizedTraffic;
  seo?: NormalizedSEO[];
  adPerformance?: NormalizedAdPerformance[];
  conversions: NormalizedConversions[];
  promotions?: NormalizedPromotions;
  comparisons?: {
    mom?: MonthlyComparison;
    yoy?: MonthlyComparison;
  };
  sources: DataProvenance[];
  lastUpdated: string;
};
