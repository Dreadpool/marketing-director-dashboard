import { monthlyAnalyticsPrompts } from "./monthly-analytics";
import { metaAdsPrompts } from "./meta-ads";
import { googleAdsPrompts } from "./google-ads";
import { promoCodePrompts } from "./promo-code-analysis";
import { seoRankingPrompts } from "./seo-ranking";

const defaultPrompts: Record<string, Record<string, string>> = {
  "monthly-analytics-review": monthlyAnalyticsPrompts,
  "meta-ads-analysis": metaAdsPrompts,
  "google-ads-analysis": googleAdsPrompts,
  "promo-code-analysis": promoCodePrompts,
  "seo-ranking-analysis": seoRankingPrompts,
};

/** Get the default framework prompt for a workflow step */
export function getDefaultPrompt(
  workflowSlug: string,
  stepId: string,
): string | null {
  return defaultPrompts[workflowSlug]?.[stepId] ?? null;
}
