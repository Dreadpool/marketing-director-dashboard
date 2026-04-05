/**
 * SEO Ranking Analysis fetch executor.
 *
 * Fetches keyword ranking data from Google Sheets for 3 SLE websites,
 * then computes aggregate change scores, visibility scores, tier
 * distributions, and biggest movers.
 *
 * Ported from: /Users/brady/workspace/sle/seo-analysis/scripts/seo_ranking_analysis.py
 */

import { google } from "googleapis";
import type { MonthPeriod } from "@/lib/schemas/types";
import type {
  SeoRankingMetrics,
  SeoSiteData,
  SeoAggregateChange,
  SeoVisibilityScore,
  SeoTierDistribution,
  SeoMover,
  SeoKeywordRow,
  SeoSourceDetail,
  StrikingDistanceOpportunity,
  CtrGapOpportunity,
  GscQuickWins,
} from "@/lib/schemas/sources/seo-ranking-metrics";

// ─── Constants ──────────────────────────────────────────────────────────────

const SHEET_ID = "1OfZyfmbGaSl8sygnuwJDYzP_eXMMhJukBHXqiz1NMAA";
const OTR_CAP = 100;

const TABS: Record<string, string> = {
  sle: "Salt Lake Express",
  charters: "SLE Charters",
  nwsl: "Northwestern Stage Lines",
};

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBREVS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ─── Google Sheets client ───────────────────────────────────────────────────

type SheetsClient = ReturnType<typeof google.sheets>["spreadsheets"];

let sheetsClient: SheetsClient | null = null;

function getSheetsClient(): SheetsClient {
  if (!sheetsClient) {
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    let auth;
    if (credentialsJson) {
      const credentials = JSON.parse(credentialsJson);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
    } else {
      auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
    }
    const sheets = google.sheets({ version: "v4", auth });
    sheetsClient = sheets.spreadsheets;
  }
  return sheetsClient;
}

// ─── Google Search Console client ───────────────────────────────────────────

type SearchConsoleClient = ReturnType<typeof google.searchconsole>;

let gscClient: SearchConsoleClient | null = null;

function getSearchConsoleClient(): SearchConsoleClient | null {
  const siteUrls = process.env.GSC_SITE_URLS;
  if (!siteUrls) return null;

  if (!gscClient) {
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    let auth;
    if (credentialsJson) {
      const credentials = JSON.parse(credentialsJson);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      });
    } else {
      auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      });
    }
    gscClient = google.searchconsole({ version: "v1", auth });
  }
  return gscClient;
}

function getGscSiteUrls(): Record<string, string> {
  const raw = process.env.GSC_SITE_URLS;
  if (!raw) return {};
  const urls = raw.split(",").map((u) => u.trim());
  const keys = Object.keys(TABS);
  const result: Record<string, string> = {};
  for (let i = 0; i < Math.min(urls.length, keys.length); i++) {
    result[keys[i]] = urls[i];
  }
  return result;
}

// CTR benchmarks by position (First Page Sage 2025, organic desktop)
const CTR_BENCHMARKS: Record<number, number> = {
  1: 0.398, 2: 0.187, 3: 0.102, 4: 0.072, 5: 0.051,
  6: 0.044, 7: 0.030, 8: 0.021, 9: 0.019, 10: 0.016,
};

function getBenchmarkCtr(position: number): number {
  const rounded = Math.round(position);
  if (rounded < 1) return CTR_BENCHMARKS[1];
  if (rounded > 10) return 0.01;
  return CTR_BENCHMARKS[rounded] ?? 0.01;
}

// ─── GSC data fetching + analysis ───────────────────────────────────────────

type GscRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

async function fetchGscData(
  client: SearchConsoleClient,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GscRow[]> {
  const res = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: 1000,
      dataState: "final",
    },
  });

  return (res.data.rows ?? []).map((row) => ({
    query: row.keys![0],
    page: row.keys![1],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

function analyzeStrikingDistance(rows: GscRow[]): StrikingDistanceOpportunity[] {
  return rows
    .filter((r) => r.impressions >= 10 && r.position >= 5 && r.position <= 20)
    .map((r) => {
      const estimatedAt3 = Math.round(r.impressions * 0.102);
      return {
        query: r.query,
        page: r.page,
        position: Math.round(r.position * 10) / 10,
        impressions: r.impressions,
        current_clicks: r.clicks,
        estimated_clicks_at_3: estimatedAt3,
        traffic_gain: estimatedAt3 - r.clicks,
      };
    })
    .filter((r) => r.traffic_gain > 0)
    .sort((a, b) => b.traffic_gain - a.traffic_gain)
    .slice(0, 20);
}

function analyzeCtrGaps(rows: GscRow[]): CtrGapOpportunity[] {
  return rows
    .filter((r) => r.impressions >= 10 && r.position >= 1 && r.position < 10)
    .map((r) => {
      const benchmark = getBenchmarkCtr(r.position);
      const gap = benchmark - r.ctr;
      return {
        query: r.query,
        page: r.page,
        position: Math.round(r.position * 10) / 10,
        impressions: r.impressions,
        actual_ctr: Math.round(r.ctr * 1000) / 1000,
        benchmark_ctr: Math.round(benchmark * 1000) / 1000,
        ctr_gap: Math.round(gap * 1000) / 1000,
        missed_clicks: Math.round(r.impressions * gap),
      };
    })
    .filter((r) => r.ctr_gap > 0.02)
    .sort((a, b) => b.missed_clicks - a.missed_clicks)
    .slice(0, 20);
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

/**
 * Parse "April 1st", "Sep 20th" etc into month index (0-11) and day.
 * Year is NOT assigned here — it's determined by column order in fetchTabData.
 */
function parseMonthHeader(header: string): { monthIndex: number; day: number } | null {
  const cleaned = header.trim().replace(/(\d+)(st|nd|rd|th)/i, "$1");
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;

  const monthStr = parts[0].toLowerCase();
  const day = parseInt(parts[1], 10);
  if (isNaN(day)) return null;

  let monthIndex = MONTH_NAMES.indexOf(monthStr);
  if (monthIndex === -1) monthIndex = MONTH_ABBREVS.indexOf(monthStr);
  if (monthIndex === -1) return null;

  return { monthIndex, day };
}

function cleanRank(value: string): number | null {
  if (!value || !value.trim()) return null;
  const v = value.trim().toUpperCase();
  if (v === "OTR") return OTR_CAP;
  const rank = parseInt(v, 10);
  if (isNaN(rank)) return null;
  return rank === 0 ? OTR_CAP : rank;
}

// ─── Tab data fetching ──────────────────────────────────────────────────────

type TabData = {
  keywords: string[];
  months: string[]; // "Apr 2025", "May 2025", ...
  ranks: (number | null)[][]; // ranks[keywordIdx][monthIdx]
};

async function fetchTabData(
  spreadsheets: SheetsClient,
  tabName: string,
): Promise<TabData | null> {
  const result = await spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${tabName}'`,
  });

  const rows = result.data.values;
  if (!rows || rows.length === 0) return null;

  const headers = rows[0] as string[];

  // Find date columns (parse month/day only)
  const parsed: { colIdx: number; monthIndex: number; day: number }[] = [];
  for (let i = 1; i < headers.length; i++) {
    const p = parseMonthHeader(headers[i] ?? "");
    if (p) parsed.push({ colIdx: i, ...p });
  }
  if (parsed.length === 0) return null;

  // Assign years: first column starts at 2025 (when tracking began in this sheet).
  // Bump year when month index goes backward (e.g., Dec → Jan).
  let year = 2025;
  let prevMonth = parsed[0].monthIndex;
  const monthCols: { colIdx: number; date: Date }[] = [];
  for (const p of parsed) {
    if (p.monthIndex < prevMonth) year++;
    prevMonth = p.monthIndex;
    monthCols.push({ colIdx: p.colIdx, date: new Date(year, p.monthIndex, p.day) });
  }

  monthCols.sort((a, b) => a.date.getTime() - b.date.getTime());

  const keywords: string[] = [];
  const ranks: (number | null)[][] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as string[];
    if (!row[0] || !row[0].trim()) continue;
    keywords.push(row[0].trim());
    const rowRanks: (number | null)[] = [];
    for (const { colIdx } of monthCols) {
      const raw = colIdx < row.length ? row[colIdx] : "";
      rowRanks.push(cleanRank(raw));
    }
    ranks.push(rowRanks);
  }

  const months = monthCols.map(({ date }) => {
    return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
  });

  return { keywords, months, ranks };
}

// ─── Analysis functions ─────────────────────────────────────────────────────

function computeAggregateChange(data: TabData): SeoAggregateChange[] {
  const results: SeoAggregateChange[] = [];
  for (let m = 0; m < data.months.length - 1; m++) {
    let change = 0;
    let count = 0;
    for (let k = 0; k < data.keywords.length; k++) {
      const prev = data.ranks[k][m];
      const curr = data.ranks[k][m + 1];
      if (prev != null && curr != null) {
        change += prev - curr; // positive = improved (rank went down)
        count++;
      }
    }
    if (count === 0) continue;
    results.push({
      transition: `${data.months[m]} -> ${data.months[m + 1]}`,
      change,
      keywords_measured: count,
    });
  }
  return results;
}

function computeVisibility(data: TabData): SeoVisibilityScore[] {
  const results: SeoVisibilityScore[] = [];
  for (let m = 0; m < data.months.length; m++) {
    let score = 0;
    let count = 0;
    for (let k = 0; k < data.keywords.length; k++) {
      const rank = data.ranks[k][m];
      if (rank != null) {
        score += 1.0 / rank;
        count++;
      }
    }
    if (count === 0) continue;
    results.push({
      month: data.months[m],
      score: Math.round(score * 1000) / 1000,
      keywords_tracked: count,
    });
  }
  return results;
}

function computeTiers(data: TabData): SeoTierDistribution[] {
  const results: SeoTierDistribution[] = [];
  for (let m = 0; m < data.months.length; m++) {
    let first = 0, top3 = 0, top5 = 0, top10 = 0, below10 = 0;
    let hasData = false;
    for (let k = 0; k < data.keywords.length; k++) {
      const rank = data.ranks[k][m];
      if (rank == null) continue;
      hasData = true;
      if (rank === 1) first++;
      if (rank <= 3) top3++;
      if (rank <= 5) top5++;
      if (rank <= 10) top10++;
      if (rank > 10) below10++;
    }
    if (!hasData) continue;
    results.push({
      month: data.months[m],
      first_place: first,
      top_3: top3,
      top_5: top5,
      top_10: top10,
      below_10: below10,
    });
  }
  return results;
}

function computeMovers(data: TabData, n = 5): { improved: SeoMover[]; declined: SeoMover[] } {
  const improved: SeoMover[] = [];
  const declined: SeoMover[] = [];

  for (let k = 0; k < data.keywords.length; k++) {
    const validRanks: number[] = [];
    for (let m = 0; m < data.months.length; m++) {
      const r = data.ranks[k][m];
      if (r != null) validRanks.push(r);
    }
    if (validRanks.length < 2) continue;

    const firstRank = validRanks[0];
    const lastRank = validRanks[validRanks.length - 1];
    const change = firstRank - lastRank; // positive = improved

    const entry: SeoMover = {
      keyword: data.keywords[k],
      start_rank: firstRank,
      end_rank: lastRank,
      change,
    };

    if (change > 0) improved.push(entry);
    else if (change < 0) declined.push(entry);
  }

  improved.sort((a, b) => b.change - a.change);
  declined.sort((a, b) => a.change - b.change);

  return { improved: improved.slice(0, n), declined: declined.slice(0, n) };
}

// ─── Build keyword rows for AI context ──────────────────────────────────────

function buildKeywordRows(data: TabData): SeoKeywordRow[] {
  return data.keywords.map((keyword, k) => {
    const ranks: Record<string, number | null> = {};
    for (let m = 0; m < data.months.length; m++) {
      ranks[data.months[m]] = data.ranks[k][m];
    }
    return { keyword, ranks };
  });
}

// ─── Main executor ──────────────────────────────────────────────────────────

export async function fetchSeoRanking(
  period: MonthPeriod,
): Promise<SeoRankingMetrics> {
  const spreadsheets = getSheetsClient();
  const monthLabel = MONTH_LABELS[period.month - 1];
  const startDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const lastDay = new Date(period.year, period.month, 0).getDate();
  const endDate = `${period.year}-${String(period.month).padStart(2, "0")}-${lastDay}`;

  const sourceDetails: Record<string, SeoSourceDetail> = {};
  const loadedSources: string[] = [];
  const missingSources: string[] = [];

  // Fetch all tabs in parallel
  const tabEntries = Object.entries(TABS);
  const results = await Promise.allSettled(
    tabEntries.map(([, tabName]) => fetchTabData(spreadsheets, tabName)),
  );

  const sites: SeoSiteData[] = [];

  for (let i = 0; i < tabEntries.length; i++) {
    const [key, tabName] = tabEntries[i];
    const result = results[i];

    if (result.status === "rejected") {
      sourceDetails[key] = {
        displayName: tabName,
        status: "error",
        message: result.reason instanceof Error ? result.reason.message : "Unknown error",
      };
      missingSources.push(key);
      continue;
    }

    const tabData = result.value;
    if (!tabData) {
      sourceDetails[key] = {
        displayName: tabName,
        status: "warning",
        message: "No data found in tab",
      };
      missingSources.push(key);
      continue;
    }

    sourceDetails[key] = { displayName: tabName, status: "ok" };
    loadedSources.push(key);

    const aggregateChange = computeAggregateChange(tabData);
    const netChange = aggregateChange.reduce((sum, r) => sum + r.change, 0);

    const visibility = computeVisibility(tabData);
    let visibilityChangePct: number | null = null;
    if (visibility.length >= 2) {
      const first = visibility[0].score;
      const last = visibility[visibility.length - 1].score;
      if (first > 0) {
        visibilityChangePct = Math.round(((last - first) / first) * 1000) / 10;
      }
    }

    sites.push({
      site_key: key,
      site_name: tabName,
      keyword_count: tabData.keywords.length,
      months: tabData.months,
      aggregate_change: aggregateChange,
      net_change: netChange,
      visibility,
      visibility_change_pct: visibilityChangePct,
      tiers: computeTiers(tabData),
      movers: computeMovers(tabData),
      keywords: buildKeywordRows(tabData),
    });
  }

  // ─── GSC Quick Wins (optional) ──────────────────────────────────────────────

  const gscQuickWins: GscQuickWins[] = [];
  const gsc = getSearchConsoleClient();
  const gscSiteUrls = getGscSiteUrls();

  if (gsc && Object.keys(gscSiteUrls).length > 0) {
    const gscEntries = Object.entries(gscSiteUrls);
    const gscResults = await Promise.allSettled(
      gscEntries.map(([, url]) => fetchGscData(gsc, url, startDate, endDate)),
    );

    for (let i = 0; i < gscEntries.length; i++) {
      const [key] = gscEntries[i];
      const tabName = TABS[key] ?? key;
      const sourceKey = `gsc_${key}`;
      const result = gscResults[i];

      if (result.status === "rejected") {
        sourceDetails[sourceKey] = {
          displayName: `GSC: ${tabName}`,
          status: "error",
          message: result.reason instanceof Error ? result.reason.message : "Unknown error",
        };
        missingSources.push(sourceKey);
        continue;
      }

      const rows = result.value;
      sourceDetails[sourceKey] = { displayName: `GSC: ${tabName}`, status: "ok" };
      loadedSources.push(sourceKey);

      const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
      const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);

      gscQuickWins.push({
        site_key: key,
        site_name: tabName,
        total_queries: rows.length,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        striking_distance: analyzeStrikingDistance(rows),
        ctr_gaps: analyzeCtrGaps(rows),
      });
    }
  }

  return {
    period: {
      year: period.year,
      month: `${monthLabel} ${period.year}`,
      month_num: period.month,
      date_range: { start: startDate, end: endDate },
    },
    sites,
    gsc_quick_wins: gscQuickWins,
    metadata: {
      generated_at: new Date().toISOString(),
      loaded_sources: loadedSources,
      missing_sources: missingSources,
      source_details: sourceDetails,
    },
  };
}
