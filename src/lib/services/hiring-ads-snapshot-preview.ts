import {
  getMonthToDatePeriod,
  getPreviousMondaySunday,
  renderHiringAdsEmail,
  renderHiringAdsFullReport,
  type HiringAdSnapshot,
} from "@/lib/services/hiring-ads-snapshot";

export { renderHiringAdsEmail, renderHiringAdsFullReport };

export function typeOnlyPreviewSnapshot(now = new Date()): HiringAdSnapshot {
  const schedule = getPreviousMondaySunday(now);
  const mtdSchedule = getMonthToDatePeriod(now);
  return {
    generatedAt: now.toISOString(),
    timeZone: "America/Denver",
    reportPosition: "Driver",
    reportPeriod: schedule.period,
    reportPeriodLabel: schedule.label,
    mtdReportPeriod: mtdSchedule.period,
    mtdReportPeriodLabel: mtdSchedule.label,
    reportDueAfter: schedule.dueAfter,
    rows: [],
    mtdRows: [],
    indeedRows: [],
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
        source: "Google Ads MTD",
        status: "skipped",
        fetchedAt: now.toISOString(),
        message: "Preview only.",
      },
      {
        source: "Meta Ads MTD",
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
