import { gaqlQuery } from "@/lib/services/google-ads";
import {
  getAdInsightsForDateRange,
  getAdInventory,
  getAdSetInsightsForDateRange,
  getInsightsForDateRange,
  type MetaAdInventoryRow,
} from "@/lib/services/meta-ads";
import type { DateRange } from "@/lib/schemas/types";
import type { MetaAdsInsightRow } from "@/lib/schemas/sources/meta-ads";

export const HIRING_REPORT_TIME_ZONE = "America/Denver";

export type HiringPlatform = "Google Ads" | "Meta Ads";
export type HiringStatus = "Active" | "Inactive" | "Needs review";
export type HiringStatusReason =
  | "active_delivery"
  | "inactive_no_delivery"
  | "enabled_no_delivery"
  | "fetch_failed"
  | "unmapped_market"
  | "missing_conversion_tracking";

export type HiringSourceFetch = {
  source: HiringPlatform | "GA4 diagnostics";
  status: "ok" | "warning" | "error" | "skipped";
  fetchedAt: string;
  message?: string;
};

export type HiringPlatformRow = {
  market: string;
  platform: HiringPlatform;
  status: HiringStatus;
  reason: HiringStatusReason;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  hiringConversionRate: "Not tracked" | "No clicks" | "Unknown";
  notes: string;
  sourceIds: string[];
};

export type UnmappedHiringAd = {
  platform: HiringPlatform;
  name: string;
  status: HiringStatus;
  spend: number;
  impressions: number;
  clicks: number;
  destinationUrl: string | null;
  notes: string;
};

export type HiringAdSnapshot = {
  generatedAt: string;
  timeZone: string;
  reportPeriod: DateRange;
  reportPeriodLabel: string;
  reportDueAfter: string;
  requestedMarkets: string[];
  activeMarkets: string[];
  actionSummary: string[];
  rows: HiringPlatformRow[];
  unmappedHiringAds: UnmappedHiringAd[];
  sourceFetches: HiringSourceFetch[];
  reportUrl: string | null;
};

type RawHiringRecord = {
  platform: HiringPlatform;
  market: string | null;
  name: string;
  entityStatus: string;
  eligible: boolean;
  spend: number;
  impressions: number;
  clicks: number;
  destinationUrl: string | null;
  sourceId: string;
  notes: string[];
};

type ScheduleState = {
  lastSuccessPeriodKey?: string;
  lastSentMessageId?: string;
};

const REQUESTED_MARKETS = ["Omak, WA", "St. George, UT", "Pocatello, ID"];
const PLATFORMS: HiringPlatform[] = ["Google Ads", "Meta Ads"];
const HIRING_TERMS = [
  "hiring",
  "driver",
  "drivers",
  "job",
  "jobs",
  "career",
  "careers",
  "employment",
  "apply",
  "intelliapp",
  "recruit",
  "recruiting",
];

const KNOWN_MARKETS: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: "Omak, WA",
    patterns: [/\bomak\b/i],
  },
  {
    label: "St. George, UT",
    patterns: [/\bst\.?\s*george\b/i, /\bstgeo\b/i],
  },
  {
    label: "Pocatello, ID",
    patterns: [/\bpocatello\b/i],
  },
];

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function zonedParts(date: Date, timeZone = HIRING_REPORT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    weekday: weekdays[byType.weekday] ?? 0,
    hour: Number(byType.hour),
    minute: Number(byType.minute),
  };
}

function addDaysToLocalDate(parts: { year: number; month: number; day: number }, days: number): string {
  return ymd(new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days)));
}

export function getPreviousMondaySunday(
  now = new Date(),
  timeZone = HIRING_REPORT_TIME_ZONE,
): { period: DateRange; dueAfter: string; periodKey: string; label: string } {
  const local = zonedParts(now, timeZone);
  const daysSinceMonday = local.weekday === 0 ? 6 : local.weekday - 1;
  const currentMonday = addDaysToLocalDate(local, -daysSinceMonday);
  const currentMondayDate = new Date(`${currentMonday}T00:00:00.000Z`);
  const previousMonday = ymd(new Date(currentMondayDate.getTime() - 7 * 86400000));
  const previousSunday = ymd(new Date(currentMondayDate.getTime() - 1 * 86400000));
  const period = { start: previousMonday, end: previousSunday };
  const dueAfter = `${currentMonday}T09:00:00[${timeZone}]`;
  const periodKey = `${period.start}_to_${period.end}`;
  return {
    period,
    dueAfter,
    periodKey,
    label: `${formatDateLabel(period.start)} - ${formatDateLabel(period.end)}`,
  };
}

export function shouldRunWeeklySnapshot(
  state: ScheduleState,
  options: { now?: Date; force?: boolean } = {},
): { shouldRun: boolean; reason: string; periodKey: string } {
  const now = options.now ?? new Date();
  const schedule = getPreviousMondaySunday(now);
  if (options.force) {
    return { shouldRun: true, reason: "forced", periodKey: schedule.periodKey };
  }

  const local = zonedParts(now);
  const daysSinceMonday = local.weekday === 0 ? 6 : local.weekday - 1;
  const currentMonday = addDaysToLocalDate(local, -daysSinceMonday);
  const dueLocalValue = Date.UTC(
    Number(currentMonday.slice(0, 4)),
    Number(currentMonday.slice(5, 7)) - 1,
    Number(currentMonday.slice(8, 10)),
    9,
    0,
  );
  const nowLocalValue = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);

  if (nowLocalValue < dueLocalValue) {
    return { shouldRun: false, reason: "before Monday 9 AM Mountain Time", periodKey: schedule.periodKey };
  }
  if (state.lastSuccessPeriodKey === schedule.periodKey) {
    return { shouldRun: false, reason: "already sent for report period", periodKey: schedule.periodKey };
  }
  return { shouldRun: true, reason: "due", periodKey: schedule.periodKey };
}

function lowerJoin(values: Array<string | null | undefined>): string {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function hasHiringIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return HIRING_TERMS.some((term) => lower.includes(term));
}

function detectMarket(text: string): string | null {
  const lower = text.toLowerCase();
  for (const market of KNOWN_MARKETS) {
    if (market.patterns.some((pattern) => pattern.test(lower))) return market.label;
  }

  const explicitCityState = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s+(UT|ID|WA|NV|AZ|CO|MT|WY|OR|CA)\b/);
  if (explicitCityState) return `${explicitCityState[1]}, ${explicitCityState[2]}`;
  return null;
}

function numberFrom(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function microsToUsd(value: unknown): number {
  return numberFrom(value) / 1_000_000;
}

function statusIsEnabled(status: string | undefined): boolean {
  const upper = (status ?? "").toUpperCase();
  return upper === "ENABLED" || upper === "ACTIVE";
}

function truncateMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]").slice(0, 260);
}

function readRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function collectUnknownText(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(collectUnknownText);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(collectUnknownText);
  return [];
}

async function fetchGoogleRecords(period: DateRange): Promise<{
  records: RawHiringRecord[];
  fetch: HiringSourceFetch;
}> {
  const fetchedAt = new Date().toISOString();
  const records: RawHiringRecord[] = [];

  const campaignQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM campaign
    WHERE segments.date >= '${period.start}'
      AND segments.date <= '${period.end}'
    ORDER BY metrics.cost_micros DESC
  `;

  const adQuery = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group_ad.ad.id,
      ad_group_ad.status,
      ad_group_ad.ad.name,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM ad_group_ad
    WHERE segments.date >= '${period.start}'
      AND segments.date <= '${period.end}'
    ORDER BY metrics.cost_micros DESC
  `;

  const results = await Promise.allSettled([
    gaqlQuery(campaignQuery),
    gaqlQuery(adQuery),
  ]);

  for (const row of results[0].status === "fulfilled" ? results[0].value : []) {
    const campaign = readRecord(row.campaign);
    const metrics = readRecord(row.metrics);
    const text = lowerJoin([String(campaign.name ?? "")]);
    if (!hasHiringIntent(text)) continue;
    records.push({
      platform: "Google Ads",
      market: detectMarket(String(campaign.name ?? "")),
      name: String(campaign.name ?? "Google Ads campaign"),
      entityStatus: String(campaign.status ?? "UNKNOWN"),
      eligible: statusIsEnabled(String(campaign.status ?? "")),
      spend: microsToUsd(metrics.costMicros ?? metrics.cost_micros),
      impressions: numberFrom(metrics.impressions),
      clicks: numberFrom(metrics.clicks),
      destinationUrl: null,
      sourceId: `campaign:${String(campaign.id ?? "")}`,
      notes: ["Matched by campaign name."],
    });
  }

  if (results[1].status === "fulfilled") {
    for (const row of results[1].value) {
      const campaign = readRecord(row.campaign);
      const adGroup = readRecord(row.adGroup ?? row.ad_group);
      const adGroupAd = readRecord(row.adGroupAd ?? row.ad_group_ad);
      const ad = readRecord(adGroupAd.ad);
      const metrics = readRecord(row.metrics);
      const finalUrls = collectUnknownText(ad.finalUrls ?? ad.final_urls);
      const adText = collectUnknownText(ad.responsiveSearchAd ?? ad.responsive_search_ad);
      const text = [
        String(campaign.name ?? ""),
        String(adGroup.name ?? ""),
        String(ad.name ?? ""),
        ...adText,
        ...finalUrls,
      ].join(" ");
      if (!hasHiringIntent(text)) continue;
      records.push({
        platform: "Google Ads",
        market: detectMarket(text),
        name: [campaign.name, adGroup.name, ad.name].filter(Boolean).join(" / "),
        entityStatus: [
          `campaign=${String(campaign.status ?? "UNKNOWN")}`,
          `ad_group=${String(adGroup.status ?? "UNKNOWN")}`,
          `ad=${String(adGroupAd.status ?? "UNKNOWN")}`,
        ].join("; "),
        eligible:
          statusIsEnabled(String(campaign.status ?? "")) &&
          statusIsEnabled(String(adGroup.status ?? "")) &&
          statusIsEnabled(String(adGroupAd.status ?? "")),
        spend: microsToUsd(metrics.costMicros ?? metrics.cost_micros),
        impressions: numberFrom(metrics.impressions),
        clicks: numberFrom(metrics.clicks),
        destinationUrl: finalUrls[0] ?? null,
        sourceId: `ad:${String(ad.id ?? "")}`,
        notes: ["Matched by ad group, ad text, or final URL."],
      });
    }
  }

  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => truncateMessage(result.reason));

  return {
    records,
    fetch: {
      source: "Google Ads",
      fetchedAt,
      status: failures.length === 0 ? "ok" : records.length > 0 ? "warning" : "error",
      message: failures.length > 0 ? failures.join("; ") : undefined,
    },
  };
}

function metaActionsCount(row: MetaAdsInsightRow, actionIncludes: string[]): number {
  return (row.actions ?? []).reduce((sum, action) => {
    const type = action.action_type.toLowerCase();
    if (actionIncludes.some((needle) => type.includes(needle))) return sum + numberFrom(action.value);
    return sum;
  }, 0);
}

function metricFromMeta(row: MetaAdsInsightRow | undefined) {
  return {
    spend: numberFrom(row?.spend),
    impressions: numberFrom(row?.impressions),
    clicks: numberFrom(row?.clicks),
    leads: row ? metaActionsCount(row, ["lead", "submit_application"]) : 0,
  };
}

async function fetchMetaRecords(period: DateRange): Promise<{
  records: RawHiringRecord[];
  fetch: HiringSourceFetch;
}> {
  const fetchedAt = new Date().toISOString();
  const records: RawHiringRecord[] = [];

  const [campaignResult, adSetResult, adResult, inventoryResult] = await Promise.allSettled([
    getInsightsForDateRange(period),
    getAdSetInsightsForDateRange(period),
    getAdInsightsForDateRange(period),
    getAdInventory(),
  ]);

  const campaigns = campaignResult.status === "fulfilled" ? campaignResult.value : [];
  const adsets = adSetResult.status === "fulfilled" ? adSetResult.value : [];
  const ads = adResult.status === "fulfilled" ? adResult.value : [];
  const inventory = inventoryResult.status === "fulfilled" ? inventoryResult.value : [];

  const campaignMetric = new Map(campaigns.map((row) => [row.campaign_id, row]));
  const adsetMetric = new Map(adsets.map((row) => [row.adset_id ?? "", row]));
  const adMetric = new Map(ads.map((row) => [row.ad_id ?? "", row]));
  const seen = new Set<string>();

  function pushInventory(row: MetaAdInventoryRow) {
    const text = [
      row.campaign_name,
      row.adset_name,
      row.ad_name,
      row.creative_text,
      row.destination_url ?? "",
    ].join(" ");
    if (!hasHiringIntent(text)) return;
    const metric = metricFromMeta(adMetric.get(row.ad_id) ?? adsetMetric.get(row.adset_id) ?? campaignMetric.get(row.campaign_id));
    const key = `meta:${row.ad_id || row.adset_id || row.campaign_id}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push({
      platform: "Meta Ads",
      market: detectMarket(text),
      name: [row.campaign_name, row.adset_name, row.ad_name].filter(Boolean).join(" / "),
      entityStatus: [
        `campaign=${row.campaign_effective_status || row.campaign_status || "UNKNOWN"}`,
        `adset=${row.adset_effective_status || row.adset_status || "UNKNOWN"}`,
        `ad=${row.ad_effective_status || row.ad_status || "UNKNOWN"}`,
      ].join("; "),
      eligible:
        statusIsEnabled(row.campaign_effective_status || row.campaign_status) &&
        statusIsEnabled(row.adset_effective_status || row.adset_status) &&
        statusIsEnabled(row.ad_effective_status || row.ad_status),
      spend: metric.spend,
      impressions: metric.impressions,
      clicks: metric.clicks,
      destinationUrl: row.destination_url,
      sourceId: key,
      notes: metric.leads > 0
        ? [`Meta reported ${metric.leads} lead/application-like actions; verify these map to real hiring applications.`]
        : ["Matched by campaign, ad set, ad, creative text, or destination URL."],
    });
  }

  inventory.forEach(pushInventory);

  for (const row of [...campaigns, ...adsets, ...ads]) {
    const text = [
      row.campaign_name,
      row.adset_name ?? "",
      row.ad_name ?? "",
    ].join(" ");
    if (!hasHiringIntent(text)) continue;
    const id = row.ad_id ?? row.adset_id ?? row.campaign_id;
    const key = `meta:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const metric = metricFromMeta(row);
    records.push({
      platform: "Meta Ads",
      market: detectMarket(text),
      name: [row.campaign_name, row.adset_name, row.ad_name].filter(Boolean).join(" / "),
      entityStatus: String(row.status ?? "UNKNOWN"),
      eligible: statusIsEnabled(row.status),
      spend: metric.spend,
      impressions: metric.impressions,
      clicks: metric.clicks,
      destinationUrl: null,
      sourceId: key,
      notes: ["Matched by insight row name; current effective status unavailable for this row."],
    });
  }

  const failures = [campaignResult, adSetResult, adResult, inventoryResult]
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => truncateMessage(result.reason));

  return {
    records,
    fetch: {
      source: "Meta Ads",
      fetchedAt,
      status: failures.length === 0 ? "ok" : records.length > 0 ? "warning" : "error",
      message: failures.length > 0 ? failures.join("; ") : undefined,
    },
  };
}

function aggregateRows(records: RawHiringRecord[], fetches: HiringSourceFetch[]): HiringPlatformRow[] {
  const rows: HiringPlatformRow[] = [];

  for (const market of REQUESTED_MARKETS) {
    for (const platform of PLATFORMS) {
      const source = fetches.find((fetch) => fetch.source === platform);
      const marketRecords = records.filter((record) => record.platform === platform && record.market === market);

      if (source?.status === "error") {
        rows.push({
          market,
          platform,
          status: "Needs review",
          reason: "fetch_failed",
          spend: null,
          impressions: null,
          clicks: null,
          hiringConversionRate: "Unknown",
          notes: `${platform} fetch failed: ${source.message ?? "unknown error"}`,
          sourceIds: [],
        });
        continue;
      }

      if (marketRecords.length === 0) {
        rows.push({
          market,
          platform,
          status: "Inactive",
          reason: "inactive_no_delivery",
          spend: 0,
          impressions: 0,
          clicks: 0,
          hiringConversionRate: "No clicks",
          notes: `No ${platform} hiring ads matched this market in the report period.`,
          sourceIds: [],
        });
        continue;
      }

      const spend = marketRecords.reduce((sum, record) => sum + record.spend, 0);
      const impressions = marketRecords.reduce((sum, record) => sum + record.impressions, 0);
      const clicks = marketRecords.reduce((sum, record) => sum + record.clicks, 0);
      const hasEligibleDelivery = marketRecords.some((record) => record.eligible && (record.spend > 0 || record.impressions > 0 || record.clicks > 0));
      const anyEligible = marketRecords.some((record) => record.eligible);
      const status: HiringStatus = hasEligibleDelivery ? "Active" : anyEligible ? "Needs review" : "Inactive";
      const reason: HiringStatusReason = hasEligibleDelivery
        ? "active_delivery"
        : anyEligible
          ? "enabled_no_delivery"
          : "inactive_no_delivery";

      rows.push({
        market,
        platform,
        status,
        reason,
        spend,
        impressions,
        clicks,
        hiringConversionRate: clicks > 0 ? "Not tracked" : "No clicks",
        notes: [...new Set([
          reason === "enabled_no_delivery" ? "Enabled but no spend, impressions, or clicks found for the report period." : null,
          ...marketRecords.flatMap((record) => record.notes),
        ].filter(Boolean))].join(" "),
        sourceIds: marketRecords.map((record) => record.sourceId),
      });
    }
  }

  return rows;
}

function buildUnmapped(records: RawHiringRecord[]): UnmappedHiringAd[] {
  return records
    .filter((record) => record.market === null)
    .map((record) => {
      const hasDelivery = record.spend > 0 || record.impressions > 0 || record.clicks > 0;
      return {
        platform: record.platform,
        name: record.name || "Unnamed hiring ad",
        status: record.eligible && hasDelivery ? "Active" : "Needs review",
        spend: record.spend,
        impressions: record.impressions,
        clicks: record.clicks,
        destinationUrl: record.destinationUrl,
        notes: "Hiring ad matched, but the market could not be confidently parsed.",
      };
    });
}

function buildActionSummary(rows: HiringPlatformRow[], unmapped: UnmappedHiringAd[], fetches: HiringSourceFetch[]): string[] {
  const activeMarkets = [...new Set(rows.filter((row) => row.status === "Active").map((row) => row.market))];
  const summary: string[] = [];

  if (activeMarkets.length > 0) {
    summary.push(`${activeMarkets.join(", ")} ${activeMarkets.length === 1 ? "has" : "have"} active hiring ads.`);
  } else {
    summary.push("No requested hiring market has confirmed active ad delivery.");
  }

  const needsReview = rows.filter((row) => row.status === "Needs review");
  if (needsReview.length > 0) {
    summary.push(`${needsReview.length} platform row${needsReview.length === 1 ? "" : "s"} need review before Greg treats the report as final.`);
  }

  if (unmapped.length > 0) {
    summary.push(`${unmapped.length} hiring ad${unmapped.length === 1 ? "" : "s"} matched hiring intent but could not be mapped to a market.`);
  }

  const failedSources = fetches.filter((fetch) => fetch.status === "error");
  if (failedSources.length > 0) {
    summary.push(`Fetch failed for ${failedSources.map((fetch) => fetch.source).join(", ")}.`);
  }

  summary.push("Hiring conversion rate is not tracked unless real application completions are connected to the ad platform.");
  return summary;
}

export async function collectHiringAdSnapshot(
  options: { now?: Date; reportUrl?: string | null } = {},
): Promise<HiringAdSnapshot> {
  const now = options.now ?? new Date();
  const schedule = getPreviousMondaySunday(now);
  const [googleResult, metaResult] = await Promise.allSettled([
    fetchGoogleRecords(schedule.period),
    fetchMetaRecords(schedule.period),
  ]);

  const records: RawHiringRecord[] = [];
  const sourceFetches: HiringSourceFetch[] = [];

  if (googleResult.status === "fulfilled") {
    records.push(...googleResult.value.records);
    sourceFetches.push(googleResult.value.fetch);
  } else {
    sourceFetches.push({
      source: "Google Ads",
      status: "error",
      fetchedAt: new Date().toISOString(),
      message: truncateMessage(googleResult.reason),
    });
  }

  if (metaResult.status === "fulfilled") {
    records.push(...metaResult.value.records);
    sourceFetches.push(metaResult.value.fetch);
  } else {
    sourceFetches.push({
      source: "Meta Ads",
      status: "error",
      fetchedAt: new Date().toISOString(),
      message: truncateMessage(metaResult.reason),
    });
  }

  sourceFetches.push({
    source: "GA4 diagnostics",
    status: "skipped",
    fetchedAt: new Date().toISOString(),
    message: "GA4 is diagnostic only because hiring applications may happen on external systems.",
  });

  const rows = aggregateRows(records, sourceFetches);
  const unmappedHiringAds = buildUnmapped(records);
  const activeMarkets = [...new Set(rows.filter((row) => row.status === "Active").map((row) => row.market))];

  return {
    generatedAt: now.toISOString(),
    timeZone: HIRING_REPORT_TIME_ZONE,
    reportPeriod: schedule.period,
    reportPeriodLabel: schedule.label,
    reportDueAfter: schedule.dueAfter,
    requestedMarkets: REQUESTED_MARKETS,
    activeMarkets,
    actionSummary: buildActionSummary(rows, unmappedHiringAds, sourceFetches),
    rows,
    unmappedHiringAds,
    sourceFetches,
    reportUrl: options.reportUrl ?? null,
  };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function usd(value: number | null): string {
  if (value === null) return "Unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value === 0 ? 0 : 2,
  }).format(value);
}

function integer(value: number | null): string {
  if (value === null) return "Unknown";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function statusClass(status: HiringStatus): string {
  if (status === "Active") return "active";
  if (status === "Inactive") return "inactive";
  return "review";
}

function hasLiveFetch(snapshot: HiringAdSnapshot): boolean {
  return snapshot.sourceFetches.some((fetch) => fetch.status !== "skipped");
}

function activeMarketDisplay(snapshot: HiringAdSnapshot): string {
  return hasLiveFetch(snapshot) ? String(snapshot.activeMarkets.length) : "Pending";
}

function periodSpendDisplay(snapshot: HiringAdSnapshot): string {
  if (!hasLiveFetch(snapshot)) return "Pending";
  return usd(snapshot.rows.reduce((sum, row) => sum + (row.spend ?? 0), 0));
}

function renderRows(rows: HiringPlatformRow[]): string {
  return rows.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.market)}</strong></td>
      <td>${escapeHtml(row.platform)}</td>
      <td><span class="pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td class="right">${escapeHtml(usd(row.spend))}</td>
      <td class="right">${escapeHtml(integer(row.impressions))}</td>
      <td class="right">${escapeHtml(integer(row.clicks))}</td>
      <td>${escapeHtml(row.hiringConversionRate)}</td>
      <td>${escapeHtml(row.notes)}</td>
    </tr>
  `).join("");
}

function emailStatusStyle(status: HiringStatus): string {
  if (status === "Active") return "background:#dcfce7;color:#166534;";
  if (status === "Inactive") return "background:#f4f4f5;color:#52525b;";
  return "background:#fef3c7;color:#92400e;";
}

function renderEmailRows(rows: HiringPlatformRow[]): string {
  const cell = "padding:11px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:13px;line-height:1.35;color:#27272a;";
  const rightCell = `${cell}text-align:right;white-space:nowrap;`;
  return rows.map((row) => `
    <tr>
      <td style="${cell}font-weight:700;">${escapeHtml(row.market)}</td>
      <td style="${cell}">${escapeHtml(row.platform)}</td>
      <td style="${cell}"><span style="display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;${emailStatusStyle(row.status)}">${escapeHtml(row.status)}</span></td>
      <td style="${rightCell}">${escapeHtml(usd(row.spend))}</td>
      <td style="${rightCell}">${escapeHtml(integer(row.impressions))}</td>
      <td style="${rightCell}">${escapeHtml(integer(row.clicks))}</td>
      <td style="${cell}">${escapeHtml(row.hiringConversionRate)}</td>
      <td style="${cell}">${escapeHtml(row.notes)}</td>
    </tr>
  `).join("");
}

export function renderHiringAdsEmail(snapshot: HiringAdSnapshot, aiSummaryHtml?: string): string {
  const lead = snapshot.actionSummary[0] ?? "Hiring ads snapshot generated.";
  const safeReportUrl = safeUrl(snapshot.reportUrl);
  const fullReportLine = snapshot.reportUrl
    ? `<p style="margin:16px 0 0 0;font-size:14px;line-height:1.45;color:#3f3f46;"><a href="${escapeHtml(safeReportUrl ?? "#")}" style="color:#1e6fad;font-weight:700;text-decoration:none;">Open full report</a></p>`
    : `<div style="margin-top:14px;padding:12px;background:#fafafa;border:1px solid #e4e4e7;color:#52525b;font-size:13px;line-height:1.45;">The full HTML report is attached.</div>`;
  const muted = "color:#52525b;font-size:14px;line-height:1.45;";
  const label = "color:#71717a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;";
  const tableHead = "padding:9px 10px;border-bottom:1px solid #d4d4d8;color:#71717a;font-size:11px;font-weight:700;letter-spacing:.7px;text-align:left;text-transform:uppercase;";
  const tableHeadRight = `${tableHead}text-align:right;`;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#18181b;max-width:960px;">
    <div style="color:#1e6fad;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Salt Lake Express</div>
    <h1 style="margin:8px 0 6px 0;font-size:24px;line-height:1.2;color:#18181b;">Weekly Hiring Ads Snapshot</h1>
    <p style="margin:0 0 12px 0;${muted}">Report period: ${escapeHtml(snapshot.reportPeriodLabel)}. Generated ${escapeHtml(snapshot.generatedAt)}.</p>
    <p style="margin:0 0 14px 0;color:#18181b;font-size:15px;line-height:1.45;"><strong>${escapeHtml(lead)}</strong></p>
    ${aiSummaryHtml ? `<div style="margin:14px 0;padding:12px 14px;background:#f3f7fb;border-left:3px solid #1e6fad;color:#3f3f46;font-size:13px;line-height:1.45;">${aiSummaryHtml}</div>` : ""}
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="width:33.333%;padding:13px;border:1px solid #e4e4e7;vertical-align:top;"><div style="${label}">Active markets</div><div style="margin-top:6px;color:#18181b;font-size:20px;font-weight:700;">${escapeHtml(activeMarketDisplay(snapshot))}</div></td>
        <td style="width:33.333%;padding:13px;border:1px solid #e4e4e7;vertical-align:top;"><div style="${label}">Period spend</div><div style="margin-top:6px;color:#18181b;font-size:20px;font-weight:700;">${escapeHtml(periodSpendDisplay(snapshot))}</div></td>
        <td style="width:33.333%;padding:13px;border:1px solid #e4e4e7;vertical-align:top;"><div style="${label}">Hiring conversion rate</div><div style="margin-top:6px;color:#18181b;font-size:20px;font-weight:700;">Not tracked</div></td>
      </tr>
    </table>
    <table style="width:100%;margin-top:14px;border-collapse:collapse;">
      <thead><tr><th style="${tableHead}">Market</th><th style="${tableHead}">Platform</th><th style="${tableHead}">Status</th><th style="${tableHeadRight}">Spend</th><th style="${tableHeadRight}">Shown</th><th style="${tableHeadRight}">Clicks</th><th style="${tableHead}">Tracking</th><th style="${tableHead}">Note</th></tr></thead>
      <tbody>${renderEmailRows(snapshot.rows)}</tbody>
    </table>
    ${snapshot.unmappedHiringAds.length > 0 ? `<div style="margin-top:14px;padding:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;line-height:1.45;">${escapeHtml(snapshot.unmappedHiringAds.length)} unmapped hiring ad${snapshot.unmappedHiringAds.length === 1 ? "" : "s"} need market review. See the full report.</div>` : ""}
    <div style="margin-top:14px;padding:12px;background:#fafafa;border:1px solid #e4e4e7;color:#52525b;font-size:13px;line-height:1.45;">Hiring conversion rate is not available yet because completed hiring applications are not tied back cleanly from Tenstreet/IntelliApp into the ad platforms. Drew is working with Tenstreet to get that sorted out.</div>
    ${fullReportLine}
    </div>
  `;
}

export function renderHiringAdsText(snapshot: HiringAdSnapshot): string {
  const lines = [
    "Weekly Hiring Ads Snapshot",
    `Report period: ${snapshot.reportPeriodLabel}`,
    "",
    snapshot.actionSummary[0] ?? "Hiring ads snapshot generated.",
    "",
    `Active markets: ${activeMarketDisplay(snapshot)}`,
    `Period spend: ${periodSpendDisplay(snapshot)}`,
    "Hiring conversion rate: Not tracked",
    "",
    "Market | Platform | Status | Spend | Shown | Clicks | Tracking | Note",
    ...snapshot.rows.map((row) => [
      row.market,
      row.platform,
      row.status,
      usd(row.spend),
      integer(row.impressions),
      integer(row.clicks),
      row.hiringConversionRate,
      row.notes,
    ].join(" | ")),
    "",
  ];

  if (snapshot.unmappedHiringAds.length > 0) {
    lines.push(`${snapshot.unmappedHiringAds.length} unmapped hiring ad${snapshot.unmappedHiringAds.length === 1 ? "" : "s"} need market review. See the full report.`);
    lines.push("");
  }

  lines.push("Hiring conversion rate is not available yet because completed hiring applications are not tied back cleanly from Tenstreet/IntelliApp into the ad platforms. Drew is working with Tenstreet to get that sorted out.");
  lines.push("The full HTML report is attached.");

  return lines.join("\n");
}

function renderSourceFetches(snapshot: HiringAdSnapshot): string {
  return snapshot.sourceFetches.map((fetch) => `
    <tr>
      <td>${escapeHtml(fetch.source)}</td>
      <td><span class="pill ${fetch.status === "ok" ? "active" : fetch.status === "error" ? "review" : "inactive"}">${escapeHtml(fetch.status)}</span></td>
      <td>${escapeHtml(fetch.fetchedAt)}</td>
      <td>${escapeHtml(fetch.message ?? "")}</td>
    </tr>
  `).join("");
}

function renderUnmapped(snapshot: HiringAdSnapshot): string {
  if (snapshot.unmappedHiringAds.length === 0) {
    return `<p class="muted">No unmapped hiring ads were found.</p>`;
  }
  return `
    <table>
      <thead><tr><th>Platform</th><th>Name</th><th>Status</th><th class="right">Spend</th><th class="right">Shown</th><th class="right">Clicks</th><th>Destination</th><th>Note</th></tr></thead>
      <tbody>
        ${snapshot.unmappedHiringAds.map((ad) => {
          const url = safeUrl(ad.destinationUrl);
          return `
            <tr>
              <td>${escapeHtml(ad.platform)}</td>
              <td><strong>${escapeHtml(ad.name)}</strong></td>
              <td><span class="pill ${statusClass(ad.status)}">${escapeHtml(ad.status)}</span></td>
              <td class="right">${escapeHtml(usd(ad.spend))}</td>
              <td class="right">${escapeHtml(integer(ad.impressions))}</td>
              <td class="right">${escapeHtml(integer(ad.clicks))}</td>
              <td>${url ? `<a href="${escapeHtml(url)}">${escapeHtml(new URL(url).hostname)}</a>` : ""}</td>
              <td>${escapeHtml(ad.notes)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

export function renderHiringAdsFullReport(snapshot: HiringAdSnapshot, aiSummaryHtml?: string): string {
  const activeCards = !hasLiveFetch(snapshot)
    ? `<article class="empty-card"><h3>Waiting for live fetch</h3><p>The Monday runner fills this section with one green card per active hiring market.</p></article>`
    : snapshot.activeMarkets.length > 0
    ? snapshot.activeMarkets.map((market) => {
      const rows = snapshot.rows.filter((row) => row.market === market && row.status === "Active");
      const platforms = rows.map((row) => row.platform).join(", ");
      const spend = rows.reduce((sum, row) => sum + (row.spend ?? 0), 0);
      return `
        <article class="active-card">
          <div class="card-top"><h3>${escapeHtml(market)}</h3><span class="pill active">Active</span></div>
          <p>${escapeHtml(platforms)} ${rows.length === 1 ? "is" : "are"} showing hiring ads.</p>
          <div class="metric"><span>Period spend</span><strong>${escapeHtml(usd(spend))}</strong></div>
        </article>
      `;
    }).join("")
    : `<article class="empty-card"><h3>No confirmed active hiring markets</h3><p>Requested markets are listed below with platform-level status.</p></article>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SLE Hiring Ads Snapshot</title>
  <style>
    body{margin:0;background:#09090b;color:#f4f4f5;font-family:Arial,Helvetica,sans-serif}
    main{max-width:1180px;margin:0 auto;padding:28px}
    header{display:flex;gap:20px;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #27272a;padding-bottom:22px}
    h1,h2,h3{margin:0;color:#fff}h1{font-size:38px}h2{font-size:20px;margin-bottom:12px}h3{font-size:18px}
    p{color:#a1a1aa;line-height:1.55}.eyebrow{color:#f4bd50;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
    .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.stat{border-left:1px solid #27272a;padding-left:18px}.stat span,.metric span{display:block;color:#71717a;font-size:11px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase}.stat strong{display:block;margin-top:6px;font-size:26px}
    section{margin-top:26px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.active-card,.empty-card,.panel{border:1px solid #27272a;background:#18181b;padding:18px}.active-card{border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.08)}.card-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.metric{margin-top:16px}
    table{width:100%;border-collapse:collapse;font-size:14px;background:#111113;border:1px solid #27272a}th{padding:11px;border-bottom:1px solid #27272a;color:#71717a;font-size:11px;letter-spacing:1.2px;text-align:left;text-transform:uppercase}td{padding:13px 11px;border-bottom:1px solid #27272a;vertical-align:top}.right{text-align:right}.muted{color:#71717a}
    .pill{display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700}.active{background:#064e3b;color:#6ee7b7}.inactive{background:#27272a;color:#d4d4d8}.review{background:#78350f;color:#fde68a}
    .summary-list{margin:0;padding-left:20px;color:#e4e4e7}.summary-list li{margin:8px 0}.note{padding:14px;background:#111113;border:1px solid #27272a;color:#d4d4d8}
    a{color:#67e8f9}@media(max-width:760px){main{padding:20px}header{display:block}.stats{grid-template-columns:1fr}.stat{border-left:0;border-top:1px solid #27272a;padding:12px 0 0}table{display:block;overflow-x:auto;white-space:nowrap}}
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="eyebrow">Salt Lake Express</div>
      <h1>Hiring Ads Snapshot</h1>
      <p>Report period: ${escapeHtml(snapshot.reportPeriodLabel)}. Generated ${escapeHtml(snapshot.generatedAt)}. Time zone: ${escapeHtml(snapshot.timeZone)}.</p>
    </div>
    <div class="stats">
      <div class="stat"><span>Active markets</span><strong>${escapeHtml(activeMarketDisplay(snapshot))}</strong></div>
      <div class="stat"><span>Period spend</span><strong>${escapeHtml(periodSpendDisplay(snapshot))}</strong></div>
      <div class="stat"><span>Hiring conversion rate</span><strong>Not tracked</strong></div>
    </div>
  </header>
  <section class="panel">
    <h2>What Changed / Action Needed</h2>
    ${aiSummaryHtml ? `<div class="note">${aiSummaryHtml}</div>` : ""}
    <ul class="summary-list">${snapshot.actionSummary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>
  <section>
    <h2>Active Hiring Markets</h2>
    <div class="cards">${activeCards}</div>
  </section>
  <section>
    <h2>Market Detail</h2>
    <table>
      <thead><tr><th>Market</th><th>Platform</th><th>Status</th><th class="right">Spend</th><th class="right">Shown</th><th class="right">Clicks</th><th>Tracking</th><th>Note</th></tr></thead>
      <tbody>${renderRows(snapshot.rows)}</tbody>
    </table>
  </section>
  <section>
    <h2>Unmapped Hiring Ads</h2>
    ${renderUnmapped(snapshot)}
  </section>
  <section>
    <h2>Source Fetches</h2>
    <table>
      <thead><tr><th>Source</th><th>Status</th><th>Fetched at</th><th>Message</th></tr></thead>
      <tbody>${renderSourceFetches(snapshot)}</tbody>
    </table>
  </section>
  <section class="note">
    Hiring conversion rate stays "Not tracked" unless completed applications are connected to Google Ads or Meta Ads. GA4 website sessions are diagnostic only when ads land on external systems.
  </section>
</main>
</body>
</html>`;
}

export function renderHiringAdsEml(args: {
  from: string;
  to: string;
  cc: string;
  subject: string;
  text: string;
  html: string;
  attachment?: {
    filename: string;
    contentType: string;
    base64: string;
  };
}): string {
  const alternativeBoundary = "sle-hiring-ads-alt";
  const mixedBoundary = "sle-hiring-ads-mixed";
  const wrapBase64 = (value: string) => value.replace(/(.{76})/g, "$1\r\n");
  const alternativePart = [
    `--${alternativeBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    args.text,
    `--${alternativeBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    args.html,
    `--${alternativeBoundary}--`,
  ].join("\r\n");

  const headers = [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Cc: ${args.cc}`,
    `Subject: ${args.subject}`,
    "MIME-Version: 1.0",
  ];

  if (!args.attachment) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      alternativePart,
    ].join("\r\n");
  }

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    alternativePart,
    `--${mixedBoundary}`,
    `Content-Type: ${args.attachment.contentType}; name="${args.attachment.filename}"`,
    `Content-Disposition: attachment; filename="${args.attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(args.attachment.base64),
    `--${mixedBoundary}--`,
  ].join("\r\n");
}
