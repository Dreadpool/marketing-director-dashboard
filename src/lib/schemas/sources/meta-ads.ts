/** Raw Meta Ads API insight row before normalization */
export type MetaAdsAction = {
  action_type: string;
  value: string;
};

export type MetaAdsActionValue = {
  action_type: string;
  value: string;
};

export type MetaAdsInsightRow = {
  campaign_id: string;
  campaign_name: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  objective?: string;
  status?: string;
  /** Spend as string, e.g. "33274.29" */
  spend: string;
  impressions: string;
  reach?: string;
  clicks: string;
  cpm?: string;
  ctr?: string;
  frequency?: string;
  /** Array of action objects, e.g. [{action_type: "purchase", value: "150"}] */
  actions?: MetaAdsAction[];
  /** Array of action value objects (revenue), e.g. [{action_type: "purchase", value: "5000.00"}] */
  action_values?: MetaAdsActionValue[];
  date_start: string;
  date_stop: string;
};
