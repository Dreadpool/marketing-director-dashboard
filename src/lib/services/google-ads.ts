import { GoogleAdsApi } from "google-ads-api";
import { GoogleAuth } from "google-auth-library";
import type { MonthPeriod } from "@/lib/schemas/types";
import type { GoogleAdsCampaignRow } from "@/lib/schemas/sources/google-ads";

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "4381990003";
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID ?? "7716669181";

export type ConnectionStatus = {
  ok: boolean;
  error?: string;
  latencyMs: number;
};

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/adwords"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse.token;
  if (!token) throw new Error("Failed to get access token for Google Ads");
  return token;
}

async function getClient() {
  const accessToken = await getAccessToken();

  const api = new GoogleAdsApi({
    client_id: "",
    client_secret: "",
    developer_token: DEVELOPER_TOKEN,
  });

  return api.Customer({
    customer_id: CUSTOMER_ID,
    login_customer_id: LOGIN_CUSTOMER_ID,
    refresh_token: "",
  }, {
    access_token: accessToken,
  });
}

/** Health check: simple query with LIMIT 1 */
export async function testConnection(): Promise<ConnectionStatus> {
  const start = Date.now();
  try {
    const customer = await getClient();
    await customer.query(`SELECT campaign.id FROM campaign LIMIT 1`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}

/** Fetch campaign spend/clicks/impressions/conversions for a month */
export async function getMonthlySpend(
  period: MonthPeriod,
): Promise<GoogleAdsCampaignRow[]> {
  const startDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const lastDay = new Date(period.year, period.month, 0).getDate();
  const endDate = `${period.year}-${String(period.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const customer = await getClient();

  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date >= '${startDate}'
      AND segments.date <= '${endDate}'
    ORDER BY metrics.cost_micros DESC
  `);

  return rows.map((row) => {
    const campaign = row.campaign as Record<string, unknown> | undefined;
    const metrics = row.metrics as Record<string, unknown> | undefined;
    return {
      campaign: {
        id: String(campaign?.id ?? ""),
        name: String(campaign?.name ?? ""),
        status: String(campaign?.status ?? ""),
      },
      metrics: {
        cost_micros: String(metrics?.cost_micros ?? "0"),
        clicks: String(metrics?.clicks ?? "0"),
        impressions: String(metrics?.impressions ?? "0"),
        conversions: String(metrics?.conversions ?? "0"),
        conversions_value: String(metrics?.conversions_value ?? "0"),
      },
    };
  });
}
