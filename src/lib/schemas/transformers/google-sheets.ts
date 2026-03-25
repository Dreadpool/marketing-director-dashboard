import type { SheetsAdSpendRow, SheetsSEORankingRow } from "../sources/google-sheets";
import type { DateRange } from "../types";
import type { NormalizedAdSpend, NormalizedSEO } from "../metrics";
import { createProvenance } from "../utils";

export function normalizeAdSpendFromSheets(
  rows: SheetsAdSpendRow[],
  dateRange: DateRange,
): NormalizedAdSpend {
  const provenance = createProvenance("google_sheets", dateRange);

  const total = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const breakdown: Record<string, number> = {};
  for (const r of rows) {
    if (r.amount != null) {
      breakdown[r.account_name] = (breakdown[r.account_name] ?? 0) + r.amount;
    }
  }

  return {
    total,
    byPlatform: [
      {
        source: "google_sheets",
        amount: total,
        breakdown,
      },
    ],
    provenance: [provenance],
  };
}

/** Cap OTR/0 at rank 100, handle empty cells as null */
export function parseRank(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const str = String(value).trim().toUpperCase();
  if (str === "OTR" || str === "0") return 100;
  const num = Number(str);
  if (isNaN(num)) return null;
  return Math.min(Math.max(Math.round(num), 1), 100);
}

export function normalizeSEOFromSheets(
  rows: SheetsSEORankingRow[],
  dateRange: DateRange,
  previousRows?: SheetsSEORankingRow[],
): NormalizedSEO[] {
  const provenance = createProvenance("google_sheets", dateRange);

  const previousMap = new Map<string, number | null>();
  if (previousRows) {
    for (const r of previousRows) {
      previousMap.set(`${r.site}::${r.keyword}`, r.rank);
    }
  }

  return rows.map((r) => {
    const previousRank = previousMap.get(`${r.site}::${r.keyword}`) ?? null;
    const change =
      r.rank != null && previousRank != null ? previousRank - r.rank : null;

    return {
      site: r.site,
      keyword: r.keyword,
      rank: r.rank,
      previousRank,
      change,
      dateRange,
      provenance,
    };
  });
}
