import type { MonthPeriod } from "@/lib/schemas/types";
import { fetchMetaAds } from "./fetch-meta-ads";
import { fetchGoogleAds } from "./fetch-google-ads";
import { fetchSeoRanking } from "./fetch-seo-ranking";

export type FetchExecutor = (
  period: MonthPeriod,
  params?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

const executors: Record<string, FetchExecutor> = {
  "meta-ads-analysis": fetchMetaAds as unknown as FetchExecutor,
  "google-ads-analysis": fetchGoogleAds as unknown as FetchExecutor,
  "seo-ranking-analysis": fetchSeoRanking as unknown as FetchExecutor,
};

export function getExecutor(workflowSlug: string): FetchExecutor | undefined {
  return executors[workflowSlug];
}
