/** Raw Google Ads API campaign row before normalization */
export type GoogleAdsCampaignRow = {
  campaign: {
    id: string;
    name: string;
    status?: string;
  };
  adGroup?: {
    id: string;
    name: string;
  };
  metrics: {
    /** Cost in micros (1,000,000 = 1 USD) */
    cost_micros: string;
    clicks: string;
    impressions: string;
    /** Float, may be GA4 events not actual purchases */
    conversions?: string;
    conversions_value?: string;
    /** CTR as percentage 0-100 */
    ctr?: string;
    /** In micros */
    average_cpc?: string;
  };
  segments?: {
    date?: string;
  };
};
