import type { MonthPeriod } from "@/lib/schemas/types";
import type {
  CampaignSegment,
  CpaStatus,
  RoasStatus,
} from "@/lib/schemas/sources/google-ads-metrics";

// --- SLE Thresholds (derived from unit economics, matches Meta) ---

export const GOOGLE_ADS_THRESHOLDS = {
  cpa_on_target: 9,
  cpa_elevated: 14,
  roas_floor: 3.0,
  roas_watch: 2.0,
  over_attribution: 1.3,
  gp_per_order: 35.23,
  gross_margin: 0.43,
  ground_truth_divergence: 0.30,
} as const;

// --- Helpers ---

export function safeDivide(num: number, den: number, fallback = 0): number {
  return den > 0 ? num / den : fallback;
}

export function classifySegment(campaignName: string): CampaignSegment {
  const name = campaignName.toLowerCase();
  if (name.includes("p-max") || name.includes("performance max")) return "pmax";
  if (name.includes("video")) return "video";
  if (name.includes("competitor")) return "competitor";
  if (name.includes("brand") && !name.includes("non-brand")) return "brand";
  if (name.includes("non-brand")) return "non-brand";
  if (name.includes("charter") || name.includes("stgeo") || name.includes("nws")) return "non-brand";
  return "other";
}

export function getCpaStatus(cpa: number): CpaStatus {
  if (cpa <= GOOGLE_ADS_THRESHOLDS.cpa_on_target) return "on-target";
  if (cpa <= GOOGLE_ADS_THRESHOLDS.cpa_elevated) return "elevated";
  return "high";
}

export function getRoasStatus(roas: number): RoasStatus {
  if (roas >= GOOGLE_ADS_THRESHOLDS.roas_floor) return "above-target";
  if (roas >= GOOGLE_ADS_THRESHOLDS.roas_watch) return "watch";
  return "below-target";
}
