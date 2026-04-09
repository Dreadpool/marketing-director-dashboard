import { NextRequest, NextResponse } from "next/server";
import { getAdSetDailyInsights } from "@/lib/services/meta-ads";
import {
  computeDailyTrend,
  classifyWithTrends,
} from "@/lib/workflows/classifiers/meta-ads-trends";
import type {
  DailyPoint,
  AdSetDailyTrendResponse,
  AdDailyTrend,
} from "@/lib/schemas/sources/meta-ads-metrics";
import { extractPurchases } from "@/lib/schemas/transformers/meta-ads-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adsetId, period } = body ?? {};

    if (
      !adsetId ||
      typeof adsetId !== "string" ||
      !period ||
      typeof period.year !== "number" ||
      typeof period.month !== "number"
    ) {
      return NextResponse.json(
        {
          error:
            "adsetId (string) and period {year: number, month: number} required",
        },
        { status: 400 },
      );
    }

    // Fetch daily rows for this ad set (1 API call, time_increment=1)
    const rows = await getAdSetDailyInsights(adsetId, {
      year: period.year,
      month: period.month,
    });

    // Group by ad_id
    const adMap = new Map<
      string,
      { ad_name: string; daily: DailyPoint[] }
    >();

    for (const row of rows) {
      const ad_id = row.ad_id ?? "";
      if (!ad_id) continue;

      const spend = Number(row.spend ?? 0);
      const impressions = Number(row.impressions ?? 0);
      const clicks = Number(row.clicks ?? 0);
      const purchases = extractPurchases(row);

      const point: DailyPoint = {
        date: row.date_start ?? "",
        spend,
        impressions,
        clicks,
        purchases,
        cpa: purchases > 0 ? spend / purchases : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
      };

      const existing = adMap.get(ad_id);
      if (existing) {
        existing.daily.push(point);
      } else {
        adMap.set(ad_id, { ad_name: row.ad_name ?? "", daily: [point] });
      }
    }

    // Compute trends + revised health per ad
    const ads: AdDailyTrend[] = [];
    for (const [ad_id, info] of adMap) {
      const trend = computeDailyTrend(info.daily);
      const revised_health = classifyWithTrends(trend);
      ads.push({
        ad_id,
        ad_name: info.ad_name,
        daily: info.daily,
        trend,
        revised_health,
      });
    }

    // Stable sort: most recent-first ad names, highest spend first
    ads.sort((a, b) => {
      const aSpend = a.daily.reduce((sum, d) => sum + d.spend, 0);
      const bSpend = b.daily.reduce((sum, d) => sum + d.spend, 0);
      return bSpend - aSpend;
    });

    const response: AdSetDailyTrendResponse = {
      adset_id: adsetId,
      ads,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[adset-daily] error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to fetch daily trends";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
