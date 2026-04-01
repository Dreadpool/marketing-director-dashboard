import type { MonthPeriod } from "@/lib/schemas/types";
import { fetchMonthlyAnalytics } from "./fetch-monthly-analytics";
import { fetchMetaAds } from "./fetch-meta-ads";
import { fetchGoogleAds } from "./fetch-google-ads";

export type FetchExecutor = (
  period: MonthPeriod,
) => Promise<Record<string, unknown>>;

const executors: Record<string, FetchExecutor> = {
  "monthly-analytics-review": fetchMonthlyAnalytics as unknown as FetchExecutor,
  "meta-ads-analysis": fetchMetaAds as unknown as FetchExecutor,
  "google-ads-analysis": fetchGoogleAds as unknown as FetchExecutor,
};

export function getExecutor(workflowSlug: string): FetchExecutor | undefined {
  return executors[workflowSlug];
}
