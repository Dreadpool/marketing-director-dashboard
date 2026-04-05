/**
 * SeoRankingMetrics: Return type of the SEO Ranking Analysis fetch executor.
 * Analogous to MetaAdsMetrics for meta-ads-analysis.
 */

export type SeoRankingPeriod = {
  year: number;
  month: string;
  month_num: number;
  date_range: { start: string; end: string };
};

export type SeoAggregateChange = {
  transition: string;
  change: number;
  keywords_measured: number;
};

export type SeoVisibilityScore = {
  month: string;
  score: number;
  keywords_tracked: number;
};

export type SeoTierDistribution = {
  month: string;
  first_place: number;
  top_3: number;
  top_5: number;
  top_10: number;
  below_10: number;
};

export type SeoMover = {
  keyword: string;
  start_rank: number;
  end_rank: number;
  change: number;
};

export type SeoKeywordRow = {
  keyword: string;
  ranks: Record<string, number | null>;
};

export type SeoSiteData = {
  site_key: string;
  site_name: string;
  keyword_count: number;
  months: string[];
  aggregate_change: SeoAggregateChange[];
  net_change: number;
  visibility: SeoVisibilityScore[];
  visibility_change_pct: number | null;
  tiers: SeoTierDistribution[];
  movers: { improved: SeoMover[]; declined: SeoMover[] };
  keywords: SeoKeywordRow[];
};

export type StrikingDistanceOpportunity = {
  query: string;
  page: string;
  position: number;
  impressions: number;
  current_clicks: number;
  estimated_clicks_at_3: number;
  traffic_gain: number;
};

export type CtrGapOpportunity = {
  query: string;
  page: string;
  position: number;
  impressions: number;
  actual_ctr: number;
  benchmark_ctr: number;
  ctr_gap: number;
  missed_clicks: number;
};

export type GscQuickWins = {
  site_key: string;
  site_name: string;
  total_queries: number;
  total_impressions: number;
  total_clicks: number;
  striking_distance: StrikingDistanceOpportunity[];
  ctr_gaps: CtrGapOpportunity[];
};

export type SeoSourceDetail = {
  displayName: string;
  status: "ok" | "warning" | "error";
  message?: string;
};

export type SeoRankingMetrics = {
  period: SeoRankingPeriod;
  sites: SeoSiteData[];
  gsc_quick_wins: GscQuickWins[];
  metadata: {
    generated_at: string;
    loaded_sources: string[];
    missing_sources: string[];
    source_details: Record<string, SeoSourceDetail>;
  };
};
