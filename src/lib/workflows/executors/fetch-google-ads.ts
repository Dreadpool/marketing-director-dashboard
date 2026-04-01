import type { MonthPeriod } from "@/lib/schemas/types";
import type {
  CampaignSegment,
  CpaStatus,
  RoasStatus,
  GoogleAdsMetrics,
  GoogleAdsCampaignMetrics,
  GoogleAdsSegmentHealth,
  GoogleAdsAccountHealth,
  GoogleAdsGroundTruth,
  GoogleAdsTrend,
  GoogleAdsPeriod,
  GoogleAdsSourceDetail,
} from "@/lib/schemas/sources/google-ads-metrics";
import type { GoogleAdsCampaignRow } from "@/lib/schemas/sources/google-ads";
import { microsToUSD, percentChange } from "@/lib/schemas/utils";
import { getMonthlySpend } from "@/lib/services/google-ads";
import { getSalesOrders } from "@/lib/services/bigquery-sales";

// --- SLE Thresholds (derived from unit economics, matches Meta) ---

export const GOOGLE_ADS_THRESHOLDS = {
  cpa_on_target: 9,
  cpa_elevated: 14,
  roas_floor: 3.0,
  roas_watch: 2.0,
  over_attribution: 1.3,
  gp_per_order: 35.23,
  gross_margin: 0.43,
  ground_truth_divergence: 0.30,
} as const;

// --- Helpers ---

export function safeDivide(num: number, den: number, fallback = 0): number {
  return den > 0 ? num / den : fallback;
}

export function classifySegment(campaignName: string): CampaignSegment {
  const name = campaignName.toLowerCase();
  if (name.includes("p-max") || name.includes("performance max")) return "pmax";
  if (name.includes("video")) return "video";
  if (name.includes("competitor")) return "competitor";
  if (name.includes("brand") && !name.includes("non-brand")) return "brand";
  if (name.includes("non-brand")) return "non-brand";
  if (name.includes("charter") || name.includes("stgeo") || name.includes("nws")) return "non-brand";
  return "other";
}

export function getCpaStatus(cpa: number): CpaStatus {
  if (cpa <= GOOGLE_ADS_THRESHOLDS.cpa_on_target) return "on-target";
  if (cpa <= GOOGLE_ADS_THRESHOLDS.cpa_elevated) return "elevated";
  return "high";
}

export function getRoasStatus(roas: number): RoasStatus {
  if (roas >= GOOGLE_ADS_THRESHOLDS.roas_floor) return "above-target";
  if (roas >= GOOGLE_ADS_THRESHOLDS.roas_watch) return "watch";
  return "below-target";
}

// --- Month names (index 0 empty so month 1 = "January") ---

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// --- Private helpers ---

function getPriorMonthPeriod(period: MonthPeriod): MonthPeriod {
  if (period.month === 1) {
    return { year: period.year - 1, month: 12 };
  }
  return { year: period.year, month: period.month - 1 };
}

function getYoYPeriod(period: MonthPeriod): MonthPeriod {
  return { year: period.year - 1, month: period.month };
}

function aggregateMetric(
  rows: GoogleAdsCampaignRow[],
  metric: "cost_micros" | "conversions" | "conversions_value",
): number {
  const sum = rows.reduce((acc, row) => {
    const raw = row.metrics[metric];
    return acc + (raw ? Number(raw) : 0);
  }, 0);
  return metric === "cost_micros" ? microsToUSD(sum) : sum;
}

function mapCampaignRow(row: GoogleAdsCampaignRow): GoogleAdsCampaignMetrics {
  const spend = microsToUSD(row.metrics.cost_micros);
  const clicks = Number(row.metrics.clicks);
  const impressions = Number(row.metrics.impressions);
  const conversions = Number(row.metrics.conversions ?? "0");
  const conversionsValue = Number(row.metrics.conversions_value ?? "0");

  return {
    campaign_id: row.campaign.id,
    campaign_name: row.campaign.name,
    status: row.campaign.status ?? "UNKNOWN",
    segment: classifySegment(row.campaign.name),
    spend,
    clicks,
    impressions,
    conversions,
    conversions_value: conversionsValue,
    cpa: safeDivide(spend, conversions),
    roas: safeDivide(conversionsValue, spend),
    ctr: safeDivide(clicks, impressions),
    avg_cpc: safeDivide(spend, clicks),
  };
}

function computeSegmentHealth(
  campaigns: GoogleAdsCampaignMetrics[],
  segment: CampaignSegment,
): GoogleAdsSegmentHealth {
  const filtered = campaigns.filter((c) => c.segment === segment);

  const totalSpend = filtered.reduce((s, c) => s + c.spend, 0);
  const totalClicks = filtered.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = filtered.reduce((s, c) => s + c.impressions, 0);
  const totalConversions = filtered.reduce((s, c) => s + c.conversions, 0);
  const totalConversionsValue = filtered.reduce((s, c) => s + c.conversions_value, 0);

  const cpa = safeDivide(totalSpend, totalConversions);
  const roas = safeDivide(totalConversionsValue, totalSpend);

  return {
    segment,
    total_spend: totalSpend,
    total_clicks: totalClicks,
    total_impressions: totalImpressions,
    total_conversions: totalConversions,
    total_conversions_value: totalConversionsValue,
    cpa,
    roas,
    ctr: safeDivide(totalClicks, totalImpressions),
    avg_cpc: safeDivide(totalSpend, totalClicks),
    // Spending with zero conversions = zombie (high CPA), not "on-target"
    cpa_status: totalConversions === 0 && totalSpend > 0 ? "high" : totalConversions === 0 ? "on-target" : getCpaStatus(cpa),
    roas_status: totalSpend === 0 ? "above-target" : getRoasStatus(roas),
    campaign_count: filtered.length,
  };
}

function computeAccountHealth(
  campaigns: GoogleAdsCampaignMetrics[],
): GoogleAdsAccountHealth {
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalConversionsValue = campaigns.reduce((s, c) => s + c.conversions_value, 0);

  const cpa = safeDivide(totalSpend, totalConversions);
  const roas = safeDivide(totalConversionsValue, totalSpend);

  const allSegments: CampaignSegment[] = [
    "brand", "non-brand", "competitor", "pmax", "video", "other",
  ];
  const segments = allSegments
    .map((seg) => computeSegmentHealth(campaigns, seg))
    .filter((sh) => sh.campaign_count > 0);

  return {
    total_spend: totalSpend,
    total_clicks: totalClicks,
    total_impressions: totalImpressions,
    total_conversions: totalConversions,
    total_conversions_value: totalConversionsValue,
    cpa,
    roas,
    ctr: safeDivide(totalClicks, totalImpressions),
    avg_cpc: safeDivide(totalSpend, totalClicks),
    // Spending with zero conversions = zombie (high CPA), not "on-target"
    cpa_status: totalConversions === 0 && totalSpend > 0 ? "high" : totalConversions === 0 ? "on-target" : getCpaStatus(cpa),
    roas_status: totalSpend === 0 ? "above-target" : getRoasStatus(roas),
    segments,
  };
}

function computeGroundTruth(
  googleConversions: number,
  bigqueryBookings: number,
): GoogleAdsGroundTruth {
  // Both zero = no data, not a divergence
  if (googleConversions === 0 && bigqueryBookings === 0) {
    return {
      bigquery_bookings: 0,
      google_ads_conversions: 0,
      attribution_ratio: 1,
      divergence_flag: false,
    };
  }

  const ratio = safeDivide(googleConversions, bigqueryBookings);
  const divergence = Math.abs(ratio - 1);

  return {
    bigquery_bookings: bigqueryBookings,
    google_ads_conversions: googleConversions,
    attribution_ratio: ratio,
    divergence_flag: divergence > GOOGLE_ADS_THRESHOLDS.ground_truth_divergence,
  };
}

function computeTrend(
  current: number,
  priorMonth: number,
  priorYear: number | null,
): GoogleAdsTrend {
  return {
    current,
    prior_month: priorMonth,
    prior_year: priorYear,
    mom_change: percentChange(current, priorMonth),
    yoy_change: priorYear !== null ? percentChange(current, priorYear) : null,
  };
}

// --- Main executor ---

export async function fetchGoogleAds(
  period: MonthPeriod,
): Promise<GoogleAdsMetrics> {
  const priorMonthPeriod = getPriorMonthPeriod(period);
  const yoyPeriod = getYoYPeriod(period);

  // Fetch all 4 sources in parallel
  const [currentResult, priorMonthResult, priorYearResult, salesResult] =
    await Promise.allSettled([
      getMonthlySpend(period),
      getMonthlySpend(priorMonthPeriod),
      getMonthlySpend(yoyPeriod),
      getSalesOrders(period),
    ]);

  // Current month is REQUIRED
  if (currentResult.status === "rejected") {
    throw new Error(
      `Google Ads fetch failed for ${period.year}-${period.month}: ${currentResult.reason}`,
    );
  }

  const currentRows = currentResult.value;
  const priorMonthRows = priorMonthResult.status === "fulfilled" ? priorMonthResult.value : null;
  const priorYearRows = priorYearResult.status === "fulfilled" ? priorYearResult.value : null;
  const salesOrders = salesResult.status === "fulfilled" ? salesResult.value : null;

  // Track source metadata
  const loadedSources: string[] = ["google_ads_current"];
  const missingSources: string[] = [];
  const sourceDetails: Record<string, GoogleAdsSourceDetail> = {
    google_ads_current: { displayName: "Google Ads (Current Month)", status: "ok" },
  };

  if (priorMonthRows) {
    loadedSources.push("google_ads_prior_month");
    sourceDetails.google_ads_prior_month = {
      displayName: "Google Ads (Prior Month)",
      status: "ok",
    };
  } else {
    missingSources.push("google_ads_prior_month");
    sourceDetails.google_ads_prior_month = {
      displayName: "Google Ads (Prior Month)",
      status: "warning",
      message: priorMonthResult.status === "rejected"
        ? String(priorMonthResult.reason)
        : "No data",
    };
  }

  if (priorYearRows) {
    loadedSources.push("google_ads_prior_year");
    sourceDetails.google_ads_prior_year = {
      displayName: "Google Ads (Same Month Last Year)",
      status: "ok",
    };
  } else {
    missingSources.push("google_ads_prior_year");
    sourceDetails.google_ads_prior_year = {
      displayName: "Google Ads (Same Month Last Year)",
      status: "warning",
      message: priorYearResult.status === "rejected"
        ? String(priorYearResult.reason)
        : "No data",
    };
  }

  if (salesOrders) {
    loadedSources.push("bigquery_sales");
    sourceDetails.bigquery_sales = {
      displayName: "BigQuery Sales Orders",
      status: "ok",
    };
  } else {
    missingSources.push("bigquery_sales");
    sourceDetails.bigquery_sales = {
      displayName: "BigQuery Sales Orders",
      status: "warning",
      message: salesResult.status === "rejected"
        ? String(salesResult.reason)
        : "No data",
    };
  }

  // Map and filter campaigns (only those with spend > 0 or conversions > 0)
  const allCampaigns = currentRows.map(mapCampaignRow);
  const campaigns = allCampaigns.filter(
    (c) => c.spend > 0 || c.conversions > 0,
  );

  // Account health
  const accountHealth = computeAccountHealth(campaigns);

  // Ground truth
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const bigqueryBookings = salesOrders ? salesOrders.length : 0;
  const groundTruth = computeGroundTruth(totalConversions, bigqueryBookings);

  // Trends: aggregate prior periods
  const currentSpend = aggregateMetric(currentRows, "cost_micros");
  const currentConversions = aggregateMetric(currentRows, "conversions");
  const currentConversionsValue = aggregateMetric(currentRows, "conversions_value");
  const currentCpa = safeDivide(currentSpend, currentConversions);
  const currentRoas = safeDivide(currentConversionsValue, currentSpend);

  const priorMonthSpend = priorMonthRows ? aggregateMetric(priorMonthRows, "cost_micros") : 0;
  const priorMonthConversions = priorMonthRows ? aggregateMetric(priorMonthRows, "conversions") : 0;
  const priorMonthConversionsValue = priorMonthRows ? aggregateMetric(priorMonthRows, "conversions_value") : 0;
  const priorMonthCpa = safeDivide(priorMonthSpend, priorMonthConversions);
  const priorMonthRoas = safeDivide(priorMonthConversionsValue, priorMonthSpend);

  const priorYearSpend = priorYearRows ? aggregateMetric(priorYearRows, "cost_micros") : null;
  const priorYearConversions = priorYearRows ? aggregateMetric(priorYearRows, "conversions") : null;
  const priorYearConversionsValue = priorYearRows ? aggregateMetric(priorYearRows, "conversions_value") : null;
  const priorYearCpa = priorYearSpend !== null && priorYearConversions !== null
    ? safeDivide(priorYearSpend, priorYearConversions)
    : null;
  const priorYearRoas = priorYearSpend !== null && priorYearConversionsValue !== null
    ? safeDivide(priorYearConversionsValue, priorYearSpend)
    : null;

  // Build period info
  const lastDay = new Date(period.year, period.month, 0).getDate();
  const mm = String(period.month).padStart(2, "0");
  const periodInfo: GoogleAdsPeriod = {
    year: period.year,
    month: MONTH_NAMES[period.month],
    month_num: period.month,
    date_range: {
      start: `${period.year}-${mm}-01`,
      end: `${period.year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    },
  };

  return {
    period: periodInfo,
    account_health: accountHealth,
    campaigns,
    ground_truth: groundTruth,
    trends: {
      cpa: computeTrend(currentCpa, priorMonthCpa, priorYearCpa),
      roas: computeTrend(currentRoas, priorMonthRoas, priorYearRoas),
      conversions: computeTrend(currentConversions, priorMonthConversions, priorYearConversions),
      spend: computeTrend(currentSpend, priorMonthSpend, priorYearSpend),
    },
    metadata: {
      generated_at: new Date().toISOString(),
      loaded_sources: loadedSources,
      missing_sources: missingSources,
      source_details: sourceDetails,
    },
  };
}
