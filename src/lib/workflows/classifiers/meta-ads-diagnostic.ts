import type { MetaAdsAdSetRow } from "@/lib/schemas/sources/meta-ads-metrics";
import { median } from "@/lib/utils/stats";

export type DiagnosticScenario =
  | "audience_or_creative"
  | "exhaustion"
  | "post_click"
  | "auction_competition";

export type DiagnosticResult = {
  scenario: DiagnosticScenario;
  diagnosis: string;
  action: string;
  context: {
    frequency: number;
    adsetCtr: number;
    medianCtr: number;
    pctBelowMedian: number;
    spend: number;
    spendPctOfCampaign: number;
  };
};

export function diagnoseAdSet(
  adset: MetaAdsAdSetRow,
  campaignPeers: MetaAdsAdSetRow[],
  options?: { campaignCpaPct?: number | null },
): DiagnosticResult {
  const adsetCtr = adset.impressions > 0 ? adset.clicks / adset.impressions : 0;
  const peerCtrs = campaignPeers
    .filter((a) => a.impressions > 0)
    .map((a) => a.clicks / a.impressions);
  const medianCtr = median(peerCtrs);
  const pctBelowMedian = medianCtr > 0 ? ((medianCtr - adsetCtr) / medianCtr) * 100 : 0;

  const totalCampaignSpend = campaignPeers.reduce((s, a) => s + a.spend, 0);
  const spendPctOfCampaign =
    totalCampaignSpend > 0 ? (adset.spend / totalCampaignSpend) * 100 : 0;

  const lowCtr = pctBelowMedian >= 25;
  const highFreq = adset.frequency >= 3.5;
  const hasClicks = adset.clicks > 0;
  const lowCvr = hasClicks && adset.purchases === 0;
  const risingCpa =
    adset.mom?.cpa_pct != null &&
    adset.mom.cpa_pct >= 25 &&
    (options?.campaignCpaPct == null || options.campaignCpaPct < 25);

  const ctx: DiagnosticResult["context"] = {
    frequency: adset.frequency,
    adsetCtr,
    medianCtr,
    pctBelowMedian,
    spend: adset.spend,
    spendPctOfCampaign,
  };

  const fmtCtr = (v: number) => `${(v * 100).toFixed(2)}%`;
  const fmtPct = (v: number) => `${Math.round(v)}%`;

  if (lowCtr && highFreq) {
    return {
      scenario: "exhaustion",
      diagnosis: `CTR is ${fmtPct(pctBelowMedian)} below campaign median (${fmtCtr(adsetCtr)} vs ${fmtCtr(medianCtr)}). Frequency is ${adset.frequency.toFixed(1)}. This audience has seen these ads too many times.`,
      action: `Refresh creative or expand the audience. Frequency is ${adset.frequency.toFixed(1)} and CTR has dropped well below peers.`,
      context: ctx,
    };
  }

  if (lowCtr && !highFreq) {
    return {
      scenario: "audience_or_creative",
      diagnosis: `CTR is ${fmtPct(pctBelowMedian)} below campaign median (${fmtCtr(adsetCtr)} vs ${fmtCtr(medianCtr)}). Frequency is ${adset.frequency.toFixed(1)}, so the audience isn't oversaturated. The audience or the creative isn't resonating.`,
      action: `Review creative in this ad set. If similar creative works in other ad sets, the audience is wrong. If other audiences respond to different creative, this creative is the problem.`,
      context: ctx,
    };
  }

  if (!lowCtr && lowCvr) {
    return {
      scenario: "post_click",
      diagnosis: `CTR is ${fmtCtr(adsetCtr)}, in line with peers. But conversion rate is ${adset.purchases}/${adset.clicks} clicks. People click but don't buy.`,
      action: `Check the landing page. The creative drives clicks, but something breaks after the click. Or this audience clicks but isn't actually in-market.`,
      context: ctx,
    };
  }

  if (risingCpa && !lowCtr) {
    const cpaPct = Math.round(adset.mom!.cpa_pct!);
    return {
      scenario: "auction_competition",
      diagnosis: `CPA increased ${cpaPct}% vs last month while CTR held steady. Other ad sets in this campaign didn't see the same increase. Auction competition is driving costs up.`,
      action: `Auction competition is driving costs up on this audience. Ride it out or find a less competitive audience segment.`,
      context: ctx,
    };
  }

  return {
    scenario: "audience_or_creative",
    diagnosis: `CTR is ${fmtCtr(adsetCtr)} (campaign median: ${fmtCtr(medianCtr)}). No single clear signal stands out. Review the ad set's creative and audience targeting.`,
    action: `Review creative in this ad set. If similar creative works in other ad sets, the audience is wrong.`,
    context: ctx,
  };
}
