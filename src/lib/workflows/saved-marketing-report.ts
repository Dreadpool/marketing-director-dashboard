import { isRetiredTdsReport } from "./tds-reporting";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

// Read projection only: historical snapshots stay unchanged in storage.
export function savedMarketingReport(slug: string, value: unknown) {
  if (isRetiredTdsReport(slug)) return null;
  if (slug !== "google-ads-analysis") return value;
  const data = object(value);
  const metadata = object(data.metadata);
  const fields = ["period", "account_health", "campaigns", "trends", "segment_trends", "dataRetrievedAt"];
  const sources = (value: unknown) => Array.isArray(value)
    ? value.filter(key => typeof key === "string" && key.startsWith("google_ads_")) : [];
  return {
    ...Object.fromEntries(fields.map(key => [key, data[key]])),
    metadata: {
      generated_at: metadata.generated_at,
      loaded_sources: sources(metadata.loaded_sources),
      missing_sources: sources(metadata.missing_sources),
      source_details: Object.fromEntries(Object.entries(object(metadata.source_details))
        .filter(([key]) => key.startsWith("google_ads_"))),
    },
  };
}
