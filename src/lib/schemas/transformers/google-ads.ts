import type { GoogleAdsCampaignRow } from "../sources/google-ads";
import type { DateRange } from "../types";
import type {
  NormalizedAdSpend,
  NormalizedAdPerformance,
  NormalizedConversions,
  NormalizedRevenue,
  NormalizedCPA,
  NormalizedROAS,
} from "../metrics";
import { microsToUSD, createProvenance } from "../utils";

export function normalizeGoogleAdsData(
  rows: GoogleAdsCampaignRow[],
  dateRange: DateRange,
): {
  adSpend: NormalizedAdSpend;
  adPerformance: NormalizedAdPerformance[];
  conversions: NormalizedConversions;
  revenue: NormalizedRevenue;
  cpa: NormalizedCPA;
  roas: NormalizedROAS;
} {
  const provenance = createProvenance("google_ads", dateRange, {
    attributionWindow: "none",
    notes: ["Conversions may be GA4 events, not actual purchases"],
  });

  const totalSpend = rows.reduce(
    (sum, r) => sum + microsToUSD(r.metrics.cost_micros),
    0,
  );
  const totalConversions = rows.reduce(
    (sum, r) => sum + Number(r.metrics.conversions ?? 0),
    0,
  );
  const totalConversionsValue = rows.reduce(
    (sum, r) => sum + Number(r.metrics.conversions_value ?? 0),
    0,
  );
  const adSpend: NormalizedAdSpend = {
    total: totalSpend,
    byPlatform: [
      {
        source: "google_ads",
        amount: totalSpend,
        breakdown: Object.fromEntries(
          rows.map((r) => [
            r.campaign.name,
            microsToUSD(r.metrics.cost_micros),
          ]),
        ),
      },
    ],
    provenance: [provenance],
  };

  const adPerformance: NormalizedAdPerformance[] = rows.map((r) => {
    const spend = microsToUSD(r.metrics.cost_micros);
    const clicks = Number(r.metrics.clicks);
    const impressions = Number(r.metrics.impressions);
    return {
      source: "google_ads" as const,
      campaignName: r.campaign.name,
      spend,
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      provenance,
    };
  });

  const conversions: NormalizedConversions = {
    source: "google_ads",
    count: totalConversions,
    attributionWindow: "none",
    isGroundTruth: false,
    label: "Google Ads Conversions (GA4 events)",
    provenance,
  };

  const revenue: NormalizedRevenue = {
    source: "google_ads",
    amount: totalConversionsValue,
    attributionWindow: "none",
    isGroundTruth: false,
    provenance,
  };

  const cpa: NormalizedCPA = {
    source: "google_ads",
    value: totalConversions > 0 ? totalSpend / totalConversions : 0,
    spend: totalSpend,
    conversions: totalConversions,
    attributionWindow: "none",
    provenance,
  };

  const roas: NormalizedROAS = {
    source: "google_ads",
    value: totalSpend > 0 ? totalConversionsValue / totalSpend : 0,
    revenue: totalConversionsValue,
    spend: totalSpend,
    attributionWindow: "none",
    provenance,
  };

  return { adSpend, adPerformance, conversions, revenue, cpa, roas };
}
