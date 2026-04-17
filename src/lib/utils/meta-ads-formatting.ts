/**
 * CPA thresholds (SLE): $35.23 GP/order × 43% margin / 1.3x over-attribution.
 * - Under $9: on-target (green)
 * - $9-$14: elevated (amber)
 * - Over $14: high (red)
 */
export const CPA_TARGET = 9;
export const CPA_ELEVATED = 14;

/** ROAS: 3.0x = GP breakeven. No green state — CPA is the decision metric. */
export const ROAS_BREAKEVEN = 3.0;

export function cpaColor(cpa: number): string {
  if (cpa <= 0) return "";
  if (cpa < CPA_TARGET) return "text-emerald-400";
  if (cpa < CPA_ELEVATED) return "text-amber-400";
  return "text-red-400";
}

export function roasColor(roas: number): string {
  return roas >= ROAS_BREAKEVEN ? "text-muted-foreground" : "text-red-400";
}
