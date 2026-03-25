import { NextResponse } from "next/server";
import { testConnection as testBigQuery } from "@/lib/services/bigquery";
import { testConnection as testMetaAds } from "@/lib/services/meta-ads";
import { testConnection as testGoogleAds } from "@/lib/services/google-ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasMetaCreds = !!process.env.META_ACCESS_TOKEN;
  const hasGoogleAdsCreds =
    !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const [bigquery, metaAds, googleAds] = await Promise.allSettled([
    testBigQuery(),
    hasMetaCreds ? testMetaAds() : Promise.resolve(null),
    hasGoogleAdsCreds ? testGoogleAds() : Promise.resolve(null),
  ]);

  const bq = bigquery.status === "fulfilled" ? bigquery.value : null;
  const meta = metaAds.status === "fulfilled" ? metaAds.value : null;
  const google = googleAds.status === "fulfilled" ? googleAds.value : null;

  function resolveStatus(
    result: { ok: boolean; error?: string; latencyMs: number } | null,
    hasCreds: boolean,
  ) {
    if (!hasCreds) return { status: "not_configured" as const, latencyMs: undefined, error: undefined };
    if (!result) return { status: "error" as const, latencyMs: undefined, error: "Connection check failed" };
    return {
      status: result.ok ? ("connected" as const) : ("error" as const),
      latencyMs: result.latencyMs,
      error: result.error,
    };
  }

  const metaStatus = resolveStatus(meta, hasMetaCreds);
  const googleStatus = resolveStatus(google, hasGoogleAdsCreds);

  return NextResponse.json({
    sources: [
      {
        name: "BigQuery",
        description: "Sales orders, customer data, revenue (ground truth)",
        status: bq?.ok ? "connected" : "error",
        latencyMs: bq?.latencyMs,
        error: bq?.error,
        lastChecked: new Date().toISOString(),
      },
      {
        name: "Google Sheets",
        description: "Ad spend budgets, SEO keyword rankings",
        status: "not_configured",
        lastChecked: null,
      },
      {
        name: "Meta Ads",
        description: "Campaign performance, creative metrics",
        status: metaStatus.status,
        latencyMs: metaStatus.latencyMs,
        error: metaStatus.error,
        lastChecked: hasMetaCreds ? new Date().toISOString() : null,
      },
      {
        name: "Google Ads",
        description: "Campaign spend, search terms, CPC",
        status: googleStatus.status,
        latencyMs: googleStatus.latencyMs,
        error: googleStatus.error,
        lastChecked: hasGoogleAdsCreds ? new Date().toISOString() : null,
      },
      {
        name: "GA4",
        description: "Sessions, traffic sources, conversion events",
        status: "not_configured",
        lastChecked: null,
      },
    ],
  });
}
