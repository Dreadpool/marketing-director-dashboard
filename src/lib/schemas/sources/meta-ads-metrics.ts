/**
 * MetaAdsMetrics: Return type of the Meta Ads Analysis fetch executor.
 * Analogous to MasterMetrics for monthly-analytics-review.
 */

export type MetaAdsPeriod = {
  year: number;
  month: string;
  month_num: number;
  date_range: { start: string; end: string };
};

export type MetaAdsAccountHealth = {
  total_spend: number;
  total_purchases: number;
  total_attributed_revenue: number;
  cpa: number;
  roas: number;
  cpm: number;
  ctr: number;
  total_impressions: number;
  total_clicks: number;
  total_reach: number;
  avg_frequency: number;
  /** CTC assessment: <$9 on-target, <$14 elevated, >$14 high. Based on $35.23 GP/order, 43% margin, 1.3x over-attribution. */
  cpa_status: "on-target" | "elevated" | "high";
  /** CTC assessment: >3.0x above GP breakeven, else below. ROAS is secondary to CPA. */
  roas_status: "above-target" | "below-target";
};

export type MetaAdsCampaignRow = {
  campaign_id: string;
  campaign_name: string;
  objective: string;
  status: string;
  funnel_stage: "tof" | "retargeting" | "other";
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  frequency: number;
  cpm: number;
  ctr: number;
  purchases: number;
  attributed_revenue: number;
  cpa: number;
  roas: number;
  mom?: MomDelta;
};

export type AdHealthStatus =
  | "healthy" // On target, leave running
  | "learning" // Not enough data to judge
  | "watch" // One signal off, monitor
  | "underperforming" // Losing money
  | "kill"; // Clear kill criteria met

export type AdHealthClassification = {
  status: AdHealthStatus;
  reason: string; // Why this classification
  action: string; // What to do (prescribed, unambiguous)
  signals: string[]; // Contributing signals
};

export type MomDelta = {
  spend_pct: number | null;
  cpa_pct: number | null;
  roas_pct: number | null;
  purchases_pct: number | null;
};

export type AdSetHealthStatus =
  | "healthy"
  | "learning"
  | "watch"
  | "underperforming"
  | "kill";

export type AdSetHealthClassification = {
  status: AdSetHealthStatus;
  reason: string;
  action: string;
  signals: string[];
};

// ─── Ad Set Flags (replaces health classification for new runs) ──────────────

export type AdSetFlagType = "ctr_below_peers" | "cpa_increasing";

export type AdSetFlag = {
  type: AdSetFlagType;
  detail: string;
};

export type MetaAdsAdSetRow = {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  frequency: number;
  purchases: number;
  attributed_revenue: number;
  cpa: number;
  roas: number;
  health?: AdSetHealthClassification;
  flags?: AdSetFlag[];
  mom?: MomDelta;
};

export type MetaAdsAdRow = {
  ad_id: string;
  ad_name: string;
  adset_id: string;
  campaign_id: string;
  campaign_name: string;
  adset_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  cpa: number;
  roas: number;
  /** Hook rate: video 3s views / impressions. Null if not a video ad. */
  hook_rate: number | null;
  /** Hold rate: thruplay / 3s views. Null if not a video ad. */
  hold_rate: number | null;
  video_3s_views: number;
  video_thruplay: number;
  /** Full-size creative image URL from Meta CDN. Null for video-only ads. */
  image_url?: string | null;
  /** Small thumbnail URL (64x64) from Meta CDN. Available for all ad types. */
  thumbnail_url?: string | null;
  health?: AdHealthClassification;
};

export type MetaAdsBreakdownRow = {
  dimension: string;
  value: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  attributed_revenue: number;
  cpa: number;
  roas: number;
  /** Segment CPA / account CPA. <1.0 = more efficient than average. */
  efficiency_index: number;
};

export type MetaAdsFatigueSignal = {
  ad_id: string;
  ad_name: string;
  signal_type: "high_frequency" | "rising_cpm" | "declining_ctr";
  current_value: number;
  threshold: number;
};

// ─── Daily trend types (Phase 2: on-demand ad-set drill-in) ─────────────────

export type DailyPoint = {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  cpa: number;
  ctr: number; // Ratio (clicks/impressions), e.g. 0.012 for 1.2%
};

export type TrendDirection = "rising" | "flat" | "declining";

export type TrendSummary = {
  ctr_direction: TrendDirection;
  cpa_direction: TrendDirection;
  /** Percent change of latest 7d vs previous 7d. null if insufficient data. */
  ctr_7d_change_pct: number | null;
  cpa_7d_change_pct: number | null;
  /** Highest CTR observed in the period (as ratio) */
  peak_ctr: number;
  /** Most recent CTR (last 3-day avg for smoothing) */
  current_ctr: number;
  lifecycle_stage:
    | "learning"
    | "performing"
    | "fatiguing"
    | "dead"
    | "born_bad";
};

export type AdDailyTrend = {
  ad_id: string;
  ad_name: string;
  daily: DailyPoint[];
  trend: TrendSummary;
  revised_health: AdHealthClassification;
};

export type AdSetDailyTrendResponse = {
  adset_id: string;
  ads: AdDailyTrend[];
};

export type MetaAdsSourceDetail = {
  displayName: string;
  status: "ok" | "warning" | "error";
  message?: string;
};

export type MetaAdsMetrics = {
  period: MetaAdsPeriod;
  /** Account health computed from acquisition campaigns only (excludes hiring) */
  account_health: MetaAdsAccountHealth;
  /** Acquisition campaigns only (TOF + retargeting) */
  campaigns: MetaAdsCampaignRow[];
  /** Hiring/driver recruitment campaigns, reported separately */
  hiring_campaigns: MetaAdsCampaignRow[];
  ads: MetaAdsAdRow[];
  adsets: MetaAdsAdSetRow[];

  audience: {
    age_gender: MetaAdsBreakdownRow[];
    geo: MetaAdsBreakdownRow[];
    device: MetaAdsBreakdownRow[];
    platform: MetaAdsBreakdownRow[];
  };

  signals: {
    fatigued_ads: MetaAdsFatigueSignal[];
    top_campaigns_spend_pct: number;
    tof_campaigns: string[];
    retargeting_campaigns: string[];
  };

  metadata: {
    generated_at: string;
    loaded_sources: string[];
    missing_sources: string[];
    source_details: Record<string, MetaAdsSourceDetail>;
    executor_version?: string;
  };
};
