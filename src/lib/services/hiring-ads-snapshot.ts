import { execFile } from "node:child_process";
import { promisify } from "node:util";
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

const execFileAsync = promisify(execFile);

export type HiringPlatform = "Google Ads" | "Meta Ads";
type HiringMtdPlatformSource = "Google Ads MTD" | "Meta Ads MTD";
export type HiringReportSource = HiringPlatform | HiringMtdPlatformSource | "Indeed sheet" | "GA4 diagnostics";
export type HiringStatus = "Active" | "Inactive" | "Needs review";
export type HiringStatusReason =
  | "active_delivery"
  | "inactive_no_delivery"
  | "enabled_no_delivery"
  | "fetch_failed"
  | "unmapped_market"
  | "missing_conversion_tracking";

export type HiringSourceFetch = {
  source: HiringReportSource;
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
  hiringConversionRate: "Not tracked" | "Unknown";
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

export type IndeedComparisonRow = {
  market: string;
  platform: "Indeed";
  jobType: string;
  status: HiringStatus;
  periodLabel: string;
  spend: number;
  impressions: number;
  clicks: number;
  applyStarts: number;
  applications: number;
  company: string;
  sourceRows: number;
  notes: string;
};

export type HiringAdSnapshot = {
  generatedAt: string;
  timeZone: string;
  reportPosition: string;
  reportPeriod: DateRange;
  reportPeriodLabel: string;
  mtdReportPeriod: DateRange;
  mtdReportPeriodLabel: string;
  reportDueAfter: string;
  requestedMarkets: string[];
  activeMarkets: string[];
  actionSummary: string[];
  rows: HiringPlatformRow[];
  mtdRows: HiringPlatformRow[];
  indeedRows: IndeedComparisonRow[];
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

const REPORT_POSITION = "Driver";
const INDEED_HIRING_SPEND_SHEET_ID = "1cQkl_BYydxT-8NOubOITNo9iN8aqiO-bM-vLZrk09fE";
const INDEED_CURRENT_MONTH_RANGE = "Current Month!A1:AF200";
const GWS_SLE = "/Users/brady/.agents/skills/gws/scripts/gws-sle";
const SOURCE_FRESHNESS_WARNING_DAYS = 14;
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
const NON_MARKET_CITY_WORDS = new Set([...HIRING_TERMS, "all", "sle", "nws"]);
const DRIVER_TERMS = [
  "driver",
  "drivers",
  "cdl",
  "shuttle bus",
  "charter bus",
  "driverapponline",
  "intelliapp",
  "drive for",
];
const DRIVER_GENERIC_HIRING_PATTERNS = [
  /\bs\s*\|\s*hiring\b/i,
  /\bnws\s*\|\s*hiring\b/i,
  /\bnws\s+hiring\b/i,
  /\bhiring\s+lead\s+forms\b/i,
];
const NON_DRIVER_HIRING_TERMS = [
  "technician",
  "mechanic",
  "dispatcher",
  "payroll",
  "customer service",
  "csr",
  "reservation",
  "reservations",
];
const INDEED_REQUIRED_HEADERS = [
  "Source",
  "Job Type",
  "Job status",
  "City",
  "Spend",
  "Impressions",
  "Clicks",
  "Apply starts",
  "Applies",
  "Company name",
  "State/Region",
];

const KNOWN_MARKETS: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: "Omak, WA",
    patterns: [/\bomak\b/i, /\bs\s*\|\s*hiring\b[\s\S]*\bwa\b/i],
  },
  {
    label: "St. George, UT",
    patterns: [/\bst\.?\s*george\b/i, /\bsaint\s+george\b/i, /\bstgeo\b/i],
  },
  {
    label: "Pocatello, ID",
    patterns: [/\bpocatello\b/i, /\bs\s*\|\s*hiring\b[\s\S]*\bid\b/i],
  },
  {
    label: "Great Falls, MT",
    patterns: [/\bgreat\s+falls\b/i],
  },
  {
    label: "Spokane, WA",
    patterns: [/\bspokane\b/i],
  },
  {
    label: "Salt Lake City, UT",
    patterns: [/\bsalt\s+lake\s+city\b/i, /\bslc\b/i, /\bdrivers?\s+(?:wanted|needed)?\s*salt\s+lake\b/i],
  },
  {
    label: "Vernal, UT",
    patterns: [/\bvernal\b/i],
  },
  {
    label: "Logan, UT",
    patterns: [/\blogan\b/i],
  },
  {
    label: "Rexburg, ID",
    patterns: [/\brexburg\b/i],
  },
  {
    label: "Boise, ID",
    patterns: [/\bboise\b/i],
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

export function getMonthToDatePeriod(
  now = new Date(),
  timeZone = HIRING_REPORT_TIME_ZONE,
): { period: DateRange; label: string } {
  const local = zonedParts(now, timeZone);
  const month = String(local.month).padStart(2, "0");
  const day = String(local.day).padStart(2, "0");
  const period = {
    start: `${local.year}-${month}-01`,
    end: `${local.year}-${month}-${day}`,
  };
  return {
    period,
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

function hasDriverHiringIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const hasDriverTerm = DRIVER_TERMS.some((term) => lower.includes(term));
  const hasGenericDriverHiringPattern = DRIVER_GENERIC_HIRING_PATTERNS.some((pattern) => pattern.test(lower));
  const hasNonDriverTerm = NON_DRIVER_HIRING_TERMS.some((term) => lower.includes(term));
  if (hasNonDriverTerm && !hasDriverTerm) return false;
  return hasDriverTerm || hasGenericDriverHiringPattern;
}

function detectMarket(text: string): string | null {
  const lower = text.toLowerCase();
  for (const market of KNOWN_MARKETS) {
    if (market.patterns.some((pattern) => pattern.test(lower))) return market.label;
  }

  const explicitCityState = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s+(UT|ID|WA|NV|AZ|CO|MT|WY|OR|CA)\b/);
  const cityWords = explicitCityState?.[1].toLowerCase().split(/\s+/) ?? [];
  if (explicitCityState && !cityWords.some((word) => NON_MARKET_CITY_WORDS.has(word))) {
    return `${explicitCityState[1]}, ${explicitCityState[2]}`;
  }
  return null;
}

function numberFrom(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function moneyFrom(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[$,]/g, "").trim();
  if (!cleaned) return 0;
  return numberFrom(cleaned);
}

function microsToUsd(value: unknown): number {
  return numberFrom(value) / 1_000_000;
}

function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}

function costPerClick(spend: number | null, clicks: number | null): number | null {
  return safeDivide(spend, clicks);
}

function costPerThousandImpressions(spend: number | null, impressions: number | null): number | null {
  const value = safeDivide(spend, impressions);
  return value === null ? null : value * 1000;
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

function buildGoogleRecords(
  campaignRows: Record<string, unknown>[],
  adRows: Record<string, unknown>[],
): RawHiringRecord[] {
  const records: RawHiringRecord[] = [];
  const campaignsWithMatchedAds = new Set<string>();

  for (const row of adRows) {
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
    if (!hasHiringIntent(text) || !hasDriverHiringIntent(text)) continue;
    campaignsWithMatchedAds.add(String(campaign.id ?? ""));
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

  for (const row of campaignRows) {
    const campaign = readRecord(row.campaign);
    const campaignId = String(campaign.id ?? "");
    if (campaignsWithMatchedAds.has(campaignId)) continue;
    const metrics = readRecord(row.metrics);
    const text = lowerJoin([String(campaign.name ?? "")]);
    if (!hasHiringIntent(text) || !hasDriverHiringIntent(text)) continue;
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
      sourceId: `campaign:${campaignId}`,
      notes: ["Matched by campaign name."],
    });
  }

  return records;
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

  records.push(...buildGoogleRecords(
    results[0].status === "fulfilled" ? results[0].value : [],
    results[1].status === "fulfilled" ? results[1].value : [],
  ));

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
    if (!hasHiringIntent(text) || !hasDriverHiringIntent(text)) return;
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
    if (!hasHiringIntent(text) || !hasDriverHiringIntent(text)) continue;
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

function parseGwsJson(stdout: string): unknown {
  const start = stdout.indexOf("{");
  if (start < 0) throw new Error("gws did not return JSON");
  return JSON.parse(stdout.slice(start));
}

function sheetCell(row: string[], headers: Map<string, number>, name: string): string {
  const index = headers.get(name.toLowerCase());
  return index === undefined ? "" : row[index] ?? "";
}

function cityMarket(city: string, state: string): string | null {
  const normalizedState = state
    .replace("Washington State", "WA")
    .replace("Idaho", "ID")
    .replace("Utah", "UT");
  return detectMarket(`${city}, ${normalizedState}`) ?? detectMarket(city);
}

function aggregateIndeedRows(rows: IndeedComparisonRow[]): IndeedComparisonRow[] {
  const groups = new Map<string, IndeedComparisonRow[]>();
  for (const row of rows) {
    const key = `${row.market}|${row.company}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    const spend = group.reduce((sum, row) => sum + row.spend, 0);
    const impressions = group.reduce((sum, row) => sum + row.impressions, 0);
    const clicks = group.reduce((sum, row) => sum + row.clicks, 0);
    const applyStarts = group.reduce((sum, row) => sum + row.applyStarts, 0);
    const applications = group.reduce((sum, row) => sum + row.applications, 0);
    const isOpen = group.some((row) => row.status === "Active");
    const status: HiringStatus = isOpen ? "Active" : "Inactive";
    return {
      ...first,
      status,
      spend,
      impressions,
      clicks,
      applyStarts,
      applications,
      sourceRows: group.length,
      notes: group.length === 1
        ? first.notes
        : `${group.length} ${REPORT_POSITION.toLowerCase()} rows combined from Greg's Indeed current-month sheet.`,
    };
  }).sort((a, b) => {
    const aRequested = REQUESTED_MARKETS.indexOf(a.market);
    const bRequested = REQUESTED_MARKETS.indexOf(b.market);
    if (aRequested !== bRequested) return (aRequested < 0 ? 999 : aRequested) - (bRequested < 0 ? 999 : bRequested);
    return b.spend - a.spend;
  });
}

function gwsEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: "/Users/brady",
    PATH: "/Users/brady/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  };
}

async function fetchIndeedSheetMetadata(): Promise<{ modifiedTime?: string; lastModifiedBy?: string }> {
  const { stdout } = await execFileAsync(GWS_SLE, [
    "drive",
    "files",
    "get",
    "--params",
    JSON.stringify({
      fileId: INDEED_HIRING_SPEND_SHEET_ID,
      fields: "modifiedTime,lastModifyingUser(emailAddress,displayName)",
    }),
  ], {
    env: gwsEnv(),
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });
  const parsed = parseGwsJson(stdout) as {
    modifiedTime?: string;
    lastModifyingUser?: { emailAddress?: string; displayName?: string };
  };
  return {
    modifiedTime: parsed.modifiedTime,
    lastModifiedBy: parsed.lastModifyingUser?.emailAddress ?? parsed.lastModifyingUser?.displayName,
  };
}

function sourceFreshnessWarning(modifiedTime: string | undefined, now = new Date()): string | null {
  if (!modifiedTime) return null;
  const modified = Date.parse(modifiedTime);
  if (!Number.isFinite(modified)) return null;
  const ageDays = (now.getTime() - modified) / 86400000;
  if (ageDays <= SOURCE_FRESHNESS_WARNING_DAYS) return null;
  return `Sheet has not been modified for ${Math.floor(ageDays)} days.`;
}

async function fetchIndeedRows(): Promise<{
  rows: IndeedComparisonRow[];
  fetch: HiringSourceFetch;
}> {
  const fetchedAt = new Date().toISOString();
  try {
    const [valuesResult, metadataResult] = await Promise.allSettled([
      execFileAsync(GWS_SLE, [
        "sheets",
        "spreadsheets",
        "values",
        "get",
        "--params",
        JSON.stringify({
          spreadsheetId: INDEED_HIRING_SPEND_SHEET_ID,
          range: INDEED_CURRENT_MONTH_RANGE,
        }),
      ], {
        env: gwsEnv(),
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 3,
      }),
      fetchIndeedSheetMetadata(),
    ]);

    if (valuesResult.status === "rejected") throw valuesResult.reason;

    const metadata = metadataResult.status === "fulfilled" ? metadataResult.value : {};
    const staleWarning = sourceFreshnessWarning(metadata.modifiedTime);
    const metadataNote = metadata.modifiedTime
      ? `Sheet modified ${metadata.modifiedTime}${metadata.lastModifiedBy ? ` by ${metadata.lastModifiedBy}` : ""}.`
      : "Sheet modified time unavailable.";
    const parsed = parseGwsJson(valuesResult.value.stdout) as { values?: string[][] };
    const values = parsed.values ?? [];
    const [headerRow, ...bodyRows] = values;
    if (!headerRow) {
      return {
        rows: [],
        fetch: {
          source: "Indeed sheet",
          status: "warning",
          fetchedAt,
          message: `Google Sheet was readable but empty. ${metadataNote}`,
        },
      };
    }

    const headers = new Map(headerRow.map((value, index) => [value.toLowerCase(), index]));
    const missingHeaders = INDEED_REQUIRED_HEADERS.filter((header) => !headers.has(header.toLowerCase()));
    if (missingHeaders.length > 0) {
      return {
        rows: [],
        fetch: {
          source: "Indeed sheet",
          status: "warning",
          fetchedAt,
          message: `Greg's sheet is missing expected columns: ${missingHeaders.join(", ")}. ${metadataNote}`,
        },
      };
    }

    const rows = bodyRows.flatMap((row): IndeedComparisonRow[] => {
      const source = sheetCell(row, headers, "Source");
      const jobType = sheetCell(row, headers, "Job Type");
      const job = sheetCell(row, headers, "Job");
      const city = sheetCell(row, headers, "City");
      const state = sheetCell(row, headers, "State/Region");
      const market = cityMarket(city, state);
      if (source.toLowerCase() !== "indeed") return [];
      if (!hasDriverHiringIntent(`${jobType} ${job}`)) return [];
      if (!market) return [];

      return [{
        market,
        platform: "Indeed",
        jobType: jobType || REPORT_POSITION,
        status: sheetCell(row, headers, "Job status").toLowerCase() === "open" ? "Active" : "Inactive",
        periodLabel: "Current month from Greg's Indeed sheet",
        spend: moneyFrom(sheetCell(row, headers, "Spend")),
        impressions: numberFrom(sheetCell(row, headers, "Impressions")),
        clicks: numberFrom(sheetCell(row, headers, "Clicks")),
        applyStarts: numberFrom(sheetCell(row, headers, "Apply starts")),
        applications: numberFrom(sheetCell(row, headers, "Applies")),
        company: sheetCell(row, headers, "Company name") || "Unknown",
        sourceRows: 1,
        notes: "Indeed current-month totals. This does not use the weekly Google/Meta report window.",
      }];
    });
    const aggregatedRows = aggregateIndeedRows(rows);
    const warnings = [
      rows.length === 0 ? `No ${REPORT_POSITION.toLowerCase()} Indeed rows were found in Current Month.` : null,
      staleWarning,
      metadataResult.status === "rejected" ? `Could not read sheet modified time: ${truncateMessage(metadataResult.reason)}` : null,
    ].filter(Boolean);

    return {
      rows: aggregatedRows,
      fetch: {
        source: "Indeed sheet",
        status: warnings.length > 0 ? "warning" : "ok",
        fetchedAt,
        message: `Read ${rows.length} ${REPORT_POSITION.toLowerCase()} rows from Weekly Report_Hiring Spend / Current Month. ${metadataNote}${warnings.length > 0 ? ` ${warnings.join(" ")}` : ""}`,
      },
    };
  } catch (err) {
    return {
      rows: [],
      fetch: {
        source: "Indeed sheet",
        status: "warning",
        fetchedAt,
        message: `Could not read Greg's Indeed spend sheet: ${truncateMessage(err)}`,
      },
    };
  }
}

function aggregateRows(records: RawHiringRecord[], fetches: HiringSourceFetch[]): HiringPlatformRow[] {
  const rows: HiringPlatformRow[] = [];
  const detectedMarkets = records
    .filter((record) => record.eligible && (record.spend > 0 || record.impressions > 0 || record.clicks > 0))
    .map((record) => record.market)
    .filter((market): market is string => market !== null)
    .filter((market) => !REQUESTED_MARKETS.includes(market));
  const markets = [...REQUESTED_MARKETS, ...new Set(detectedMarkets)];

  for (const market of markets) {
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
          hiringConversionRate: "Not tracked",
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
        hiringConversionRate: "Not tracked",
        notes: [...new Set([
          reason === "enabled_no_delivery" ? "Enabled but no spend, impressions, or clicks found for the report period." : null,
          reason === "inactive_no_delivery" ? "Matched hiring ads exist, but none are eligible to serve now." : null,
          ...marketRecords.flatMap((record) => record.notes),
        ].filter(Boolean))].join(" "),
        sourceIds: marketRecords.map((record) => record.sourceId),
      });
    }
  }

  return rows;
}

export const __hiringAdsSnapshotTest = {
  aggregateRows,
  buildGoogleRecords,
  detectMarket,
  hasDriverHiringIntent,
};

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
  const reviewMarkets = [...new Set(rows.filter((row) => row.status === "Needs review").map((row) => row.market))];
  const summary: string[] = [];

  if (reviewMarkets.length > 0 && activeMarkets.length > 0) {
    summary.push(`${formatMarketList(reviewMarkets)} ${reviewMarkets.length === 1 ? "needs" : "need"} review. ${formatMarketList(activeMarkets)} ${activeMarkets.length === 1 ? "has" : "have"} active hiring ads.`);
  } else if (reviewMarkets.length > 0) {
    summary.push(`${formatMarketList(reviewMarkets)} ${reviewMarkets.length === 1 ? "needs" : "need"} review. No requested hiring market has confirmed active ad delivery.`);
  } else if (activeMarkets.length > 0) {
    summary.push(`${activeMarkets.join(", ")} ${activeMarkets.length === 1 ? "has" : "have"} active hiring ads.`);
  } else {
    summary.push("No requested hiring market has confirmed active ad delivery.");
  }

  const needsReview = rows.filter((row) => row.status === "Needs review");
  if (needsReview.length > 0) {
    summary.push(`${needsReview.length} platform row${needsReview.length === 1 ? "" : "s"} ${needsReview.length === 1 ? "needs" : "need"} review before Greg treats the report as final.`);
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
  const mtdSchedule = getMonthToDatePeriod(now);
  const [googleResult, metaResult, googleMtdResult, metaMtdResult, indeedResult] = await Promise.allSettled([
    fetchGoogleRecords(schedule.period),
    fetchMetaRecords(schedule.period),
    fetchGoogleRecords(mtdSchedule.period),
    fetchMetaRecords(mtdSchedule.period),
    fetchIndeedRows(),
  ]);

  const records: RawHiringRecord[] = [];
  const mtdRecords: RawHiringRecord[] = [];
  let indeedRows: IndeedComparisonRow[] = [];
  const sourceFetches: HiringSourceFetch[] = [];
  const mtdFetches: HiringSourceFetch[] = [];

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

  if (googleMtdResult.status === "fulfilled") {
    mtdRecords.push(...googleMtdResult.value.records);
    mtdFetches.push(googleMtdResult.value.fetch);
    sourceFetches.push({
      ...googleMtdResult.value.fetch,
      source: "Google Ads MTD",
      message: googleMtdResult.value.fetch.message ?? `Month-to-date window: ${mtdSchedule.label}.`,
    });
  } else {
    const fetch: HiringSourceFetch = {
      source: "Google Ads",
      status: "error",
      fetchedAt: new Date().toISOString(),
      message: truncateMessage(googleMtdResult.reason),
    };
    mtdFetches.push(fetch);
    sourceFetches.push({ ...fetch, source: "Google Ads MTD" });
  }

  if (metaMtdResult.status === "fulfilled") {
    mtdRecords.push(...metaMtdResult.value.records);
    mtdFetches.push(metaMtdResult.value.fetch);
    sourceFetches.push({
      ...metaMtdResult.value.fetch,
      source: "Meta Ads MTD",
      message: metaMtdResult.value.fetch.message ?? `Month-to-date window: ${mtdSchedule.label}.`,
    });
  } else {
    const fetch: HiringSourceFetch = {
      source: "Meta Ads",
      status: "error",
      fetchedAt: new Date().toISOString(),
      message: truncateMessage(metaMtdResult.reason),
    };
    mtdFetches.push(fetch);
    sourceFetches.push({ ...fetch, source: "Meta Ads MTD" });
  }

  if (indeedResult.status === "fulfilled") {
    indeedRows = indeedResult.value.rows;
    sourceFetches.push(indeedResult.value.fetch);
  } else {
    sourceFetches.push({
      source: "Indeed sheet",
      status: "warning",
      fetchedAt: new Date().toISOString(),
      message: truncateMessage(indeedResult.reason),
    });
  }

  sourceFetches.push({
    source: "GA4 diagnostics",
    status: "skipped",
    fetchedAt: new Date().toISOString(),
    message: "GA4 is diagnostic only because hiring applications may happen on external systems.",
  });

  const rows = aggregateRows(records, sourceFetches);
  const mtdRows = aggregateRows(mtdRecords, mtdFetches);
  const unmappedHiringAds = buildUnmapped(records);
  const activeMarkets = [...new Set(rows.filter((row) => row.status === "Active").map((row) => row.market))];

  return {
    generatedAt: now.toISOString(),
    timeZone: HIRING_REPORT_TIME_ZONE,
    reportPosition: REPORT_POSITION,
    reportPeriod: schedule.period,
    reportPeriodLabel: schedule.label,
    mtdReportPeriod: mtdSchedule.period,
    mtdReportPeriodLabel: mtdSchedule.label,
    reportDueAfter: schedule.dueAfter,
    requestedMarkets: REQUESTED_MARKETS,
    activeMarkets,
    actionSummary: buildActionSummary(rows, unmappedHiringAds, sourceFetches),
    rows,
    mtdRows,
    indeedRows,
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

function formatMarketList(markets: string[]): string {
  if (markets.length <= 2) return markets.join(" and ");
  return `${markets.slice(0, -1).join(", ")}, and ${markets[markets.length - 1]}`;
}

function hasLiveFetch(snapshot: HiringAdSnapshot): boolean {
  return snapshot.sourceFetches.some((fetch) => fetch.status !== "skipped");
}

function activeMarketDisplay(snapshot: HiringAdSnapshot): string {
  return hasLiveFetch(snapshot) ? String(snapshot.activeMarkets.length) : "Pending";
}

function mtdGoogleMetaSpendDisplay(snapshot: HiringAdSnapshot): string {
  if (!hasLiveFetch(snapshot)) return "Pending";
  return usd(sumNullable(snapshot.mtdRows, (row) => row.spend));
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
      <td class="right">${escapeHtml(usd(costPerClick(row.spend, row.clicks)))}</td>
      <td class="right">${escapeHtml(usd(costPerThousandImpressions(row.spend, row.impressions)))}</td>
      <td>${escapeHtml(row.hiringConversionRate)}</td>
      <td>${escapeHtml(row.notes)}</td>
    </tr>
  `).join("");
}

function sumNullable(rows: HiringPlatformRow[], pick: (row: HiringPlatformRow) => number | null): number | null {
  return rows.some((row) => pick(row) === null) ? null : rows.reduce((sum, row) => sum + (pick(row) ?? 0), 0);
}

function averageMtdCostPerClickDisplay(snapshot: HiringAdSnapshot): string {
  if (!hasLiveFetch(snapshot)) return "Pending";
  return usd(costPerClick(
    sumNullable(snapshot.mtdRows, (row) => row.spend),
    sumNullable(snapshot.mtdRows, (row) => row.clicks),
  ));
}

function visibleIndeedRows(snapshot: HiringAdSnapshot): IndeedComparisonRow[] {
  const markets = new Set(comparisonMarkets(snapshot, false));
  return snapshot.indeedRows.filter((row) => markets.has(row.market));
}

function mtdIndeedSpendDisplay(snapshot: HiringAdSnapshot): string {
  const rows = visibleIndeedRows(snapshot);
  if (rows.length === 0) return "Unknown";
  return usd(rows.reduce((sum, row) => sum + row.spend, 0));
}

function activeUnmappedAds(snapshot: HiringAdSnapshot): UnmappedHiringAd[] {
  return snapshot.unmappedHiringAds.filter((ad) => ad.status === "Active");
}

function statusForRows(rows: HiringPlatformRow[]): HiringStatus {
  if (rows.some((row) => row.status === "Active")) return "Active";
  if (rows.some((row) => row.status === "Needs review")) return "Needs review";
  return "Inactive";
}

function visibleEmailMarkets(snapshot: HiringAdSnapshot): string[] {
  return [
    ...snapshot.requestedMarkets,
    ...snapshot.activeMarkets.filter((market) => !snapshot.requestedMarkets.includes(market)),
  ];
}

function comparisonMarkets(snapshot: HiringAdSnapshot, includeAllIndeed: boolean): string[] {
  return [
    ...visibleEmailMarkets(snapshot),
    ...(includeAllIndeed ? snapshot.indeedRows.map((row) => row.market) : []),
  ].filter((market, index, markets) => markets.indexOf(market) === index);
}

function googleMetaMarketMetrics(snapshot: HiringAdSnapshot, market: string, period: "weekly" | "mtd" = "weekly") {
  const sourceRows = period === "mtd" ? snapshot.mtdRows : snapshot.rows;
  const rows = sourceRows.filter((row) => row.market === market);
  const spend = sumNullable(rows, (row) => row.spend);
  const impressions = sumNullable(rows, (row) => row.impressions);
  const clicks = sumNullable(rows, (row) => row.clicks);
  return {
    status: statusForRows(rows),
    spend,
    impressions,
    clicks,
    cpc: costPerClick(spend, clicks),
    cpm: costPerThousandImpressions(spend, impressions),
  };
}

function indeedMarketMetrics(snapshot: HiringAdSnapshot, market: string) {
  const rows = snapshot.indeedRows.filter((row) => row.market === market);
  if (rows.length === 0) {
    return {
      status: "Inactive" as HiringStatus,
      spend: null,
      impressions: null,
      clicks: null,
      applications: null,
      cpc: null,
      cpm: null,
      cpa: null,
    };
  }

  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const applications = rows.reduce((sum, row) => sum + row.applications, 0);
  const status: HiringStatus = rows.some((row) => row.status === "Active") ? "Active" : "Inactive";
  return {
    status,
    spend,
    impressions,
    clicks,
    applications,
    cpc: costPerClick(spend, clicks),
    cpm: costPerThousandImpressions(spend, impressions),
    cpa: safeDivide(spend, applications),
  };
}

function indeedApplicationsDisplay(snapshot: HiringAdSnapshot): string {
  const rows = visibleIndeedRows(snapshot);
  if (rows.length === 0) return "Unknown";
  return integer(rows.reduce((sum, row) => sum + row.applications, 0));
}

function averageIndeedCpaDisplay(snapshot: HiringAdSnapshot): string {
  const rows = visibleIndeedRows(snapshot);
  if (rows.length === 0) return "Unknown";
  const spend = rows.reduce((sum, row) => sum + row.spend, 0);
  const applications = rows.reduce((sum, row) => sum + row.applications, 0);
  return usd(safeDivide(spend, applications));
}

function platformMarketMetrics(
  snapshot: HiringAdSnapshot,
  market: string,
  platform: HiringPlatform,
  period: "weekly" | "mtd" = "weekly",
) {
  const sourceRows = period === "mtd" ? snapshot.mtdRows : snapshot.rows;
  const rows = sourceRows.filter((row) => row.market === market && row.platform === platform);
  const spend = sumNullable(rows, (row) => row.spend);
  const impressions = sumNullable(rows, (row) => row.impressions);
  const clicks = sumNullable(rows, (row) => row.clicks);
  return {
    status: statusForRows(rows),
    spend,
    impressions,
    clicks,
    cpc: costPerClick(spend, clicks),
    cpm: costPerThousandImpressions(spend, impressions),
  };
}

function mtdGoogleSpendDisplay(snapshot: HiringAdSnapshot): string {
  if (!hasLiveFetch(snapshot)) return "Pending";
  const rows = snapshot.mtdRows.filter((row) => row.platform === "Google Ads" && visibleEmailMarkets(snapshot).includes(row.market));
  return usd(sumNullable(rows, (row) => row.spend));
}

function blankIfNull(value: number | null, format: (input: number) => string): string {
  return value === null ? "" : format(value);
}

function htmlValue(value: string): string {
  return value === "" ? "&nbsp;" : escapeHtml(value);
}

function renderEmailMetric(labelText: string, value: string, note: string, highlight = false): string {
  const background = highlight ? "#eff6ff" : "#f8fafc";
  const border = highlight ? "#bfdbfe" : "#e2e8f0";
  const labelColor = highlight ? "#1e3a8a" : "#64748b";
  return `
    <td style="width:25%;padding:0 8px 0 0;vertical-align:top;">
      <div style="padding:12px 13px;background:${background};border:1px solid ${border};border-radius:10px;">
        <div style="color:${labelColor};font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;">${escapeHtml(labelText)}</div>
        <div style="margin-top:6px;color:#0f172a;font-size:22px;line-height:1.15;font-weight:800;">${htmlValue(value)}</div>
        <div style="margin-top:4px;color:#64748b;font-size:12px;line-height:1.35;">${htmlValue(note)}</div>
      </div>
    </td>
  `;
}

function renderEmailMarketEconomics(snapshot: HiringAdSnapshot): string {
  const markets = comparisonMarkets(snapshot, false);
  if (markets.length === 0) return "";

  return `
    <div style="margin-top:24px;">
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <tr>
          <td style="color:#334155;font-size:12px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;">Market economics</td>
        </tr>
      </table>

      <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #dbe4ee;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="width:16%;padding:10px 9px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Market</td>
          <td style="width:42%;padding:10px 9px;background:#eff6ff;color:#1e3a8a;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Indeed MTD</td>
          <td style="width:42%;padding:10px 9px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Google MTD</td>
        </tr>
        ${markets.map((market) => {
          const indeed = indeedMarketMetrics(snapshot, market);
          const google = platformMarketMetrics(snapshot, market, "Google Ads", "mtd");
          return `
            <tr>
              <td style="padding:12px 9px;border-top:1px solid #e2e8f0;color:#0f172a;font-size:13px;line-height:1.35;font-weight:800;">${escapeHtml(market)}</td>
              <td style="padding:12px 9px;border-top:1px solid #bfdbfe;background:#eff6ff;color:#0f172a;font-size:12px;line-height:1.45;">
                Spend: <strong>${htmlValue(blankIfNull(indeed.spend, usd))}</strong><br>
                Clicks: ${htmlValue(blankIfNull(indeed.clicks, integer))} · CPC: ${htmlValue(blankIfNull(indeed.cpc, usd))}<br>
                Apps: ${htmlValue(blankIfNull(indeed.applications, integer))} · CPA: <strong>${htmlValue(blankIfNull(indeed.cpa, usd))}</strong>
              </td>
              <td style="padding:12px 9px;border-top:1px solid #e2e8f0;color:#334155;font-size:12px;line-height:1.45;">
                Spend: <strong>${htmlValue(blankIfNull(google.spend, usd))}</strong><br>
                Clicks: ${htmlValue(blankIfNull(google.clicks, integer))} · CPC: ${htmlValue(blankIfNull(google.cpc, usd))}<br>
                Apps: &nbsp; · CPA: &nbsp;
              </td>
            </tr>
          `;
        }).join("")}
      </table>
    </div>
  `;
}

function googleWeeklyStatus(row: HiringPlatformRow | undefined): { label: string; color: string } {
  if (!row) return { label: "Inactive", color: "#52525b" };
  if (row.status === "Active") return { label: "Delivering", color: "#166534" };
  if (row.reason === "enabled_no_delivery" || row.reason === "fetch_failed") {
    return { label: "Review", color: "#9a3412" };
  }
  return { label: row.status, color: row.status === "Inactive" ? "#52525b" : "#92400e" };
}

function weeklyCpcDisplay(row: HiringPlatformRow | undefined): string {
  if (!row) return "No delivery";
  if (row.spend === 0 && row.impressions === 0 && row.clicks === 0) return "No delivery";
  return metricUsd(costPerClick(row.spend, row.clicks));
}

function weeklyUsdDisplay(row: HiringPlatformRow | undefined, pick: (row: HiringPlatformRow) => number | null): string {
  if (!row) return "$0";
  return usd(pick(row));
}

function weeklyIntegerDisplay(row: HiringPlatformRow | undefined, pick: (row: HiringPlatformRow) => number | null): string {
  if (!row) return "0";
  return integer(pick(row));
}

function renderEmailWeeklyGoogleCheck(snapshot: HiringAdSnapshot): string {
  if (!hasLiveFetch(snapshot)) {
    return `
      <div style="padding:15px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#475569;font-size:14px;line-height:1.45;">
        Live ad-platform data has not been fetched yet.
      </div>
    `;
  }

  return `
    <div style="margin-top:22px;">
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <tr>
          <td style="color:#334155;font-size:12px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;">Weekly Google check</td>
          <td style="text-align:right;color:#64748b;font-size:12px;line-height:1.4;">${escapeHtml(snapshot.reportPeriodLabel)}</td>
        </tr>
      </table>

      <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #dbe4ee;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:10px 9px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Market</td>
          <td style="padding:10px 9px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Spend</td>
          <td style="padding:10px 9px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Shown</td>
          <td style="padding:10px 9px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Clicks</td>
          <td style="padding:10px 9px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">CPC</td>
          <td style="padding:10px 9px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Status</td>
        </tr>
        ${visibleEmailMarkets(snapshot).map((market) => {
        const google = snapshot.rows.find((row) => row.market === market && row.platform === "Google Ads");
        const status = googleWeeklyStatus(google);
        return `
          <tr>
            <td style="padding:11px 9px;border-top:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:800;">${escapeHtml(market.replace(/, (UT|ID|WA|MT)$/, ""))}</td>
            <td style="padding:11px 9px;border-top:1px solid #e2e8f0;color:#334155;font-size:13px;">${escapeHtml(weeklyUsdDisplay(google, (row) => row.spend))}</td>
            <td style="padding:11px 9px;border-top:1px solid #e2e8f0;color:#334155;font-size:13px;">${escapeHtml(weeklyIntegerDisplay(google, (row) => row.impressions))}</td>
            <td style="padding:11px 9px;border-top:1px solid #e2e8f0;color:#334155;font-size:13px;">${escapeHtml(weeklyIntegerDisplay(google, (row) => row.clicks))}</td>
            <td style="padding:11px 9px;border-top:1px solid #e2e8f0;color:#334155;font-size:13px;">${escapeHtml(weeklyCpcDisplay(google))}</td>
            <td style="padding:11px 9px;border-top:1px solid #e2e8f0;color:${status.color};font-size:13px;font-weight:800;">${escapeHtml(status.label)}</td>
          </tr>
        `;
      }).join("")}
      </table>
      ${renderEmailMetaNote(snapshot)}
    </div>
  `;
}

function metricUsd(value: number | null, emptyLabel = "Unknown"): string {
  return value === null ? emptyLabel : usd(value);
}

function renderEmailMetaNote(snapshot: HiringAdSnapshot): string {
  const activeMarkets = visibleEmailMarkets(snapshot).filter((market) => {
    const meta = snapshot.rows.find((row) => row.market === market && row.platform === "Meta Ads");
    return meta?.status === "Active";
  });
  const note = activeMarkets.length > 0
    ? `Meta is currently running in ${formatMarketList(activeMarkets)}.`
    : "Meta is not currently running in these requested markets.";

  return `
    <div style="margin-top:9px;color:#64748b;font-size:12px;line-height:1.45;">${escapeHtml(note)}</div>
  `;
}

function emailNeedsAttentionRows(snapshot: HiringAdSnapshot): Array<{ label: string; body: string }> {
  const rows: Array<{ label: string; body: string }> = [];

  visibleEmailMarkets(snapshot).forEach((market) => {
    const google = snapshot.rows.find((row) => row.market === market && row.platform === "Google Ads");
    if (google?.reason === "enabled_no_delivery") {
      rows.push({
        label: market,
        body: "Google is enabled but had no weekly delivery. Review setup before treating the market as covered.",
      });
    }
  });

  const sourceFailures = snapshot.sourceFetches.filter((fetch) => fetch.status === "error");
  sourceFailures.forEach((fetch) => {
    rows.push({
      label: fetch.source,
      body: fetch.message ?? "Source fetch failed.",
    });
  });

  const activeUnmapped = activeUnmappedAds(snapshot);
  if (activeUnmapped.length > 0) {
    rows.push({
      label: "Market review",
      body: `${activeUnmapped.length} active hiring ad${activeUnmapped.length === 1 ? "" : "s"} could not be assigned to a market. The full report has the ad name before anyone changes it.`,
    });
  }

  return rows;
}

function renderEmailNeedsAttention(snapshot: HiringAdSnapshot): string {
  const rows = emailNeedsAttentionRows(snapshot);
  if (rows.length === 0) return "";

  return `
    <div style="margin-top:24px;">
      <div style="margin-bottom:10px;color:#334155;font-size:12px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;">Needs attention</div>
      <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #dbe4ee;border-radius:10px;overflow:hidden;">
        ${rows.map((row, index) => `
          <tr>
            <td style="width:30%;padding:12px 13px;background:#f8fafc;${index === rows.length - 1 ? "" : "border-bottom:1px solid #e2e8f0;"}color:#0f172a;font-size:13px;line-height:1.35;font-weight:800;">${escapeHtml(row.label)}</td>
            <td style="padding:12px 13px;background:#ffffff;${index === rows.length - 1 ? "" : "border-bottom:1px solid #e2e8f0;"}color:#334155;font-size:13px;line-height:1.4;">${escapeHtml(row.body)}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;
}

function renderEmailDataLimits(): string {
  return `
    <div style="margin-top:18px;padding:13px 15px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#475569;font-size:12px;line-height:1.5;">
      <strong style="display:block;margin-bottom:5px;color:#334155;">Data limits</strong>
      CPA means cost per completed application. Indeed CPA is based on Greg's current-month hiring sheet. CPM, source rows, inactive Meta ads, and the full unmapped-ad list are in the full report.
    </div>
  `;
}

export function renderHiringAdsEmail(snapshot: HiringAdSnapshot): string {
  const safeReportUrl = safeUrl(snapshot.reportUrl);
  const fullReportCta = safeReportUrl
    ? `<a href="${escapeHtml(safeReportUrl)}" style="display:inline-block;padding:12px 18px;background:#1e6fad;color:#ffffff;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;">Open full report</a>`
    : `<div style="padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#475569;font-size:13px;line-height:1.45;">The full HTML report is attached in this dry run.</div>`;
  const eyebrow = "color:#1e6fad;font-size:11px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;";
  const previewNotice = !hasLiveFetch(snapshot)
    ? `<div style="margin-bottom:16px;padding:15px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#475569;font-size:14px;line-height:1.45;">${escapeHtml(snapshot.actionSummary[0] ?? "Preview only: no live ad-platform data has been fetched yet.")}</div>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:760px;background:#ffffff;">
      <div style="border:1px solid #dbe4ee;border-radius:14px;overflow:hidden;background:#ffffff;">
        <div style="padding:24px 26px;background:#f6f9fc;border-bottom:1px solid #dbe4ee;">
          <div style="${eyebrow}">Salt Lake Express</div>
          <h1 style="margin:7px 0 6px 0;color:#0f172a;font-size:25px;line-height:1.15;font-weight:800;">Weekly ${escapeHtml(snapshot.reportPosition)} Hiring Ads Snapshot</h1>
          <div style="color:#64748b;font-size:13px;line-height:1.4;">MTD economics: ${escapeHtml(snapshot.mtdReportPeriodLabel)} · Weekly Google check: ${escapeHtml(snapshot.reportPeriodLabel)}</div>
        </div>
        <div style="padding:22px 26px 24px 26px;">
          ${previewNotice}
          <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:0;">
            <tr>
              ${renderEmailMetric("Indeed spend", mtdIndeedSpendDisplay(snapshot), "MTD shown markets")}
              ${renderEmailMetric("Indeed CPA", averageIndeedCpaDisplay(snapshot), `${indeedApplicationsDisplay(snapshot)} completed apps`, true)}
              ${renderEmailMetric("Google spend", mtdGoogleSpendDisplay(snapshot), "MTD shown markets")}
              ${renderEmailMetric("Google CPA", "", "")}
            </tr>
          </table>

          ${renderEmailMarketEconomics(snapshot)}
          ${renderEmailWeeklyGoogleCheck(snapshot)}
          ${renderEmailNeedsAttention(snapshot)}
          ${renderEmailDataLimits()}

          <div style="margin-top:18px;">${fullReportCta}</div>
          <div style="margin-top:14px;color:#94a3b8;font-size:12px;line-height:1.4;">This snapshot sends every Monday after 9 AM Mountain Time.</div>
        </div>
      </div>
    </div>
  `;
}

export function renderHiringAdsText(snapshot: HiringAdSnapshot): string {
  const marketEconomicsLines = comparisonMarkets(snapshot, false).flatMap((market) => {
    const google = platformMarketMetrics(snapshot, market, "Google Ads", "mtd");
    const indeed = indeedMarketMetrics(snapshot, market);
    return [
      `${market}:`,
      `  Indeed MTD: Spend ${blankIfNull(indeed.spend, usd)}, Clicks ${blankIfNull(indeed.clicks, integer)}, CPC ${blankIfNull(indeed.cpc, usd)}, Apps ${blankIfNull(indeed.applications, integer)}, CPA ${blankIfNull(indeed.cpa, usd)}.`,
      `  Google MTD: Spend ${blankIfNull(google.spend, usd)}, Clicks ${blankIfNull(google.clicks, integer)}, CPC ${blankIfNull(google.cpc, usd)}, Apps , CPA .`,
    ];
  });
  const weeklyGoogleLines = visibleEmailMarkets(snapshot).map((market) => {
    const google = snapshot.rows.find((row) => row.market === market && row.platform === "Google Ads");
    const status = googleWeeklyStatus(google);
    return `${market}: Spend ${weeklyUsdDisplay(google, (row) => row.spend)}, Shown ${weeklyIntegerDisplay(google, (row) => row.impressions)}, Clicks ${weeklyIntegerDisplay(google, (row) => row.clicks)}, CPC ${weeklyCpcDisplay(google)}, Status ${status.label}.`;
  });
  const metaNote = visibleEmailMarkets(snapshot).some((market) => (
    snapshot.rows.find((row) => row.market === market && row.platform === "Meta Ads")?.status === "Active"
  ))
    ? `Meta is currently running in ${formatMarketList(visibleEmailMarkets(snapshot).filter((market) => (
      snapshot.rows.find((row) => row.market === market && row.platform === "Meta Ads")?.status === "Active"
    )))}.`
    : "Meta is not currently running in these requested markets.";
  const needsAttention = emailNeedsAttentionRows(snapshot);
  const lines = [
    `Weekly ${snapshot.reportPosition} Hiring Ads Snapshot`,
    `MTD economics: ${snapshot.mtdReportPeriodLabel}`,
    `Weekly Google check: ${snapshot.reportPeriodLabel}`,
    "",
    `Indeed spend: ${mtdIndeedSpendDisplay(snapshot)}`,
    `Indeed CPA: ${averageIndeedCpaDisplay(snapshot)} (${indeedApplicationsDisplay(snapshot)} completed apps)`,
    `Google spend: ${mtdGoogleSpendDisplay(snapshot)}`,
    "Google CPA:",
    "",
    "Market economics:",
    ...marketEconomicsLines,
    "",
    "Weekly Google check:",
    ...weeklyGoogleLines,
    metaNote,
    "",
  ];

  if (needsAttention.length > 0) {
    lines.push("Needs attention:");
    needsAttention.forEach((row) => {
      lines.push(`${row.label}: ${row.body}`);
    });
    lines.push("");
  }

  lines.push("Data limits: CPA means cost per completed application. Indeed CPA is based on Greg's current-month hiring sheet. CPM, source rows, inactive Meta ads, and the full unmapped-ad list are in the full report.");
  lines.push(snapshot.reportUrl ? `Open full report: ${snapshot.reportUrl}` : "The full HTML report is attached.");

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

function renderChannelComparisonRows(snapshot: HiringAdSnapshot): string {
  return comparisonMarkets(snapshot, true).map((market) => {
    const googleMeta = googleMetaMarketMetrics(snapshot, market, "mtd");
    const indeed = indeedMarketMetrics(snapshot, market);
    const hasIndeedRow = snapshot.indeedRows.some((row) => row.market === market);
    const noGoogleMetaDelivery = googleMeta.spend === 0 && googleMeta.clicks === 0 && googleMeta.impressions === 0;
    return `
      <tr>
        <td><strong>${escapeHtml(market)}</strong></td>
        <td><span class="pill ${statusClass(googleMeta.status)}">${escapeHtml(googleMeta.status)}</span></td>
        <td class="right">${escapeHtml(usd(googleMeta.spend))}</td>
        <td class="right">${escapeHtml(integer(googleMeta.clicks))}</td>
        <td class="right">${escapeHtml(metricUsd(googleMeta.cpc, noGoogleMetaDelivery ? "No delivery" : "Unknown"))}</td>
        <td class="right">${escapeHtml(metricUsd(googleMeta.cpm, noGoogleMetaDelivery ? "No delivery" : "Unknown"))}</td>
        <td class="cpa-cell">Not tracked</td>
        <td><span class="pill ${hasIndeedRow ? statusClass(indeed.status) : "inactive"}">${escapeHtml(hasIndeedRow ? indeed.status : "No row")}</span></td>
        <td class="right">${escapeHtml(usd(indeed.spend))}</td>
        <td class="right">${escapeHtml(integer(indeed.applications))}</td>
        <td class="right">${escapeHtml(usd(indeed.cpc))}</td>
        <td class="right">${escapeHtml(usd(indeed.cpm))}</td>
        <td class="right cpa-cell"><strong>${escapeHtml(usd(indeed.cpa))}</strong></td>
      </tr>
    `;
  }).join("");
}

function renderIndeedRows(snapshot: HiringAdSnapshot): string {
  if (snapshot.indeedRows.length === 0) {
    return `<p class="muted">No Indeed comparison rows were available from Greg's sheet.</p>`;
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Market</th>
          <th>Status</th>
          <th>Company</th>
          <th class="right">Spend</th>
          <th class="right">Shown</th>
          <th class="right">Clicks</th>
          <th class="right">CPC</th>
          <th class="right">CPM</th>
          <th class="right">Apply starts</th>
          <th class="right">Applications</th>
          <th class="right">CPA</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        ${snapshot.indeedRows.map((row) => `
          <tr>
            <td><strong>${escapeHtml(row.market)}</strong></td>
            <td><span class="pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
            <td>${escapeHtml(row.company)}</td>
            <td class="right">${escapeHtml(usd(row.spend))}</td>
            <td class="right">${escapeHtml(integer(row.impressions))}</td>
            <td class="right">${escapeHtml(integer(row.clicks))}</td>
            <td class="right">${escapeHtml(usd(costPerClick(row.spend, row.clicks)))}</td>
            <td class="right">${escapeHtml(usd(costPerThousandImpressions(row.spend, row.impressions)))}</td>
            <td class="right">${escapeHtml(integer(row.applyStarts))}</td>
            <td class="right">${escapeHtml(integer(row.applications))}</td>
            <td class="right">${escapeHtml(usd(safeDivide(row.spend, row.applications)))}</td>
            <td>${escapeHtml(row.notes)}</td>
          </tr>
        `).join("")}
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
      const impressions = rows.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
      const clicks = rows.reduce((sum, row) => sum + (row.clicks ?? 0), 0);
      return `
        <article class="active-card">
          <div class="card-top"><h3>${escapeHtml(market)}</h3><span class="pill active">Active</span></div>
          <p>${escapeHtml(platforms)} ${rows.length === 1 ? "is" : "are"} showing ${escapeHtml(snapshot.reportPosition.toLowerCase())} hiring ads.</p>
          <div class="metric"><span>Mapped spend</span><strong>${escapeHtml(usd(spend))}</strong></div>
          <div class="metric-grid">
            <div class="metric"><span>CPC</span><strong>${escapeHtml(usd(costPerClick(spend, clicks)))}</strong></div>
            <div class="metric"><span>CPM</span><strong>${escapeHtml(usd(costPerThousandImpressions(spend, impressions)))}</strong></div>
          </div>
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
    h1,h2,h3{margin:0;color:#fff}h1{font-size:38px;line-height:1.08}h2{font-size:20px;margin-bottom:12px}h3{font-size:18px}
    p{color:#a1a1aa;line-height:1.55}.eyebrow{color:#f4bd50;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;min-width:520px}.stat{border-left:1px solid #27272a;padding-left:18px}.stat span,.metric span{display:block;color:#71717a;font-size:11px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase}.stat strong{display:block;margin-top:6px;font-size:25px}
    section{margin-top:26px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.active-card,.empty-card,.panel{border:1px solid #27272a;background:#18181b;padding:18px}.active-card{border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.08)}.card-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.metric{margin-top:16px}.metric strong{display:block;margin-top:4px;color:#fff;font-size:18px}.metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    table{width:100%;border-collapse:collapse;font-size:14px;background:#111113;border:1px solid #27272a}th{padding:11px;border-bottom:1px solid #27272a;color:#71717a;font-size:11px;letter-spacing:1.2px;text-align:left;text-transform:uppercase}td{padding:13px 11px;border-bottom:1px solid #27272a;vertical-align:top}.right{text-align:right}.muted{color:#71717a}
    .pill{display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700}.active{background:#064e3b;color:#6ee7b7}.inactive{background:#27272a;color:#d4d4d8}.review{background:#78350f;color:#fde68a}.cpa-cell{background:rgba(30,111,173,.16);border-left:2px solid #38bdf8;color:#e0f2fe}
    .summary-list{margin:0;padding-left:20px;color:#e4e4e7}.summary-list li{margin:8px 0}.note{padding:14px;background:#111113;border:1px solid #27272a;color:#d4d4d8}.section-note{margin-top:0}
    a{color:#67e8f9}@media(max-width:760px){main{padding:20px}header{display:block}.stats{grid-template-columns:1fr;min-width:0}.stat{border-left:0;border-top:1px solid #27272a;padding:12px 0 0}table{display:block;overflow-x:auto;white-space:nowrap}}
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="eyebrow">Salt Lake Express</div>
      <h1>${escapeHtml(snapshot.reportPosition)} Hiring Ads Snapshot</h1>
      <p>Month-to-date channel economics for ${escapeHtml(snapshot.mtdReportPeriodLabel)}. Weekly delivery health for ${escapeHtml(snapshot.reportPeriodLabel)}. Generated ${escapeHtml(snapshot.generatedAt)}.</p>
    </div>
    <div class="stats">
      <div class="stat"><span>Google/Meta MTD spend</span><strong>${escapeHtml(mtdGoogleMetaSpendDisplay(snapshot))}</strong></div>
      <div class="stat"><span>Google/Meta MTD CPC</span><strong>${escapeHtml(averageMtdCostPerClickDisplay(snapshot))}</strong></div>
      <div class="stat"><span>Indeed MTD spend</span><strong>${escapeHtml(mtdIndeedSpendDisplay(snapshot))}</strong></div>
      <div class="stat"><span>Indeed apps</span><strong>${escapeHtml(indeedApplicationsDisplay(snapshot))}</strong></div>
      <div class="stat"><span>Indeed CPA</span><strong>${escapeHtml(averageIndeedCpaDisplay(snapshot))}</strong></div>
      <div class="stat"><span>Weekly active markets</span><strong>${escapeHtml(activeMarketDisplay(snapshot))}</strong></div>
    </div>
  </header>
  <section class="panel">
    <h2>What Changed / Action Needed</h2>
    ${aiSummaryHtml ? `<div class="note">${aiSummaryHtml}</div>` : ""}
    <ul class="summary-list">${snapshot.actionSummary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>
  <section>
    <h2>Month-To-Date Channel Economics</h2>
    <p class="section-note">Google/Meta rows use the month-to-date ad-platform window. Indeed rows use Greg's current-month sheet, which includes application counts and cost per application.</p>
    <table>
      <thead>
        <tr>
          <th>Market</th>
          <th>G/M status</th>
          <th class="right">G/M MTD spend</th>
          <th class="right">G/M MTD clicks</th>
          <th class="right">G/M CPC</th>
          <th class="right">G/M CPM</th>
          <th class="cpa-cell">G/M CPA</th>
          <th>Indeed status</th>
          <th class="right">Indeed spend</th>
          <th class="right">Apps</th>
          <th class="right">Indeed CPC</th>
          <th class="right">Indeed CPM</th>
          <th class="right cpa-cell">Indeed CPA</th>
        </tr>
      </thead>
      <tbody>${renderChannelComparisonRows(snapshot)}</tbody>
    </table>
  </section>
  <section>
    <h2>Active Driver Hiring Markets</h2>
    <div class="cards">${activeCards}</div>
  </section>
  <section>
    <h2>Google / Meta Weekly Detail</h2>
    <table>
      <thead><tr><th>Market</th><th>Platform</th><th>Status</th><th class="right">Spend</th><th class="right">Shown</th><th class="right">Clicks</th><th class="right">CPC</th><th class="right">CPM</th><th>Tracking</th><th>Note</th></tr></thead>
      <tbody>${renderRows(snapshot.rows)}</tbody>
    </table>
  </section>
  <section>
    <h2>Indeed Current-Month Comparison</h2>
    <p class="section-note">Greg's sheet has application counts, so Indeed can show cost per application. These rows are current-month, not the weekly Google/Meta window.</p>
    ${renderIndeedRows(snapshot)}
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
    Cost per application stays "Not tracked" for Google/Meta unless completed applications are connected to Google Ads or Meta Ads. GA4 website sessions are diagnostic only when ads land on external systems.
  </section>
  <section class="note">
    Terms: MTD means month to date. CPC is cost per click. CPM is cost per 1,000 times shown. Apps means completed applications from Greg's Indeed sheet. CPA is cost per application, the main efficiency metric for hiring ads.
  </section>
</main>
</body>
</html>`;
}

export function renderHiringAdsEml(args: {
  from: string;
  to: string;
  cc?: string;
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
    ...(args.cc?.trim() ? [`Cc: ${args.cc}`] : []),
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
