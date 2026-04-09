import type { MetaAdsInsightRow } from "@/lib/schemas/sources/meta-ads";

/**
 * Extract purchase count from a Meta API insights row.
 *
 * Meta returns conversion data in an `actions` array with various `action_type` values.
 * SLE uses the standard `purchase` event. We intentionally do NOT count
 * `offsite_conversion.fb_pixel_purchase` separately because Meta often returns both
 * for the same pixel event, which would double-count.
 */
export function extractPurchases(
  row: Pick<MetaAdsInsightRow, "actions">,
): number {
  if (!row.actions || !Array.isArray(row.actions)) return 0;
  for (const action of row.actions) {
    if (action.action_type === "purchase") {
      return Number(action.value ?? 0);
    }
  }
  return 0;
}

/**
 * Extract attributed revenue (action_value) from a Meta API insights row for the purchase event.
 */
export function extractRevenue(
  row: Pick<MetaAdsInsightRow, "action_values">,
): number {
  if (!row.action_values || !Array.isArray(row.action_values)) return 0;
  for (const av of row.action_values) {
    if (av.action_type === "purchase") {
      return Number(av.value ?? 0);
    }
  }
  return 0;
}
