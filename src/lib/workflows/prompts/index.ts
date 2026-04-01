import { monthlyAnalyticsPrompts } from "./monthly-analytics";
import { metaAdsPrompts } from "./meta-ads";
import { googleAdsPrompts } from "./google-ads";

const defaultPrompts: Record<string, Record<string, string>> = {
  "monthly-analytics-review": monthlyAnalyticsPrompts,
  "meta-ads-analysis": metaAdsPrompts,
  "google-ads-analysis": googleAdsPrompts,
};

/** Get the default framework prompt for a workflow step */
export function getDefaultPrompt(
  workflowSlug: string,
  stepId: string,
): string | null {
  return defaultPrompts[workflowSlug]?.[stepId] ?? null;
}
