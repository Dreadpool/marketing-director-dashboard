export const MMC_REPORT_URL = "https://mmc-ridership-summaries.vercel.app/";

export const retiredTdsReports = ["monthly-analytics-review", "promo-code-analysis"];

export function isRetiredTdsReport(slug: string) {
  return retiredTdsReports.includes(slug);
}

// Preserved old generated actions can repeat TDS figures, including Google's
// former warehouse comparison. They remain archived in storage.
export const archivedTdsActionWorkflows = [...retiredTdsReports, "google-ads-analysis"];
