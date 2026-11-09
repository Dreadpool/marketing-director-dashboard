import { metaAdsPrompts } from "./meta-ads";
import { googleAdsPrompts } from "./google-ads";
import { seoRankingPrompts } from "./seo-ranking";

const defaultPrompts: Record<string, Record<string, string>> = {
  "meta-ads-analysis": metaAdsPrompts,
  "google-ads-analysis": googleAdsPrompts,
  "seo-ranking-analysis": seoRankingPrompts,
};

/** Get the default framework prompt for a workflow step */
export function getDefaultPrompt(
  workflowSlug: string,
  stepId: string,
): string | null {
  return defaultPrompts[workflowSlug]?.[stepId] ?? null;
}
