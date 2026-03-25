import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";
import type { MonthPeriod, DateRange } from "@/lib/schemas/types";
import type { MetaAdsInsightRow } from "@/lib/schemas/sources/meta-ads";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN ?? "";
const AD_ACCOUNT_ID =
  process.env.META_AD_ACCOUNT_ID ?? "act_1599255740369627";

export type ConnectionStatus = {
  ok: boolean;
  error?: string;
  latencyMs: number;
};

function getAdAccount(): AdAccount {
  FacebookAdsApi.init(ACCESS_TOKEN);
  return new AdAccount(AD_ACCOUNT_ID);
}

function monthToDateRange(period: MonthPeriod): DateRange {
  const start = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const lastDay = new Date(period.year, period.month, 0).getDate();
  const end = `${period.year}-${String(period.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/** Health check: fetch account name to verify credentials */
export async function testConnection(): Promise<ConnectionStatus> {
  const start = Date.now();
  try {
    const account = getAdAccount();
    await account.read(["name"]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}

const INSIGHT_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "actions",
  "action_values",
  "campaign_name",
  "campaign_id",
];

/** Fetch campaign-level insights for a month */
export async function getMonthlyInsights(
  period: MonthPeriod,
): Promise<MetaAdsInsightRow[]> {
  const { start, end } = monthToDateRange(period);
  const account = getAdAccount();

  const cursor = await account.getInsights(INSIGHT_FIELDS, {
    time_range: { since: start, until: end },
    level: "campaign",
    action_attribution_windows: ["28d_click"],
  });

  const rows: MetaAdsInsightRow[] = [];

  for (;;) {
    for (const raw of cursor) {
      const row = raw as Record<string, unknown>;
      rows.push({
        campaign_id: String(row.campaign_id ?? ""),
        campaign_name: String(row.campaign_name ?? ""),
        spend: String(row.spend ?? "0"),
        impressions: String(row.impressions ?? "0"),
        clicks: String(row.clicks ?? "0"),
        actions: (row.actions as MetaAdsInsightRow["actions"]) ?? [],
        action_values:
          (row.action_values as MetaAdsInsightRow["action_values"]) ?? [],
        date_start: start,
        date_stop: end,
      });
    }

    if (cursor.hasNext()) {
      await cursor.next();
    } else {
      break;
    }
  }

  return rows;
}
