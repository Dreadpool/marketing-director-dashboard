import { NextResponse } from "next/server";
import { testConnection as testBigQuery } from "@/lib/services/bigquery";
import { testConnection as testMetaAds } from "@/lib/services/meta-ads";
import { testConnection as testGoogleAds } from "@/lib/services/google-ads";
import { testAdSpendConnection } from "@/lib/services/bigquery-adspend";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasMetaCreds = !!process.env.META_ACCESS_TOKEN;
  const hasGoogleAdsCreds =
    !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasBqCreds =
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !!process.env.GOOGLE_CREDENTIALS_JSON;

  const now = new Date();
  const currentPeriod = { year: now.getFullYear(), month: now.getMonth() + 1 };

  const [bigquery, metaAds, googleAds, sheetsResult] = await Promise.allSettled([
    testBigQuery(),
    hasMetaCreds ? testMetaAds() : Promise.resolve(null),
    hasGoogleAdsCreds ? testGoogleAds() : Promise.resolve(null),
    hasBqCreds ? testAdSpendConnection(currentPeriod) : Promise.resolve(null),
  ]);

  const bq = bigquery.status === "fulfilled" ? bigquery.value : null;
  const meta = metaAds.status === "fulfilled" ? metaAds.value : null;
  const google = googleAds.status === "fulfilled" ? googleAds.value : null;
  const sheets = sheetsResult.status === "fulfilled" ? sheetsResult.value : null;

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

  // QuickBooks GL status (uses BigQuery credentials)
  let glStatus: { status: string; error?: string; warning?: string } = {
    status: "not_configured",
  };
  if (hasBqCreds && sheets) {
    glStatus = {
      status: sheets.ok ? "connected" : "error",
      error: sheets.error,
      warning: sheets.warning,
    };
  }

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
        name: "QuickBooks GL",
        description: "Ad spend from QuickBooks General Ledger (BigQuery)",
        status: glStatus.status,
        error: glStatus.error,
        warning: glStatus.warning,
        lastChecked: hasBqCreds ? new Date().toISOString() : null,
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
