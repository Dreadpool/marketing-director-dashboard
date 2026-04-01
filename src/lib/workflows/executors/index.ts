import type { MonthPeriod } from "@/lib/schemas/types";
import { fetchMonthlyAnalytics } from "./fetch-monthly-analytics";
import { fetchMetaAds } from "./fetch-meta-ads";
import { fetchGoogleAds } from "./fetch-google-ads";
import { fetchPromoCode } from "./fetch-promo-code";

export type FetchExecutor = (
  period: MonthPeriod,
  params?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

const executors: Record<string, FetchExecutor> = {
  "monthly-analytics-review": fetchMonthlyAnalytics as unknown as FetchExecutor,
  "meta-ads-analysis": fetchMetaAds as unknown as FetchExecutor,
  "google-ads-analysis": fetchGoogleAds as unknown as FetchExecutor,
  "promo-code-analysis": fetchPromoCode,
};

export function getExecutor(workflowSlug: string): FetchExecutor | undefined {
  return executors[workflowSlug];
}
