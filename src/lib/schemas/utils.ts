import type { DataSource, DateRange, AttributionWindow, DataProvenance } from "./types";

/** Convert Google Ads micros to USD */
export function microsToUSD(micros: number | string): number {
  const value = typeof micros === "string" ? Number(micros) : micros;
  return value / 1_000_000;
}

/** Normalize email: lowercase and trim */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** Calculate percent change with safe zero handling. Returns decimal (0.10 = 10%) */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 1;
  }
  return (current - previous) / previous;
}

/** Format a number as USD for display */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Create a DataProvenance object with defaults */
export function createProvenance(
  source: DataSource,
  dateRange: DateRange,
  options?: {
    attributionWindow?: AttributionWindow;
    notes?: string[];
    isGroundTruth?: boolean;
    fetchedAt?: string;
  },
): DataProvenance {
  return {
    source,
    fetchedAt: options?.fetchedAt ?? new Date().toISOString(),
    dateRange,
    attributionWindow: options?.attributionWindow,
    currency: "USD",
    notes: options?.notes,
    isGroundTruth: options?.isGroundTruth ?? source === "bigquery",
  };
}
