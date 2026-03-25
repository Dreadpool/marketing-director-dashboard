import { monthlyAnalyticsPrompts } from "./monthly-analytics";

const defaultPrompts: Record<string, Record<string, string>> = {
  "monthly-analytics-review": monthlyAnalyticsPrompts,
};

/** Get the default framework prompt for a workflow step */
export function getDefaultPrompt(
  workflowSlug: string,
  stepId: string,
): string | null {
  return defaultPrompts[workflowSlug]?.[stepId] ?? null;
}
