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
  };
};
