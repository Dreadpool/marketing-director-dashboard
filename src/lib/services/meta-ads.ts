import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";
import type { MonthPeriod, DateRange } from "@/lib/schemas/types";
import type { MetaAdsInsightRow } from "@/lib/schemas/sources/meta-ads";
import type { CampaignFrequencyRow } from "@/lib/workflows/evaluations/types";

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

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = String((err as Error & { code?: string }).code ?? "").toUpperCase();
  const message = err.message.toLowerCase();

  return ["ETIMEDOUT", "ECONNRESET", "ESOCKETTIMEDOUT"].includes(code)
    || message.includes("request limit reached")
    || message.includes("too many calls")
    || message.includes("rate limit")
    || message.includes("socket hang up")
    || message.includes("no response was received")
    || (err as Error & { status?: number }).status === 429;
}

/** Retry a read request with exponential backoff on transient failures. */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryableError(err) || attempt === maxRetries) throw err;

      const delayMs = Math.min(5000 * 3 ** attempt, 60000);
      console.warn(
        `[meta-ads] ${label}: transient failure, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("unreachable");
}

export const __metaAdsTest = {
  isRetryableError,
  withRetry,
};

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

const CAMPAIGN_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "reach",
  "frequency",
  "cpm",
  "ctr",
  "actions",
  "action_values",
  "campaign_name",
  "campaign_id",
  "objective",
];

const AD_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "actions",
  "action_values",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "ad_id",
  "ad_name",
  "adset_name",
  "video_play_actions",
  "video_thruplay_watched_actions",
];

const ADSET_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "reach",
  "frequency",
  "actions",
  "action_values",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
];

const BREAKDOWN_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "actions",
  "action_values",
];

/** Fetch campaign-level insights for a month */
export async function getMonthlyInsights(
  period: MonthPeriod,
): Promise<MetaAdsInsightRow[]> {
  return withRetry(() => _getMonthlyInsights(period), "campaigns");
}

async function _getMonthlyInsights(
  period: MonthPeriod,
): Promise<MetaAdsInsightRow[]> {
  const { start, end } = monthToDateRange(period);
  const account = getAdAccount();

  const cursor = await account.getInsights(CAMPAIGN_FIELDS, {
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
        objective: String(row.objective ?? ""),
        status: String(row.status ?? ""),
        spend: String(row.spend ?? "0"),
        impressions: String(row.impressions ?? "0"),
        clicks: String(row.clicks ?? "0"),
        reach: String(row.reach ?? "0"),
        frequency: String(row.frequency ?? "0"),
        cpm: String(row.cpm ?? "0"),
        ctr: String(row.ctr ?? "0"),
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

/** Fetch campaign-level insights for an arbitrary date range */
export async function getInsightsForDateRange(
  range: DateRange,
): Promise<MetaAdsInsightRow[]> {
  return withRetry(() => _getInsightsForDateRange(range), "campaigns-range");
}

async function _getInsightsForDateRange(
  range: DateRange,
): Promise<MetaAdsInsightRow[]> {
  const account = getAdAccount();

  const cursor = await account.getInsights(CAMPAIGN_FIELDS, {
    time_range: { since: range.start, until: range.end },
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
        objective: String(row.objective ?? ""),
        status: String(row.status ?? ""),
        spend: String(row.spend ?? "0"),
        impressions: String(row.impressions ?? "0"),
        clicks: String(row.clicks ?? "0"),
        reach: String(row.reach ?? "0"),
        frequency: String(row.frequency ?? "0"),
        cpm: String(row.cpm ?? "0"),
        ctr: String(row.ctr ?? "0"),
        actions: (row.actions as MetaAdsInsightRow["actions"]) ?? [],
        action_values:
          (row.action_values as MetaAdsInsightRow["action_values"]) ?? [],
        date_start: range.start,
        date_stop: range.end,
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

/** Fetch ad-level insights with video metrics for a month */
export async function getAdInsights(
  period: MonthPeriod,
): Promise<MetaAdsInsightRow[]> {
  return withRetry(() => _getAdInsights(period), "ads");
}

async function _getAdInsights(
  period: MonthPeriod,
): Promise<MetaAdsInsightRow[]> {
  const { start, end } = monthToDateRange(period);
  const account = getAdAccount();

  const cursor = await account.getInsights(AD_FIELDS, {
    time_range: { since: start, until: end },
    level: "ad",
    action_attribution_windows: ["28d_click"],
  });

  const rows: MetaAdsInsightRow[] = [];

  for (;;) {
    for (const raw of cursor) {
      const row = raw as Record<string, unknown>;

      // video_play_actions contains 3-second video view counts
      const videoPlayActions = row.video_play_actions as MetaAdsInsightRow["actions"];
      const video3sTotal = videoPlayActions?.find(
        (a) => a.action_type === "video_view",
      );

      rows.push({
        campaign_id: String(row.campaign_id ?? ""),
        campaign_name: String(row.campaign_name ?? ""),
        adset_id: String(row.adset_id ?? ""),
        ad_id: String(row.ad_id ?? ""),
        ad_name: String(row.ad_name ?? ""),
        adset_name: String(row.adset_name ?? ""),
        spend: String(row.spend ?? "0"),
        impressions: String(row.impressions ?? "0"),
        clicks: String(row.clicks ?? "0"),
        actions: (row.actions as MetaAdsInsightRow["actions"]) ?? [],
        action_values:
          (row.action_values as MetaAdsInsightRow["action_values"]) ?? [],
        video_3s_views: video3sTotal?.value ?? "0",
        video_thruplay_watched_actions:
          (row.video_thruplay_watched_actions as MetaAdsInsightRow["video_thruplay_watched_actions"]) ?? [],
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

/** Fetch ad-level insights for an arbitrary date range */
export async function getAdInsightsForDateRange(
  range: DateRange,
): Promise<MetaAdsInsightRow[]> {
  return withRetry(() => _getAdInsightsForDateRange(range), "ads-range");
}

async function _getAdInsightsForDateRange(
  range: DateRange,
): Promise<MetaAdsInsightRow[]> {
  const account = getAdAccount();

  const cursor = await account.getInsights(AD_FIELDS, {
    time_range: { since: range.start, until: range.end },
    level: "ad",
    action_attribution_windows: ["28d_click"],
  });

  const rows: MetaAdsInsightRow[] = [];

  for (;;) {
    for (const raw of cursor) {
      const row = raw as Record<string, unknown>;
      rows.push({
        campaign_id: String(row.campaign_id ?? ""),
        campaign_name: String(row.campaign_name ?? ""),
        adset_id: String(row.adset_id ?? ""),
        ad_id: String(row.ad_id ?? ""),
        ad_name: String(row.ad_name ?? ""),
        adset_name: String(row.adset_name ?? ""),
        spend: String(row.spend ?? "0"),
        impressions: String(row.impressions ?? "0"),
        clicks: String(row.clicks ?? "0"),
        actions: (row.actions as MetaAdsInsightRow["actions"]) ?? [],
        action_values:
          (row.action_values as MetaAdsInsightRow["action_values"]) ?? [],
        date_start: range.start,
        date_stop: range.end,
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

/** Fetch daily ad-level insights for a single ad set over the given month.
 *  One API call with time_increment=1 returns one row per ad per day. */
export async function getAdSetDailyInsights(
  adsetId: string,
  period: MonthPeriod,
): Promise<MetaAdsInsightRow[]> {
  return withRetry(
    () => _getAdSetDailyInsights(adsetId, period),
    `adset-daily:${adsetId}`,
  );
}

const AD_DAILY_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "actions",
  "action_values",
  "ad_id",
  "ad_name",
  "adset_id",
  "campaign_id",
  "date_start",
  "date_stop",
];

async function _getAdSetDailyInsights(
  adsetId: string,
  period: MonthPeriod,
): Promise<MetaAdsInsightRow[]> {
  const { start, end } = monthToDateRange(period);
  const account = getAdAccount();

  const cursor = await account.getInsights(AD_DAILY_FIELDS, {
    time_range: { since: start, until: end },
    time_increment: 1,
    level: "ad",
    filtering: [
      { field: "adset.id", operator: "EQUAL", value: adsetId },
    ],
    action_attribution_windows: ["28d_click"],
  });

  const rows: MetaAdsInsightRow[] = [];

  for (;;) {
    for (const raw of cursor) {
      const row = raw as Record<string, unknown>;
      rows.push({
        campaign_id: String(row.campaign_id ?? ""),
        campaign_name: "",
        adset_id: String(row.adset_id ?? ""),
        ad_id: String(row.ad_id ?? ""),
        ad_name: String(row.ad_name ?? ""),
        spend: String(row.spend ?? "0"),
        impressions: String(row.impressions ?? "0"),
        clicks: String(row.clicks ?? "0"),
        actions: (row.actions as MetaAdsInsightRow["actions"]) ?? [],
        action_values:
          (row.action_values as MetaAdsInsightRow["action_values"]) ?? [],
        date_start: String(row.date_start ?? ""),
        date_stop: String(row.date_stop ?? ""),
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

/** Fetch ad-set-level insights for a month */
export async function getAdSetInsights(
  period: MonthPeriod,
): Promise<MetaAdsInsightRow[]> {
  return withRetry(() => _getAdSetInsights(period), "adsets");
}

async function _getAdSetInsights(
  period: MonthPeriod,
): Promise<MetaAdsInsightRow[]> {
  const { start, end } = monthToDateRange(period);
  const account = getAdAccount();

  const cursor = await account.getInsights(ADSET_FIELDS, {
    time_range: { since: start, until: end },
    level: "adset",
    action_attribution_windows: ["28d_click"],
  });

  const rows: MetaAdsInsightRow[] = [];

  for (;;) {
    for (const raw of cursor) {
      const row = raw as Record<string, unknown>;
      rows.push({
        campaign_id: String(row.campaign_id ?? ""),
        campaign_name: String(row.campaign_name ?? ""),
        adset_id: String(row.adset_id ?? ""),
        adset_name: String(row.adset_name ?? ""),
        spend: String(row.spend ?? "0"),
        impressions: String(row.impressions ?? "0"),
        clicks: String(row.clicks ?? "0"),
        reach: String(row.reach ?? "0"),
        frequency: String(row.frequency ?? "0"),
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

/** Fetch ad-set-level insights for an arbitrary date range */
export async function getAdSetInsightsForDateRange(
  range: DateRange,
): Promise<MetaAdsInsightRow[]> {
  return withRetry(() => _getAdSetInsightsForDateRange(range), "adsets-range");
}

async function _getAdSetInsightsForDateRange(
  range: DateRange,
): Promise<MetaAdsInsightRow[]> {
  const account = getAdAccount();

  const cursor = await account.getInsights(ADSET_FIELDS, {
    time_range: { since: range.start, until: range.end },
    level: "adset",
    action_attribution_windows: ["28d_click"],
  });

  const rows: MetaAdsInsightRow[] = [];

  for (;;) {
    for (const raw of cursor) {
      const row = raw as Record<string, unknown>;
      rows.push({
        campaign_id: String(row.campaign_id ?? ""),
        campaign_name: String(row.campaign_name ?? ""),
        adset_id: String(row.adset_id ?? ""),
        adset_name: String(row.adset_name ?? ""),
        spend: String(row.spend ?? "0"),
        impressions: String(row.impressions ?? "0"),
        clicks: String(row.clicks ?? "0"),
        reach: String(row.reach ?? "0"),
        frequency: String(row.frequency ?? "0"),
        actions: (row.actions as MetaAdsInsightRow["actions"]) ?? [],
        action_values:
          (row.action_values as MetaAdsInsightRow["action_values"]) ?? [],
        date_start: range.start,
        date_stop: range.end,
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

export type AudienceBreakdowns = {
  age_gender: MetaAdsInsightRow[];
  geo: MetaAdsInsightRow[];
  device: MetaAdsInsightRow[];
  platform: MetaAdsInsightRow[];
};

/** Fetch audience breakdown insights (4 parallel calls) */
export async function getAudienceBreakdowns(
  period: MonthPeriod,
): Promise<AudienceBreakdowns> {
  return withRetry(() => _getAudienceBreakdowns(period), "audience");
}

async function _getAudienceBreakdowns(
  period: MonthPeriod,
): Promise<AudienceBreakdowns> {
  const { start, end } = monthToDateRange(period);
  const account = getAdAccount();

  async function fetchBreakdown(
    breakdowns: string[],
  ): Promise<MetaAdsInsightRow[]> {
    const cursor = await account.getInsights(BREAKDOWN_FIELDS, {
      time_range: { since: start, until: end },
      level: "account",
      breakdowns,
      action_attribution_windows: ["28d_click"],
    });

    const rows: MetaAdsInsightRow[] = [];
    for (;;) {
      for (const raw of cursor) {
        const row = raw as Record<string, unknown>;
        rows.push({
          campaign_id: "",
          campaign_name: "",
          spend: String(row.spend ?? "0"),
          impressions: String(row.impressions ?? "0"),
          clicks: String(row.clicks ?? "0"),
          actions: (row.actions as MetaAdsInsightRow["actions"]) ?? [],
          action_values:
            (row.action_values as MetaAdsInsightRow["action_values"]) ?? [],
          age: row.age != null ? String(row.age) : undefined,
          gender: row.gender != null ? String(row.gender) : undefined,
          country: row.country != null ? String(row.country) : undefined,
          device_platform:
            row.device_platform != null
              ? String(row.device_platform)
              : undefined,
          publisher_platform:
            row.publisher_platform != null
              ? String(row.publisher_platform)
              : undefined,
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

  const [ageGender, geo, device, platform] = await Promise.allSettled([
    fetchBreakdown(["age", "gender"]),
    fetchBreakdown(["country"]),
    fetchBreakdown(["device_platform"]),
    fetchBreakdown(["publisher_platform"]),
  ]);

  return {
    age_gender:
      ageGender.status === "fulfilled" ? ageGender.value : [],
    geo: geo.status === "fulfilled" ? geo.value : [],
    device: device.status === "fulfilled" ? device.value : [],
    platform:
      platform.status === "fulfilled" ? platform.value : [],
  };
}

/** Fetch ad creative image URLs (thumbnail + full-size) keyed by ad ID.
 *  Must receive the ad IDs from insights to filter correctly — getAds with
 *  effective_status returns currently active ads, which may differ from the
 *  ads that ran during the insights period. */
export async function getAdCreatives(
  adIds: string[],
): Promise<Map<string, { image_url: string | null; thumbnail_url: string | null }>> {
  if (adIds.length === 0) return new Map();
  return withRetry(() => _getAdCreatives(adIds), "ad-creatives");
}

async function _getAdCreatives(
  adIds: string[],
): Promise<Map<string, { image_url: string | null; thumbnail_url: string | null }>> {
  const account = getAdAccount();
  const result = new Map<string, { image_url: string | null; thumbnail_url: string | null }>();

  // getAds exists on AdAccount at runtime but lacks TypeScript declarations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cursor = await (account as any).getAds(
    ["id", "creative{thumbnail_url,image_url}"],
    {
      filtering: [{ field: "id", operator: "IN", value: adIds }],
      limit: 100,
    },
  );

  const processRow = (ad: Record<string, unknown>) => {
    const data = (ad as { _data?: Record<string, unknown> })._data ?? ad;
    const creativeRaw = data.creative as { _data?: Record<string, unknown> } | undefined;
    const creative = (creativeRaw?._data ?? creativeRaw ?? {}) as Record<string, unknown>;
    result.set(String(data.id), {
      image_url: (creative.image_url as string) || null,
      thumbnail_url: (creative.thumbnail_url as string) || null,
    });
  };

  for (;;) {
    for (const raw of cursor) {
      processRow(raw as Record<string, unknown>);
    }

    if (cursor.hasNext()) {
      await cursor.next();
    } else {
      break;
    }
  }

  return result;
}

export type MetaAdInventoryRow = {
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  campaign_effective_status: string;
  adset_id: string;
  adset_name: string;
  adset_status: string;
  adset_effective_status: string;
  ad_id: string;
  ad_name: string;
  ad_status: string;
  ad_effective_status: string;
  destination_url: string | null;
  creative_text: string;
};

function readSdkData(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  const maybeData = value as { _data?: Record<string, unknown> };
  return maybeData?._data ?? (value as Record<string, unknown>);
}

function collectCreativeText(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(collectCreativeText);
  if (typeof value === "object") {
    return Object.values(readSdkData(value)).flatMap(collectCreativeText);
  }
  return [];
}

function extractCreativeDestination(creative: Record<string, unknown>): string | null {
  const direct = creative.link_url ?? creative.object_url;
  if (typeof direct === "string" && direct.length > 0) return direct;

  const objectStorySpec = readSdkData(creative.object_story_spec);
  const linkData = readSdkData(objectStorySpec.link_data);
  const videoData = readSdkData(objectStorySpec.video_data);
  const templateData = readSdkData(objectStorySpec.template_data);
  const linkCta = readSdkData(linkData.call_to_action);
  const linkCtaValue = readSdkData(linkCta.value);
  const videoCta = readSdkData(videoData.call_to_action);
  const videoCtaValue = readSdkData(videoCta.value);

  const nested = linkData.link ?? linkCtaValue.link
    ?? videoCtaValue.link
    ?? templateData.link;
  return typeof nested === "string" && nested.length > 0 ? nested : null;
}

/** Fetch current campaign/ad set/ad inventory for hiring-ad status checks. */
export async function getAdInventory(): Promise<MetaAdInventoryRow[]> {
  return withRetry(() => _getAdInventory(), "ad-inventory");
}

async function _getAdInventory(): Promise<MetaAdInventoryRow[]> {
  const account = getAdAccount();

  // getAds exists on AdAccount at runtime but lacks complete TypeScript declarations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cursor = await (account as any).getAds(
    [
      "id",
      "name",
      "status",
      "effective_status",
      "campaign_id",
      "adset_id",
      "campaign{name,status,effective_status}",
      "adset{name,status,effective_status}",
      "creative{link_url,object_url,title,body}",
    ],
    { limit: 200 },
  );

  const rows: MetaAdInventoryRow[] = [];

  for (;;) {
    for (const raw of cursor) {
      const ad = readSdkData(raw);
      const campaign = readSdkData(ad.campaign);
      const adset = readSdkData(ad.adset);
      const creative = readSdkData(ad.creative);

      rows.push({
        campaign_id: String(ad.campaign_id ?? campaign.id ?? ""),
        campaign_name: String(campaign.name ?? ""),
        campaign_status: String(campaign.status ?? ""),
        campaign_effective_status: String(campaign.effective_status ?? ""),
        adset_id: String(ad.adset_id ?? adset.id ?? ""),
        adset_name: String(adset.name ?? ""),
        adset_status: String(adset.status ?? ""),
        adset_effective_status: String(adset.effective_status ?? ""),
        ad_id: String(ad.id ?? ""),
        ad_name: String(ad.name ?? ""),
        ad_status: String(ad.status ?? ""),
        ad_effective_status: String(ad.effective_status ?? ""),
        destination_url: extractCreativeDestination(creative),
        creative_text: collectCreativeText(creative).join(" "),
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

/**
 * Fetch 7-day rolling frequency by campaign for the last 7 days of the given month.
 * Used by CPA Diagnostic step D1 to check short-term frequency fatigue.
 */
export async function getWeeklyFrequency(
  period: MonthPeriod,
): Promise<CampaignFrequencyRow[]> {
  return withRetry(() => _getWeeklyFrequency(period), "weekly-frequency");
}

async function _getWeeklyFrequency(
  period: MonthPeriod,
): Promise<CampaignFrequencyRow[]> {
  const lastDay = new Date(period.year, period.month, 0).getDate();
  const endDate = `${period.year}-${String(period.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Start 6 days before end to get a 7-day window
  const startObj = new Date(period.year, period.month - 1, lastDay - 6);
  const startDate = `${startObj.getFullYear()}-${String(startObj.getMonth() + 1).padStart(2, "0")}-${String(startObj.getDate()).padStart(2, "0")}`;

  const account = getAdAccount();

  const cursor = await account.getInsights(
    ["campaign_id", "campaign_name", "frequency", "impressions", "reach"],
    {
      time_range: { since: startDate, until: endDate },
      level: "campaign",
    },
  );

  const rows: CampaignFrequencyRow[] = [];

  for (;;) {
    for (const raw of cursor) {
      const row = raw as Record<string, unknown>;
      rows.push({
        campaign_id: String(row.campaign_id ?? ""),
        campaign_name: String(row.campaign_name ?? ""),
        frequency: Number(row.frequency ?? 0),
        impressions: Number(row.impressions ?? 0),
        reach: Number(row.reach ?? 0),
        date_start: startDate,
        date_stop: endDate,
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
