/** GA4 traffic row from analytics API */
export type GA4TrafficRow = {
  date?: string;
  sessionDefaultChannelGroup?: string;
  sessionSource?: string;
  sessionMedium?: string;
  sessionCampaignName?: string;
  deviceCategory?: string;
  newVsReturning?: string;
  sessions: number;
  totalUsers: number;
  newUsers?: number;
  /** 0-1 scale (multiply by 100 for display percentage) */
  bounceRate: number;
  averageSessionDuration?: number;
  engagedSessions?: number;
  screenPageViews?: number;
};

/** GA4 e-commerce row from analytics API */
export type GA4EcommerceRow = {
  date?: string;
  sessionDefaultChannelGroup?: string;
  sessionSource?: string;
  sessionMedium?: string;
  transactions: number;
  purchaseRevenue: number;
  addToCarts?: number;
  checkouts?: number;
};
