import type { MonthPeriod } from "@/lib/schemas/types";
import type {
  MetaAdsMetrics,
  MetaAdsCampaignRow,
  MetaAdsAdSetRow,
  MetaAdsAdRow,
  MetaAdsBreakdownRow,
  MetaAdsFatigueSignal,
  MetaAdsSourceDetail,
} from "@/lib/schemas/sources/meta-ads-metrics";
import type { MetaAdsInsightRow } from "@/lib/schemas/sources/meta-ads";
import {
  getMonthlyInsights,
  getAdInsights,
  getAdSetInsights,
  getAudienceBreakdowns,
} from "@/lib/services/meta-ads";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeDivide(num: number, den: number, fallback = 0): number {
  return den > 0 ? num / den : fallback;
}

function extractPurchases(row: MetaAdsInsightRow): number {
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const action = actions.find((a) => a.action_type === "purchase");
  const val = action ? Number(action.value) : 0;
  return isNaN(val) ? 0 : val;
}

function extractRevenue(row: MetaAdsInsightRow): number {
  const actions = Array.isArray(row.action_values) ? row.action_values : [];
  const action = actions.find((a) => a.action_type === "purchase");
  const val = action ? Number(action.value) : 0;
  return isNaN(val) ? 0 : val;
}

const RETARGETING_KEYWORDS = [
  "retarget",
  "remarketing",
  "dpa",
  "catalog",
  "remarket",
];

function classifyFunnelStage(
  campaignName: string,
): "tof" | "retargeting" | "other" {
  const lower = campaignName.toLowerCase();
  if (RETARGETING_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "retargeting";
  }
  if (lower.includes("hiring") || lower.includes("driver")) {
    return "other";
  }
  return "tof";
}

// ─── Main executor ───────────────────────────────────────────────────────────

export async function fetchMetaAds(
  period: MonthPeriod,
): Promise<MetaAdsMetrics> {
  const startDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const endDate = new Date(period.year, period.month, 0)
    .toISOString()
    .slice(0, 10);

  // 1. Parallel fetch: campaigns required, ads + ad sets + audience optional.
  //    Each call has built-in retry with backoff on rate limit errors.
  const [campaignResult, adResult, audienceResult, adSetResult] =
    await Promise.allSettled([
      getMonthlyInsights(period),
      getAdInsights(period),
      getAudienceBreakdowns(period),
      getAdSetInsights(period),
    ]);

  if (campaignResult.status === "rejected") {
    throw new Error(
      `Meta Ads campaign fetch failed: ${campaignResult.reason}`,
    );
  }

  const campaignRows = campaignResult.value;
  const adRows =
    adResult.status === "fulfilled" ? adResult.value : null;
  const audienceData =
    audienceResult.status === "fulfilled" ? audienceResult.value : null;
  const adSetRows =
    adSetResult.status === "fulfilled" ? adSetResult.value : null;

  // 2. Source tracking
  const sourceDetails: Record<string, MetaAdsSourceDetail> = {
    campaigns: { displayName: "Meta Campaigns", status: "ok" },
  };
  const loadedSources = ["campaigns"];
  const missingSources: string[] = [];

  if (adRows) {
    sourceDetails.ads = { displayName: "Meta Ads (Creative)", status: "ok" };
    loadedSources.push("ads");
  } else {
    sourceDetails.ads = {
      displayName: "Meta Ads (Creative)",
      status: "warning",
      message:
        adResult.status === "rejected"
          ? String(adResult.reason)
          : "No data",
    };
    missingSources.push("ads");
  }

  if (adSetRows) {
    sourceDetails.adsets = { displayName: "Meta Ad Sets", status: "ok" };
    loadedSources.push("adsets");
  } else {
    sourceDetails.adsets = {
      displayName: "Meta Ad Sets",
      status: "warning",
      message:
        adSetResult.status === "rejected"
          ? String(adSetResult.reason)
          : "No data",
    };
    missingSources.push("adsets");
  }

  if (audienceData) {
    const hasAllBreakdowns =
      audienceData.age_gender.length > 0 &&
      audienceData.geo.length > 0 &&
      audienceData.device.length > 0 &&
      audienceData.platform.length > 0;
    sourceDetails.audience = {
      displayName: "Meta Audience Breakdowns",
      status: hasAllBreakdowns ? "ok" : "warning",
      message: hasAllBreakdowns ? undefined : "Some audience breakdowns returned empty",
    };
    loadedSources.push("audience");
  } else {
    sourceDetails.audience = {
      displayName: "Meta Audience Breakdowns",
      status: "warning",
      message:
        audienceResult.status === "rejected"
          ? String(audienceResult.reason)
          : "No data",
    };
    missingSources.push("audience");
  }

  // 3. Separate hiring campaigns from acquisition campaigns
  //    Hiring ads (driver recruitment) don't generate purchases and shouldn't
  //    be included in CPA/ROAS calculations.
  const acquisitionRows = campaignRows.filter(
    (row) => classifyFunnelStage(row.campaign_name) !== "other",
  );
  const hiringRows = campaignRows.filter(
    (row) => classifyFunnelStage(row.campaign_name) === "other",
  );

  // 4. Aggregate account health from acquisition campaigns only
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalReach = 0;
  let totalPurchases = 0;
  let totalRevenue = 0;

  for (const row of acquisitionRows) {
    totalSpend += Number(row.spend);
    totalImpressions += Number(row.impressions);
    totalClicks += Number(row.clicks);
    totalReach += Number(row.reach ?? 0);
    totalPurchases += extractPurchases(row);
    totalRevenue += extractRevenue(row);
  }

  const accountCpa = safeDivide(totalSpend, totalPurchases);
  const accountRoas = safeDivide(totalRevenue, totalSpend);
  const accountCpm = safeDivide(totalSpend, totalImpressions) * 1000;
  const accountCtr = safeDivide(totalClicks, totalImpressions) * 100;
  const accountFreq = safeDivide(totalImpressions, totalReach);

  // CPA thresholds based on $35.23 GP/order, 43% margin, 1.3x over-attribution
  const cpaStatus: MetaAdsMetrics["account_health"]["cpa_status"] =
    accountCpa < 9 ? "on-target" : accountCpa < 14 ? "elevated" : "high";
  // ROAS floor: 3.0x = GP breakeven after COGS + 1.3x over-attribution
  const roasStatus: MetaAdsMetrics["account_health"]["roas_status"] =
    accountRoas >= 3.0 ? "above-target" : "below-target";

  // 5. Map campaign rows
  function mapCampaignRow(row: MetaAdsInsightRow): MetaAdsCampaignRow {
    const spend = Number(row.spend);
    const purchases = extractPurchases(row);
    const revenue = extractRevenue(row);
    return {
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      objective: row.objective ?? "",
      status: row.status ?? "",
      funnel_stage: classifyFunnelStage(row.campaign_name),
      spend,
      impressions: Number(row.impressions),
      reach: Number(row.reach ?? 0),
      clicks: Number(row.clicks),
      frequency: Number(row.frequency ?? 0),
      cpm: Number(row.cpm ?? 0),
      ctr: Number(row.ctr ?? 0),
      purchases,
      attributed_revenue: revenue,
      cpa: safeDivide(spend, purchases),
      roas: safeDivide(revenue, spend),
    };
  }

  const campaigns = acquisitionRows
    .map(mapCampaignRow)
    .sort((a, b) => b.spend - a.spend);

  const hiringCampaigns = hiringRows
    .map(mapCampaignRow)
    .sort((a, b) => b.spend - a.spend);

  // 6. Map ad rows with hook/hold rates
  const ads: MetaAdsAdRow[] = adRows
    ? adRows
        .map((row) => {
          const spend = Number(row.spend);
          const impressions = Number(row.impressions);
          const purchases = extractPurchases(row);
          const revenue = extractRevenue(row);
          const video3s = Number(row.video_3s_views ?? 0);
          const thruplayAction = row.video_thruplay_watched_actions?.find(
            (a) => a.action_type === "video_view",
          );
          const thruplay = thruplayAction ? Number(thruplayAction.value) : 0;

          const hasVideo = video3s > 0;

          return {
            ad_id: row.ad_id ?? "",
            ad_name: row.ad_name ?? "",
            adset_id: row.adset_id ?? "",
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            adset_name: row.adset_name ?? "",
            spend,
            impressions,
            clicks: Number(row.clicks),
            purchases,
            cpa: safeDivide(spend, purchases),
            roas: safeDivide(revenue, spend),
            hook_rate: hasVideo
              ? safeDivide(video3s, impressions)
              : null,
            hold_rate: hasVideo
              ? safeDivide(thruplay, video3s)
              : null,
            video_3s_views: video3s,
            video_thruplay: thruplay,
          };
        })
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 50) // cap at top 50 by spend to keep payload manageable
    : [];

  // 6. Map ad set rows
  const adsets: MetaAdsAdSetRow[] = adSetRows
    ? adSetRows
        .map((row) => {
          const spend = Number(row.spend);
          const purchases = extractPurchases(row);
          const revenue = extractRevenue(row);
          return {
            adset_id: row.adset_id ?? "",
            adset_name: row.adset_name ?? "",
            campaign_id: row.campaign_id,
            spend,
            impressions: Number(row.impressions),
            reach: Number(row.reach ?? 0),
            clicks: Number(row.clicks),
            frequency: Number(row.frequency ?? 0),
            purchases,
            attributed_revenue: revenue,
            cpa: safeDivide(spend, purchases),
            roas: safeDivide(revenue, spend),
          };
        })
        .sort((a, b) => b.spend - a.spend)
    : [];

  // 7. Detect fatigue signals
  const fatigued_ads: MetaAdsFatigueSignal[] = [];

  for (const ad of ads) {
    if (ad.impressions === 0) continue;

    const adCpm = safeDivide(ad.spend, ad.impressions) * 1000;
    const adCtr = safeDivide(ad.clicks, ad.impressions) * 100;

    if (accountCpm > 0 && adCpm > accountCpm * 1.3) {
      fatigued_ads.push({
        ad_id: ad.ad_id,
        ad_name: ad.ad_name,
        signal_type: "rising_cpm",
        current_value: adCpm,
        threshold: accountCpm * 1.3,
      });
    }
    if (accountCtr > 0 && adCtr < accountCtr * 0.8) {
      fatigued_ads.push({
        ad_id: ad.ad_id,
        ad_name: ad.ad_name,
        signal_type: "declining_ctr",
        current_value: adCtr,
        threshold: accountCtr * 0.8,
      });
    }
  }

  // Campaign-level frequency check (more meaningful than ad-level)
  for (const campaign of campaigns) {
    if (campaign.frequency > 3.0) {
      fatigued_ads.push({
        ad_id: campaign.campaign_id,
        ad_name: `Campaign: ${campaign.campaign_name}`,
        signal_type: "high_frequency",
        current_value: campaign.frequency,
        threshold: 3.0,
      });
    }
  }

  // 7. Signals
  const topCampaignSpend = campaigns.length > 0 ? campaigns[0].spend : 0;
  const topCampaignSpendPct = safeDivide(topCampaignSpend, totalSpend);

  const tofCampaigns = campaigns
    .filter((c) => c.funnel_stage === "tof")
    .map((c) => c.campaign_name);
  const retargetingCampaigns = campaigns
    .filter((c) => c.funnel_stage === "retargeting")
    .map((c) => c.campaign_name);

  // 8. Map audience breakdowns
  function mapBreakdownRows(
    rows: MetaAdsInsightRow[],
    dimensionKey: keyof MetaAdsInsightRow,
  ): MetaAdsBreakdownRow[] {
    return rows
      .map((row) => {
        const spend = Number(row.spend);
        const purchases = extractPurchases(row);
        const revenue = extractRevenue(row);
        const segmentCpa = safeDivide(spend, purchases);
        return {
          dimension: String(dimensionKey),
          value: String(row[dimensionKey] ?? "unknown"),
          spend,
          impressions: Number(row.impressions),
          clicks: Number(row.clicks),
          purchases,
          attributed_revenue: revenue,
          cpa: segmentCpa,
          roas: safeDivide(revenue, spend),
          efficiency_index: accountCpa > 0 ? safeDivide(segmentCpa, accountCpa) : 1,
        };
      })
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 15);
  }

  // For age_gender, combine both dimensions into one label
  const ageGenderRows: MetaAdsBreakdownRow[] = audienceData
    ? audienceData.age_gender
        .map((row) => {
          const spend = Number(row.spend);
          const purchases = extractPurchases(row);
          const revenue = extractRevenue(row);
          const segmentCpa = safeDivide(spend, purchases);
          return {
            dimension: "age_gender",
            value: `${row.age ?? "?"} ${row.gender ?? "?"}`,
            spend,
            impressions: Number(row.impressions),
            clicks: Number(row.clicks),
            purchases,
            attributed_revenue: revenue,
            cpa: segmentCpa,
            roas: safeDivide(revenue, spend),
            efficiency_index: accountCpa > 0 ? safeDivide(segmentCpa, accountCpa) : 1,
          };
        })
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 15)
    : [];

  return {
    period: {
      year: period.year,
      month: MONTH_NAMES[period.month] ?? "",
      month_num: period.month,
      date_range: { start: startDate, end: endDate },
    },
    account_health: {
      total_spend: totalSpend,
      total_purchases: totalPurchases,
      total_attributed_revenue: totalRevenue,
      cpa: accountCpa,
      roas: accountRoas,
      cpm: accountCpm,
      ctr: accountCtr,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_reach: totalReach,
      avg_frequency: accountFreq,
      cpa_status: cpaStatus,
      roas_status: roasStatus,
    },
    campaigns,
    hiring_campaigns: hiringCampaigns,
    ads,
    adsets,
    audience: {
      age_gender: ageGenderRows,
      geo: audienceData
        ? mapBreakdownRows(audienceData.geo, "country")
        : [],
      device: audienceData
        ? mapBreakdownRows(audienceData.device, "device_platform")
        : [],
      platform: audienceData
        ? mapBreakdownRows(audienceData.platform, "publisher_platform")
        : [],
    },
    signals: {
      fatigued_ads,
      top_campaigns_spend_pct: topCampaignSpendPct,
      tof_campaigns: tofCampaigns,
      retargeting_campaigns: retargetingCampaigns,
    },
    metadata: {
      generated_at: new Date().toISOString(),
      loaded_sources: loadedSources,
      missing_sources: missingSources,
      source_details: sourceDetails,
    },
  };
}
