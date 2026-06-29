import {
  getPreviousMondaySunday,
  renderHiringAdsEmail,
  renderHiringAdsFullReport,
  type HiringAdSnapshot,
  type HiringPlatform,
} from "@/lib/services/hiring-ads-snapshot";

export { renderHiringAdsEmail, renderHiringAdsFullReport };

export function typeOnlyPreviewSnapshot(now = new Date()): HiringAdSnapshot {
  const schedule = getPreviousMondaySunday(now);
  const platforms: HiringPlatform[] = ["Google Ads", "Meta Ads"];
  const requestedMarkets = ["Omak, WA", "St. George, UT", "Pocatello, ID"];

  return {
    generatedAt: now.toISOString(),
    timeZone: "America/Denver",
    reportPeriod: schedule.period,
    reportPeriodLabel: schedule.label,
    reportDueAfter: schedule.dueAfter,
    requestedMarkets,
    activeMarkets: [],
    actionSummary: [
      "Preview only: no live ad-platform data has been fetched.",
      "The live report will show one market coverage row for each requested or active hiring market.",
      "Hiring conversion rate is not tracked unless completed applications are connected to the ad platform.",
    ],
    rows: requestedMarkets.flatMap((market) => platforms.map((platform) => ({
      market,
      platform,
      status: "Needs review" as const,
      reason: "fetch_failed" as const,
      spend: null,
      impressions: null,
      clicks: null,
      hiringConversionRate: "Unknown" as const,
      notes: "Preview row. The Monday runner fills this with live read-only ad data.",
      sourceIds: [],
    }))),
    unmappedHiringAds: [],
    sourceFetches: [
      {
        source: "Google Ads",
        status: "skipped",
        fetchedAt: now.toISOString(),
        message: "Preview only.",
      },
      {
        source: "Meta Ads",
        status: "skipped",
        fetchedAt: now.toISOString(),
        message: "Preview only.",
      },
      {
        source: "GA4 diagnostics",
        status: "skipped",
        fetchedAt: now.toISOString(),
        message: "Diagnostic only.",
      },
    ],
    reportUrl: null,
  };
}
