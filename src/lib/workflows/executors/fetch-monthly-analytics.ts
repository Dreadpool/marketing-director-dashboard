import type { MonthPeriod } from "@/lib/schemas/types";
import type { DashboardMetrics } from "@/lib/schemas";
import { getDashboardSummary } from "@/lib/services/bigquery";
import { getMonthlyInsights } from "@/lib/services/meta-ads";
import { getMonthlySpend } from "@/lib/services/google-ads";
import { normalizeBigQueryData } from "@/lib/schemas/transformers/bigquery";
import { normalizeMetaAdsInsights } from "@/lib/schemas/transformers/meta-ads";
import { normalizeGoogleAdsData } from "@/lib/schemas/transformers/google-ads";
import { createProvenance } from "@/lib/schemas";

/** Fetch and normalize data from all sources for a month */
export async function fetchMonthlyAnalytics(
  period: MonthPeriod,
): Promise<DashboardMetrics> {
  const now = new Date();
  const dateRange = {
    start: `${period.year}-${String(period.month).padStart(2, "0")}-01`,
    end: new Date(period.year, period.month, 0).toISOString().slice(0, 10),
  };

  const [bqResult, metaResult, googleResult] = await Promise.allSettled([
    getDashboardSummary(period),
    getMonthlyInsights(period),
    getMonthlySpend(period),
  ]);

  if (bqResult.status === "rejected") {
    throw bqResult.reason;
  }

  const { revenue, conversions, customers } = normalizeBigQueryData(
    bqResult.value,
    dateRange,
  );

  const bqProvenance = createProvenance("bigquery", dateRange, {
    isGroundTruth: true,
  });

  const sources = [bqProvenance];
  const allConversions = [conversions];
  const cpaList = [];
  const roasList = [];
  const adPerformanceList = [];
  let totalAdSpend = 0;
  const byPlatform: DashboardMetrics["adSpend"]["byPlatform"] = [];
  const adSpendProvenance = [];

  if (metaResult.status === "fulfilled" && metaResult.value.length > 0) {
    const meta = normalizeMetaAdsInsights(metaResult.value, dateRange);
    totalAdSpend += meta.adSpend.total;
    byPlatform.push(...meta.adSpend.byPlatform);
    adSpendProvenance.push(...meta.adSpend.provenance);
    allConversions.push(meta.conversions);
    cpaList.push(meta.cpa);
    roasList.push(meta.roas);
    adPerformanceList.push(...meta.adPerformance);
    revenue.platformAttributed.push(meta.revenue);
    sources.push(meta.adSpend.provenance[0]);
  } else if (metaResult.status === "rejected") {
    console.error("Meta Ads fetch failed:", metaResult.reason);
  }

  if (googleResult.status === "fulfilled" && googleResult.value.length > 0) {
    const google = normalizeGoogleAdsData(googleResult.value, dateRange);
    totalAdSpend += google.adSpend.total;
    byPlatform.push(...google.adSpend.byPlatform);
    adSpendProvenance.push(...google.adSpend.provenance);
    allConversions.push(google.conversions);
    cpaList.push(google.cpa);
    roasList.push(google.roas);
    adPerformanceList.push(...google.adPerformance);
    revenue.platformAttributed.push(google.revenue);
    sources.push(google.adSpend.provenance[0]);
  } else if (googleResult.status === "rejected") {
    console.error("Google Ads fetch failed:", googleResult.reason);
  }

  const cac = {
    value: customers.new > 0 ? totalAdSpend / customers.new : 0,
    totalSpend: totalAdSpend,
    newCustomers: customers.new,
    paybackRatio:
      customers.new > 0 && customers.newAvgRevenue > 0
        ? customers.newAvgRevenue / (totalAdSpend / customers.new)
        : 0,
    provenance: [bqProvenance, ...adSpendProvenance],
  };

  return {
    period,
    dateRange,
    revenue,
    customers,
    adSpend: {
      total: totalAdSpend,
      byPlatform,
      provenance: adSpendProvenance,
    },
    efficiency: {
      cac,
      cpa: cpaList,
      roas: roasList,
    },
    adPerformance:
      adPerformanceList.length > 0 ? adPerformanceList : undefined,
    conversions: allConversions,
    sources,
    lastUpdated: now.toISOString(),
  };
}
