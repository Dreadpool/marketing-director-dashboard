import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildHiringGoogleGroups, googleMetrics, isHiringCampaign, knownHiringGroups, reconcileGoogleMetrics, trackedHiringCampaigns, type HiringGoogleGroup } from "./hiring-google-groups";
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
  modifiedAt?: string;
  freshnessWarning?: string;
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
  google?: HiringGoogleGroup;
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
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  applyStarts: number | null;
  applications: number | null;
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
  rows: HiringPlatformRow[];
  mtdRows: HiringPlatformRow[];
  indeedRows: IndeedComparisonRow[];
  unmappedHiringAds: UnmappedHiringAd[];
  sourceFetches: HiringSourceFetch[];
  reportUrl: string | null;
  googleAudit?: { period: DateRange; campaignSpend: number; reportedSpend: number; excluded: { campaign: string; adGroup: string; id: string; spend: number; reason: string }[] }[];
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
  google?: HiringGoogleGroup;
};

type ScheduleState = {
  lastSuccessPeriodKey?: string;
  lastSentMessageId?: string;
};

const REPORT_POSITION = "Driver";
const INDEED_HIRING_SPEND_SHEET_ID = "1cQkl_BYydxT-8NOubOITNo9iN8aqiO-bM-vLZrk09fE";
const INDEED_RANGE_SUFFIX = "A:AF";
const GWS_SLE = "/Users/brady/.agents/skills/gws/scripts/gws-sle";
const SOURCE_FRESHNESS_WARNING_DAYS = 14;
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

type IndeedSheetRange = {
  label: string;
  range: string;
  legacy: boolean;
};

const KNOWN_MARKETS: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: "Omak, WA",
    patterns: [/\bomak\b/i],
  },
  {
    label: "St. George, UT",
    patterns: [/\bst\.?\s*george\b/i, /\bsaint\s+george\b/i, /\bstgeo\b/i],
  },
  {
    label: "Pocatello, ID",
    patterns: [/\bpocatello\b/i],
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

async function fetchGoogleRecords(period: DateRange): Promise<{
  records: RawHiringRecord[];
  fetch: HiringSourceFetch;
  audit?: NonNullable<HiringAdSnapshot["googleAudit"]>[number];
}> {
  const fetchedAt = new Date().toISOString();
  const identity = "campaign.id, campaign.name, campaign.status, campaign.primary_status, campaign.geo_target_type_setting.positive_geo_target_type, ad_group.id, ad_group.name, ad_group.status, ad_group.primary_status, ad_group.primary_status_reasons";
  try {
    const [accounts, allCampaigns] = await Promise.all([
      gaqlQuery("SELECT customer.id, customer.currency_code, customer.time_zone FROM customer"),
      gaqlQuery("SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status IN ('ENABLED','PAUSED','REMOVED')"),
    ]);
    const account = readRecord(accounts[0]?.customer);
    if (accounts.length !== 1 || String(account.id) !== "7716669181" || account.currencyCode !== "USD" || account.timeZone !== HIRING_REPORT_TIME_ZONE) throw new Error("Google account, currency, or reporting timezone does not match the hiring report contract");
    const campaigns = allCampaigns.filter((r) => isHiringCampaign(readRecord(r.campaign)));
    const ids = campaigns.map((r) => String(readRecord(r.campaign).id));
    if (trackedHiringCampaigns.some((id) => !ids.includes(id))) throw new Error("A tracked Google hiring campaign is missing from inventory");
    const hiring = `campaign.id IN (${ids.join(",")})`;
    const window = `segments.date BETWEEN '${period.start}' AND '${period.end}'`;
    const allStatuses = "campaign.status IN ('ENABLED','PAUSED','REMOVED') AND ad_group.status IN ('ENABLED','PAUSED','REMOVED')";
    const [inventory, performance, criteria, campaignCriteria, campaignPerformance] = await Promise.all([
      gaqlQuery(`SELECT ${identity} FROM ad_group WHERE ${hiring} AND ${allStatuses}`),
      gaqlQuery(`SELECT ${identity}, metrics.cost_micros, metrics.impressions, metrics.clicks FROM ad_group WHERE ${hiring} AND ${allStatuses} AND ${window}`),
      gaqlQuery(`SELECT campaign.id, ad_group.id, ad_group_criterion.status, ad_group_criterion.negative, ad_group_criterion.location.geo_target_constant FROM ad_group_criterion WHERE ${hiring} AND ad_group_criterion.type = 'LOCATION' AND ad_group_criterion.status != 'REMOVED'`),
      gaqlQuery(`SELECT campaign.id, campaign_criterion.type, campaign_criterion.status, campaign_criterion.negative, campaign_criterion.location.geo_target_constant, campaign_criterion.proximity.radius, campaign_criterion.proximity.radius_units, campaign_criterion.proximity.address.street_address, campaign_criterion.proximity.address.city_name, campaign_criterion.proximity.address.province_code, campaign_criterion.proximity.address.postal_code, campaign_criterion.proximity.geo_point.latitude_in_micro_degrees, campaign_criterion.proximity.geo_point.longitude_in_micro_degrees FROM campaign_criterion WHERE ${hiring} AND campaign_criterion.type IN ('LOCATION','PROXIMITY') AND campaign_criterion.status != 'REMOVED'`),
      gaqlQuery(`SELECT campaign.id, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE ${hiring} AND campaign.status IN ('ENABLED','PAUSED','REMOVED') AND ${window}`),
    ]);
    const inventoryIds = new Set(inventory.map((r) => String(readRecord(r.adGroup).id)));
    if (knownHiringGroups.some((id) => !inventoryIds.has(id))) throw new Error("A known Google hiring ad group is missing from inventory; cannot confirm the full roster");
    reconcileGoogleMetrics(performance, campaignPerformance);
    const geoIds = [...new Set([...criteria, ...campaignCriteria].map((row) => {
      const criterion = readRecord(row.adGroupCriterion ?? row.ad_group_criterion ?? row.campaignCriterion ?? row.campaign_criterion);
      const location = readRecord(criterion.location);
      return String(location.geoTargetConstant ?? location.geo_target_constant ?? "").split("/").pop();
    }).filter((id) => id && /^\d+$/.test(id)))];
    const locations = geoIds.length ? await gaqlQuery(`SELECT geo_target_constant.resource_name, geo_target_constant.name, geo_target_constant.canonical_name, geo_target_constant.target_type FROM geo_target_constant WHERE geo_target_constant.id IN (${geoIds.join(",")})`) : [];
    const records = buildHiringGoogleGroups(inventory, performance, criteria, campaignCriteria, locations);
    const included = new Set(records.map((r) => r.sourceId));
    const performanceById = new Map(performance.map((r) => [`campaign:${readRecord(r.campaign).id}/ad-group:${readRecord(r.adGroup).id}`, r]));
    const excluded = [...new Map([...performance, ...inventory].map((r) => [`campaign:${readRecord(r.campaign).id}/ad-group:${readRecord(r.adGroup).id}`, r])).entries()]
      .filter(([id]) => !included.has(id)).map(([id, r]) => ({
        id, campaign: String(readRecord(r.campaign).name), adGroup: String(readRecord(r.adGroup).name),
        spend: googleMetrics(performanceById.get(id) ?? {}).costMicros / 1e6,
        reason: "Outside driver roster: non-driver group, dormant generic group, or retired campaign/group without delivery.",
      }));
    const campaignSpend = campaignPerformance.reduce((n, r) => n + googleMetrics(r).costMicros, 0) / 1e6;
    const reportedSpend = records.reduce((n, r) => n + r.spend, 0);
    if (Math.abs(campaignSpend - reportedSpend - excluded.reduce((n, r) => n + r.spend, 0)) > 0.000001) throw new Error("Google reported and excluded spend do not reconcile");
    return {
      records,
      audit: { period, campaignSpend, reportedSpend, excluded },
      fetch: { source: "Google Ads", status: "ok", fetchedAt, message: `${campaigns.length} hiring campaigns checked. Ad-group metrics reconcile with campaign totals. Excluded spend: $${excluded.reduce((n, r) => n + r.spend, 0).toFixed(2)}; details in the full report.` },
    };
  } catch (err) {
    return { records: [], fetch: { source: "Google Ads", status: "error", fetchedAt, message: truncateMessage(err) } };
  }
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

  const campaignResult = await settleMetaRequest(
    "campaign insights",
    () => getInsightsForDateRange(period),
  );
  const adSetResult = await settleMetaRequest(
    "ad set insights",
    () => getAdSetInsightsForDateRange(period),
  );
  const adResult = await settleMetaRequest(
    "ad insights",
    () => getAdInsightsForDateRange(period),
  );
  const inventoryResult = await settleMetaRequest(
    "ad inventory",
    () => getAdInventory(),
  );

  const campaigns = campaignResult.result.status === "fulfilled" ? campaignResult.result.value : [];
  const adsets = adSetResult.result.status === "fulfilled" ? adSetResult.result.value : [];
  const ads = adResult.result.status === "fulfilled" ? adResult.result.value : [];
  const inventory = inventoryResult.result.status === "fulfilled" ? inventoryResult.result.value : [];

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
    // A parent total belongs to all its ads, never to each inventory row.
    const metric = metricFromMeta(adMetric.get(row.ad_id));
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

  for (const row of ads) {
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

  const failures = summarizeMetaFailures([
    campaignResult,
    adSetResult,
    adResult,
    inventoryResult,
  ]);
  for (const parent of [...campaigns, ...adsets]) {
    const matchingAds = ads.filter((ad) => parent.adset_id ? ad.adset_id === parent.adset_id : ad.campaign_id === parent.campaign_id);
    const adSpend = matchingAds.reduce((total, ad) => total + numberFrom(ad.spend), 0);
    if (Math.abs(adSpend - numberFrom(parent.spend)) > 0.02) {
      failures.push(`Meta ${parent.adset_id ? "ad set" : "campaign"} ${parent.adset_id ?? parent.campaign_id} spend does not reconcile with ad-level results.`);
    }
  }

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

async function settleMetaRequest<T>(
  label: string,
  request: () => Promise<T>,
): Promise<{ label: string; result: PromiseSettledResult<T> }> {
  try {
    return { label, result: { status: "fulfilled", value: await request() } };
  } catch (reason) {
    return { label, result: { status: "rejected", reason } };
  }
}

function summarizeMetaFailures(
  requests: Array<{ label: string; result: PromiseSettledResult<unknown> }>,
): string[] {
  const labelsByMessage = new Map<string, string[]>();

  for (const request of requests) {
    if (request.result.status !== "rejected") continue;
    const message = truncateMessage(request.result.reason);
    labelsByMessage.set(message, [...(labelsByMessage.get(message) ?? []), request.label]);
  }

  return [...labelsByMessage.entries()].map(
    ([message, labels]) => `${labels.join(", ")}: ${message}`,
  );
}

async function fetchMetaWindows(
  weeklyPeriod: DateRange,
  mtdPeriod: DateRange,
): Promise<{
  weekly: Awaited<ReturnType<typeof fetchMetaRecords>>;
  mtd: Awaited<ReturnType<typeof fetchMetaRecords>>;
}> {
  const weekly = await fetchMetaRecords(weeklyPeriod);
  const mtd = await fetchMetaRecords(mtdPeriod);
  return { weekly, mtd };
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
  if (!city.trim()) return null;
  return normalizedState.trim() ? `${city.trim()}, ${normalizedState.trim()}` : city.trim();
}

function sheetMetric(value: string): number | null {
  const cleaned = value.replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function aggregateIndeedRows(rows: IndeedComparisonRow[]): IndeedComparisonRow[] {
  const groups = new Map<string, IndeedComparisonRow[]>();
  for (const row of rows) {
    const key = `${row.market}|${row.company}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    const spend = group.some((row) => row.spend === null) ? null : group.reduce((sum, row) => sum + (row.spend ?? 0), 0);
    const impressions = group.some((row) => row.impressions === null) ? null : group.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
    const clicks = group.some((row) => row.clicks === null) ? null : group.reduce((sum, row) => sum + (row.clicks ?? 0), 0);
    const applyStarts = group.some((row) => row.applyStarts === null) ? null : group.reduce((sum, row) => sum + (row.applyStarts ?? 0), 0);
    const applications = group.some((row) => row.applications === null) ? null : group.reduce((sum, row) => sum + (row.applications ?? 0), 0);
    const isOpen = group.some((row) => row.status === "Active");
    const status: HiringStatus = isOpen ? "Active" : group.some((row) => row.status === "Needs review") ? "Needs review" : "Inactive";
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
  }).sort((a, b) => a.market.localeCompare(b.market) || a.company.localeCompare(b.company));
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

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function indeedMonthTabName(period: DateRange): string {
  const [year, month] = period.start.split("-");
  return `${month}-${year}`;
}

function indeedSheetRangesForPeriod(period: DateRange): IndeedSheetRange[] {
  const monthTab = indeedMonthTabName(period);
  return [{
    label: monthTab,
    range: `${quoteSheetTitle(monthTab)}!${INDEED_RANGE_SUFFIX}`,
    legacy: false,
  }];
}

async function fetchIndeedSheetValues(range: IndeedSheetRange): Promise<string[][]> {
  const { stdout } = await execFileAsync(GWS_SLE, [
    "sheets",
    "spreadsheets",
    "values",
    "get",
    "--params",
    JSON.stringify({
      spreadsheetId: INDEED_HIRING_SPEND_SHEET_ID,
      range: range.range,
    }),
  ], {
    env: gwsEnv(),
    timeout: 60000,
    maxBuffer: 1024 * 1024 * 3,
  });
  const parsed = parseGwsJson(stdout) as { values?: string[][] };
  return parsed.values ?? [];
}

async function fetchIndeedRows(period: DateRange): Promise<{
  rows: IndeedComparisonRow[];
  fetch: HiringSourceFetch;
}> {
  const fetchedAt = new Date().toISOString();
  const ranges = indeedSheetRangesForPeriod(period);
  let selectedRange: IndeedSheetRange | null = null;
  let values: string[][] = [];
  const rangeWarnings: string[] = [];

  try {
    const [metadataResult] = await Promise.allSettled([fetchIndeedSheetMetadata()]);

    for (const range of ranges) {
      try {
        values = await fetchIndeedSheetValues(range);
        selectedRange = range;
        break;
      } catch (err) {
        rangeWarnings.push(`Could not read ${range.label}: ${truncateMessage(err)}`);
      }
    }

    if (!selectedRange) {
      throw new Error(
        `The ${ranges[0].label} tab is missing from Greg's Indeed sheet. Indeed metrics are unavailable.`,
      );
    }

    const metadata = metadataResult.status === "fulfilled" ? metadataResult.value : {};
    const staleWarning = sourceFreshnessWarning(metadata.modifiedTime);
    const metadataNote = metadata.modifiedTime
      ? `Sheet modified ${metadata.modifiedTime}${metadata.lastModifiedBy ? ` by ${metadata.lastModifiedBy}` : ""}.`
      : "Sheet modified time unavailable.";
    const [headerRow, ...bodyRows] = values;
    if (!headerRow) {
      return {
        rows: [],
        fetch: {
          source: "Indeed sheet",
          status: "error",
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
          status: "error",
          fetchedAt,
          message: `Greg's sheet is missing expected columns: ${missingHeaders.join(", ")}. ${metadataNote}`,
        },
      };
    }

    const rows = bodyRows.flatMap((row): IndeedComparisonRow[] => {
      const source = sheetCell(row, headers, "Source").trim();
      const jobType = sheetCell(row, headers, "Job Type");
      const job = sheetCell(row, headers, "Job");
      const city = sheetCell(row, headers, "City");
      const state = sheetCell(row, headers, "State/Region");
      const market = cityMarket(city, state);
      if (source.toLowerCase() !== "indeed") return [];
      if (!hasDriverHiringIntent(`${jobType} ${job}`)) return [];

      return [{
        market: market || "Location not entered",
        platform: "Indeed",
        jobType: jobType || REPORT_POSITION,
        status: sheetCell(row, headers, "Job status").trim().toLowerCase() === "open" ? "Active" : /^(closed|paused)$/.test(sheetCell(row, headers, "Job status").trim().toLowerCase()) ? "Inactive" : "Needs review",
        periodLabel: "Current month from Greg's Indeed sheet",
        spend: sheetMetric(sheetCell(row, headers, "Spend")),
        impressions: sheetMetric(sheetCell(row, headers, "Impressions")),
        clicks: sheetMetric(sheetCell(row, headers, "Clicks")),
        applyStarts: sheetMetric(sheetCell(row, headers, "Apply starts")),
        applications: sheetMetric(sheetCell(row, headers, "Applies")),
        company: sheetCell(row, headers, "Company name") || "Unknown",
        sourceRows: 1,
        notes: "Indeed current-month totals. This does not use the weekly Google/Meta report window.",
      }];
    });
    const aggregatedRows = aggregateIndeedRows(rows);
    const warnings = [
      rows.some((row) => row.spend === null || row.clicks === null || row.applications === null) ? "Some sheet metrics are blank or invalid and are shown as unavailable." : null,
      rows.some((row) => row.status === "Needs review") ? "Some sheet job statuses are blank or unknown; they are not counted as closed." : null,
      rows.some((row) => row.company === "Unknown" || !row.market.includes(",")) ? "Some sheet rows lack company or state; location labels are shown exactly as entered." : null,
      rows.length === 0 ? `No ${REPORT_POSITION.toLowerCase()} Indeed rows were found in ${selectedRange.label}.` : null,
      staleWarning,
      metadataResult.status === "rejected" ? `Could not read sheet modified time: ${truncateMessage(metadataResult.reason)}` : null,
    ].filter(Boolean);

    return {
      rows: aggregatedRows,
      fetch: {
        source: "Indeed sheet",
        status: warnings.length > 0 ? "warning" : "ok",
        fetchedAt,
        modifiedAt: metadata.modifiedTime,
        freshnessWarning: staleWarning ?? undefined,
        message: `Read ${rows.length} ${REPORT_POSITION.toLowerCase()} rows from Weekly Report_Hiring Spend / ${selectedRange.label}. ${metadataNote}${warnings.length > 0 ? ` ${warnings.join(" ")}` : ""}`,
      },
    };
  } catch (err) {
    return {
      rows: [],
      fetch: {
        source: "Indeed sheet",
        status: "error",
        fetchedAt,
        message: `Could not read Greg's Indeed spend sheet: ${truncateMessage(err)}`,
      },
    };
  }
}

function aggregateRows(records: RawHiringRecord[], fetches: HiringSourceFetch[]): HiringPlatformRow[] {
  const groups = new Map<string, RawHiringRecord[]>();
  for (const record of records) {
    if (!record.market) continue;
    const key = record.google ? record.sourceId : record.platform + ":" + record.market;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.values()].map((group) => {
    const first = group[0];
    const failed = fetches.some((f) => f.source === first.platform && f.status === "error");
    const spend = group.reduce((sum, r) => sum + r.spend, 0);
    const impressions = group.reduce((sum, r) => sum + r.impressions, 0);
    const clicks = group.reduce((sum, r) => sum + r.clicks, 0);
    const delivered = spend > 0 || impressions > 0 || clicks > 0;
    const enabled = group.some((r) => r.eligible);
    const reason: HiringStatusReason = failed ? "fetch_failed" : delivered ? "active_delivery" : enabled ? "enabled_no_delivery" : "inactive_no_delivery";
    return {
      market: first.market!, platform: first.platform,
      status: (failed ? "Needs review" : first.google ? first.google.currentState === "Unknown" ? "Needs review" : enabled ? "Active" : "Inactive" : delivered ? "Active" : enabled ? "Needs review" : "Inactive") as HiringStatus,
      reason, spend: failed ? null : spend, impressions: failed ? null : impressions, clicks: failed ? null : clicks,
      hiringConversionRate: "Not tracked" as const,
      notes: [...new Set(group.flatMap((r) => r.notes))].join(" "),
      sourceIds: group.map((r) => r.sourceId),
      ...(first.google ? { google: first.google } : {}),
    };
  });
}

export const __hiringAdsSnapshotTest = {
  aggregateRows,
  sheetMetric,
  aggregateIndeedRows,
  cityMarket,
  detectMarket,
  fetchMetaWindows,
  fetchGoogleRecords,
  fetchMetaRecords,
  fetchIndeedRows,
  hasDriverHiringIntent,
  indeedSheetRangesForPeriod,
  summarizeMetaFailures,
};

const PLATFORM_API_SOURCES = new Set<HiringReportSource>([
  "Google Ads",
  "Meta Ads",
  "Google Ads MTD",
  "Meta Ads MTD",
]);

export function getBlockingHiringSourceFailures(
  fetches: HiringSourceFetch[],
): HiringSourceFetch[] {
  return fetches.filter((fetch) => (
    (fetch.status === "error" && fetch.source !== "Indeed sheet")
    || (fetch.status === "warning" && PLATFORM_API_SOURCES.has(fetch.source))
  ));
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

export async function collectHiringAdSnapshot(
  options: { now?: Date; reportUrl?: string | null } = {},
): Promise<HiringAdSnapshot> {
  const now = options.now ?? new Date();
  const schedule = getPreviousMondaySunday(now);
  const mtdSchedule = getMonthToDatePeriod(now);
  const [googleResult, googleMtdResult, indeedResult, metaWindowsResult] = await Promise.allSettled([
    fetchGoogleRecords(schedule.period),
    fetchGoogleRecords(mtdSchedule.period),
    fetchIndeedRows(mtdSchedule.period),
    fetchMetaWindows(schedule.period, mtdSchedule.period),
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

  if (metaWindowsResult.status === "fulfilled") {
    records.push(...metaWindowsResult.value.weekly.records);
    sourceFetches.push(metaWindowsResult.value.weekly.fetch);
  } else {
    sourceFetches.push({
      source: "Meta Ads",
      status: "error",
      fetchedAt: new Date().toISOString(),
      message: truncateMessage(metaWindowsResult.reason),
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

  if (metaWindowsResult.status === "fulfilled") {
    mtdRecords.push(...metaWindowsResult.value.mtd.records);
    mtdFetches.push(metaWindowsResult.value.mtd.fetch);
    sourceFetches.push({
      ...metaWindowsResult.value.mtd.fetch,
      source: "Meta Ads MTD",
      message: metaWindowsResult.value.mtd.fetch.message ?? `Month-to-date window: ${mtdSchedule.label}.`,
    });
  } else {
    const fetch: HiringSourceFetch = {
      source: "Meta Ads",
      status: "error",
      fetchedAt: new Date().toISOString(),
      message: truncateMessage(metaWindowsResult.reason),
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

  return {
    generatedAt: now.toISOString(),
    timeZone: HIRING_REPORT_TIME_ZONE,
    reportPosition: REPORT_POSITION,
    reportPeriod: schedule.period,
    reportPeriodLabel: schedule.label,
    mtdReportPeriod: mtdSchedule.period,
    mtdReportPeriodLabel: mtdSchedule.label,
    reportDueAfter: schedule.dueAfter,
    rows,
    mtdRows,
    indeedRows,
    unmappedHiringAds,
    sourceFetches,
    reportUrl: options.reportUrl ?? null,
    googleAudit: [googleResult, googleMtdResult].flatMap((r) => r.status === "fulfilled" && r.value.audit ? [r.value.audit] : []),
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

export {
  snapshotEmail as renderHiringAdsEmail,
  snapshotText as renderHiringAdsText,
  snapshotFullReport as renderHiringAdsFullReport,
} from "./hiring-snapshot-render";

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
