import type {
  MetaAdsAdSetRow,
  MetaAdsCampaignRow,
  AdSetFlag,
} from "@/lib/schemas/sources/meta-ads-metrics";
import { median } from "@/lib/utils/stats";

/**
 * Flag ad sets that need attention. Two flags, both relative:
 *
 * 1. ctr_below_peers — ad set CTR is 25%+ below its campaign's median CTR
 * 2. cpa_increasing — ad set CPA rose 25%+ MoM, suppressed if the whole
 *    campaign shows a similar increase (seasonal/market shift)
 */
export function flagAdSets(
  adsets: MetaAdsAdSetRow[],
  campaigns: MetaAdsCampaignRow[],
): Map<string, AdSetFlag[]> {
  const result = new Map<string, AdSetFlag[]>();

  // Campaign-level CPA MoM for seasonality suppression
  const campaignCpaChange = new Map<string, number | null>();
  for (const c of campaigns) {
    campaignCpaChange.set(c.campaign_id, c.mom?.cpa_pct ?? null);
  }

  // Group ad sets by campaign
  const byCampaign = new Map<string, MetaAdsAdSetRow[]>();
  for (const adset of adsets) {
    const group = byCampaign.get(adset.campaign_id) ?? [];
    group.push(adset);
    byCampaign.set(adset.campaign_id, group);
  }

  for (const [campaignId, campAdSets] of byCampaign) {
    // CTRs for ad sets with impressions
    const ctrs = campAdSets
      .filter((a) => a.impressions > 0)
      .map((a) => a.clicks / a.impressions);
    const medCtr = median(ctrs);

    // Suppress CPA flags if the whole campaign's CPA rose 25%+
    const campCpaPct = campaignCpaChange.get(campaignId);
    const campaignWideIncrease = campCpaPct != null && campCpaPct >= 25;

    for (const adset of campAdSets) {
      const flags: AdSetFlag[] = [];

      // Flag 1: CTR 25%+ below campaign median (need 2+ ad sets to compare)
      if (ctrs.length >= 2 && adset.impressions > 0 && medCtr > 0) {
        const adsetCtr = adset.clicks / adset.impressions;
        const pctBelow = ((medCtr - adsetCtr) / medCtr) * 100;
        if (pctBelow >= 25) {
          flags.push({
            type: "ctr_below_peers",
            detail: `CTR ${(adsetCtr * 100).toFixed(2)}% is ${Math.round(pctBelow)}% below campaign median ${(medCtr * 100).toFixed(2)}%`,
          });
        }
      }

      // Flag 2: CPA increased 25%+ MoM (suppressed if campaign-wide)
      if (
        !campaignWideIncrease &&
        adset.mom?.cpa_pct != null &&
        adset.mom.cpa_pct >= 25
      ) {
        flags.push({
          type: "cpa_increasing",
          detail: `CPA increased ${Math.round(adset.mom.cpa_pct)}% vs last month`,
        });
      }

      if (flags.length > 0) {
        result.set(adset.adset_id, flags);
      }
    }
  }

  return result;
}
