/**
 * GoogleAdsMetrics: Return type of the Google Ads Analysis fetch executor.
 * Decision framework: Vallaeys (Stars/Zombies/Bleeders) + Geddes (QS) + Impression Share.
 * Spec: docs/superpowers/specs/2026-03-31-google-ads-decision-framework.md
 */

export type GoogleAdsPeriod = {
  year: number;
  month: string;
  month_num: number;
  date_range: { start: string; end: string };
};

export type CampaignSegment = "brand" | "non-brand" | "competitor" | "pmax" | "video" | "other";

export type CpaStatus = "on-target" | "elevated" | "high";
export type RoasStatus = "above-target" | "watch" | "below-target";

export type GoogleAdsSegmentHealth = {
  segment: CampaignSegment;
  total_spend: number;
  total_clicks: number;
  total_impressions: number;
  total_conversions: number;
  total_conversions_value: number;
  cpa: number;
  roas: number;
  ctr: number;
  avg_cpc: number;
  cpa_status: CpaStatus;
  roas_status: RoasStatus;
  campaign_count: number;
};

export type GoogleAdsAccountHealth = {
  total_spend: number;
  total_clicks: number;
  total_impressions: number;
  total_conversions: number;
  total_conversions_value: number;
  cpa: number;
  roas: number;
  ctr: number;
  avg_cpc: number;
  cpa_status: CpaStatus;
  roas_status: RoasStatus;
  segments: GoogleAdsSegmentHealth[];
};

export type GoogleAdsCampaignMetrics = {
  campaign_id: string;
  campaign_name: string;
  status: string;
  segment: CampaignSegment;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversions_value: number;
  cpa: number;
  roas: number;
  ctr: number;
  avg_cpc: number;
};

export type GoogleAdsGroundTruth = {
  bigquery_bookings: number;
  google_ads_conversions: number;
  attribution_ratio: number;
  divergence_flag: boolean;
};

export type GoogleAdsTrend = {
  current: number;
  prior_month: number;
  prior_year: number | null;
  mom_change: number;
  yoy_change: number | null;
};

export type GoogleAdsSegmentTrend = {
  segment: CampaignSegment;
  cpa: GoogleAdsTrend;
  avg_cpc: GoogleAdsTrend;
  cvr: GoogleAdsTrend;
  conversions: GoogleAdsTrend;
};

export type GoogleAdsSourceDetail = {
  displayName: string;
  status: "ok" | "warning" | "error";
  message?: string;
};

export type GoogleAdsMetrics = {
  period: GoogleAdsPeriod;
  account_health: GoogleAdsAccountHealth;
  campaigns: GoogleAdsCampaignMetrics[];
  ground_truth: GoogleAdsGroundTruth;
  trends: {
    cpa: GoogleAdsTrend;
    roas: GoogleAdsTrend;
    conversions: GoogleAdsTrend;
    spend: GoogleAdsTrend;
  };
  segment_trends: GoogleAdsSegmentTrend[];
  metadata: {
    generated_at: string;
    loaded_sources: string[];
    missing_sources: string[];
    source_details: Record<string, GoogleAdsSourceDetail>;
  };
};
