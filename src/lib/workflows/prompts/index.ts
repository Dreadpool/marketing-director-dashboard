import { monthlyAnalyticsPrompts } from "./monthly-analytics";
import { metaAdsPrompts } from "./meta-ads";
import { seoRankingPrompts } from "./seo-ranking";

const defaultPrompts: Record<string, Record<string, string>> = {
  "monthly-analytics-review": monthlyAnalyticsPrompts,
  "meta-ads-analysis": metaAdsPrompts,
  "seo-ranking-analysis": seoRankingPrompts,
};

/** Get the default framework prompt for a workflow step */
export function getDefaultPrompt(
  workflowSlug: string,
  stepId: string,
): string | null {
  return defaultPrompts[workflowSlug]?.[stepId] ?? null;
}
