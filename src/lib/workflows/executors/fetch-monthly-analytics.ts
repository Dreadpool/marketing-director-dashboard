import type { MonthPeriod } from "@/lib/schemas/types";
import { getMonthlyBookingCounts } from "@/lib/services/bigquery-sales";
import { getMonthlyAdSpend } from "@/lib/services/bigquery-adspend";

async function getMarketingMonth(period: MonthPeriod) {
  const [counts, spend] = await Promise.all([
    getMonthlyBookingCounts(period),
    getMonthlyAdSpend(period).catch(() => null),
  ]);
  const adSpend = spend?.total_spend ?? null;
  return {
    ...counts,
    returningPurchasers: counts.purchasers - counts.newPurchasers,
    adSpend,
    costPerNewPurchaser:
      adSpend !== null && counts.newPurchasers > 0
        ? adSpend / counts.newPurchasers
        : null,
  };
}

export async function fetchMonthlyAnalytics(period: MonthPeriod) {
  const [current, priorYear] = await Promise.all([
    getMarketingMonth(period),
    getMarketingMonth({ ...period, year: period.year - 1 }).catch(() => null),
  ]);
  return {
    kind: "monthly-marketing" as const,
    current,
    priorYear,
    metadata: {
      missing_sources: current.adSpend === null ? ["quickbooks_gl"] : [],
    },
  };
}

export type MonthlyMarketing = Awaited<
  ReturnType<typeof fetchMonthlyAnalytics>
>;
