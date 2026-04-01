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

// ─── Parsing helpers ────────────────────────────────────────────────────────

/**
 * Parse "April 1st", "Sep 20th" etc into { month, day, year }.
 * Year assignment: months Apr-Dec = 2025, Jan-Mar = 2026.
 * // TODO: update year logic when sheet adds Apr 2026+ data
 */
function parseMonthHeader(header: string): Date | null {
  const cleaned = header.trim().replace(/(\d+)(st|nd|rd|th)/i, "$1");
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;

  const monthStr = parts[0].toLowerCase();
  const day = parseInt(parts[1], 10);
  if (isNaN(day)) return null;

  let monthIndex = MONTH_NAMES.indexOf(monthStr);
  if (monthIndex === -1) monthIndex = MONTH_ABBREVS.indexOf(monthStr);
  if (monthIndex === -1) return null;

  const year = monthIndex >= 3 ? 2025 : 2026; // Apr-Dec = 2025, Jan-Mar = 2026
  return new Date(year, monthIndex, day);
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

  // Find and sort date columns
  const monthCols: { colIdx: number; date: Date }[] = [];
  for (let i = 1; i < headers.length; i++) {
    const d = parseMonthHeader(headers[i] ?? "");
    if (d) monthCols.push({ colIdx: i, date: d });
  }
  if (monthCols.length === 0) return null;

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
    let top3 = 0, top5 = 0, top10 = 0, below10 = 0;
    let hasData = false;
    for (let k = 0; k < data.keywords.length; k++) {
      const rank = data.ranks[k][m];
      if (rank == null) continue;
      hasData = true;
      if (rank <= 3) top3++;
      if (rank <= 5) top5++;
      if (rank <= 10) top10++;
      if (rank > 10) below10++;
    }
    if (!hasData) continue;
    results.push({
      month: data.months[m],
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

  return {
    period: {
      year: period.year,
      month: `${monthLabel} ${period.year}`,
      month_num: period.month,
      date_range: { start: startDate, end: endDate },
    },
    sites,
    metadata: {
      generated_at: new Date().toISOString(),
      loaded_sources: loadedSources,
      missing_sources: missingSources,
      source_details: sourceDetails,
    },
  };
}
