import type { MetaAdsInsightRow } from "../sources/meta-ads";
import type { DateRange } from "../types";
import type {
  NormalizedAdSpend,
  NormalizedAdPerformance,
  NormalizedConversions,
  NormalizedRevenue,
  NormalizedCPA,
  NormalizedROAS,
} from "../metrics";
import { createProvenance } from "../utils";

function findAction(
  actions: MetaAdsInsightRow["actions"],
  actionType: string,
): number {
  const action = actions?.find((a) => a.action_type === actionType);
  return action ? Number(action.value) : 0;
}

function findActionValue(
  actionValues: MetaAdsInsightRow["action_values"],
  actionType: string,
): number {
  const action = actionValues?.find((a) => a.action_type === actionType);
  return action ? Number(action.value) : 0;
}

export function normalizeMetaAdsInsights(
  rows: MetaAdsInsightRow[],
  dateRange: DateRange,
): {
  adSpend: NormalizedAdSpend;
  adPerformance: NormalizedAdPerformance[];
  conversions: NormalizedConversions;
  revenue: NormalizedRevenue;
  cpa: NormalizedCPA;
  roas: NormalizedROAS;
} {
  const provenance = createProvenance("meta_ads", dateRange, {
    attributionWindow: "28d_click",
  });

  const totalSpend = rows.reduce((sum, r) => sum + Number(r.spend), 0);
  const totalPurchases = rows.reduce(
    (sum, r) => sum + findAction(r.actions, "purchase"),
    0,
  );
  const totalAttributedRevenue = rows.reduce(
    (sum, r) => sum + findActionValue(r.action_values, "purchase"),
    0,
  );
  const adSpend: NormalizedAdSpend = {
    total: totalSpend,
    byPlatform: [
      {
        source: "meta_ads",
        amount: totalSpend,
        breakdown: Object.fromEntries(
          rows.map((r) => [r.campaign_name, Number(r.spend)]),
        ),
      },
    ],
    provenance: [provenance],
  };

  const adPerformance: NormalizedAdPerformance[] = rows.map((r) => {
    const spend = Number(r.spend);
    const clicks = Number(r.clicks);
    const impressions = Number(r.impressions);
    return {
      source: "meta_ads" as const,
      campaignName: r.campaign_name,
      spend,
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      provenance,
    };
  });

  const conversions: NormalizedConversions = {
    source: "meta_ads",
    count: totalPurchases,
    attributionWindow: "28d_click",
    isGroundTruth: false,
    label: "Meta Pixel Purchases",
    provenance,
  };

  const revenue: NormalizedRevenue = {
    source: "meta_ads",
    amount: totalAttributedRevenue,
    attributionWindow: "28d_click",
    isGroundTruth: false,
    provenance,
  };

  const cpa: NormalizedCPA = {
    source: "meta_ads",
    value: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
    spend: totalSpend,
    conversions: totalPurchases,
    attributionWindow: "28d_click",
    provenance,
  };

  const roas: NormalizedROAS = {
    source: "meta_ads",
    value: totalSpend > 0 ? totalAttributedRevenue / totalSpend : 0,
    revenue: totalAttributedRevenue,
    spend: totalSpend,
    attributionWindow: "28d_click",
    provenance,
  };

  return { adSpend, adPerformance, conversions, revenue, cpa, roas };
}
