# SEO Quick Wins (GSC Striking Distance + CTR Optimization) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Search Console data to the existing SEO Ranking Analysis workflow, showing striking distance keywords (ranks 5-20 with high impressions) and CTR optimization opportunities (ranks 1-10 underperforming their position's benchmark CTR).

**Architecture:** Expand the existing `fetchSeoRanking` executor to fetch GSC data as an optional second source alongside Google Sheets. GSC data is processed into two analysis tables per site. If `GSC_SITE_URLS` env var is not set, GSC is silently skipped and the workflow runs as before.

**Tech Stack:** `googleapis` (v171.4.0, already installed), Google Search Console API v1 (`searchconsole.searchanalytics.query`), same service account credential pattern as Google Sheets.

**Spec:** `docs/superpowers/specs/2026-04-05-seo-quick-wins-design.md`

---

### Task 1: Add GSC Types to Schema

**Files:**
- Modify: `src/lib/schemas/sources/seo-ranking-metrics.ts`
- Modify: `src/lib/schemas/types.ts`

- [ ] **Step 1: Add GSC types to seo-ranking-metrics.ts**

Add before the existing `SeoRankingMetrics` type:

```typescript
export type StrikingDistanceOpportunity = {
  query: string;
  page: string;
  position: number;
  impressions: number;
  current_clicks: number;
  estimated_clicks_at_3: number;
  traffic_gain: number;
};

export type CtrGapOpportunity = {
  query: string;
  page: string;
  position: number;
  impressions: number;
  actual_ctr: number;
  benchmark_ctr: number;
  ctr_gap: number;
  missed_clicks: number;
};

export type GscQuickWins = {
  site_key: string;
  site_name: string;
  total_queries: number;
  total_impressions: number;
  total_clicks: number;
  striking_distance: StrikingDistanceOpportunity[];
  ctr_gaps: CtrGapOpportunity[];
};
```

- [ ] **Step 2: Add `gsc_quick_wins` field to SeoRankingMetrics**

Change the existing `SeoRankingMetrics` type to add the field:

```typescript
export type SeoRankingMetrics = {
  period: SeoRankingPeriod;
  sites: SeoSiteData[];
  gsc_quick_wins: GscQuickWins[];
  metadata: {
    generated_at: string;
    loaded_sources: string[];
    missing_sources: string[];
    source_details: Record<string, SeoSourceDetail>;
  };
};
```

- [ ] **Step 3: Add `google_search_console` to DataSource union**

In `src/lib/schemas/types.ts`, add `"google_search_console"` to the `DataSource` union:

```typescript
export type DataSource =
  | "meta_ads"
  | "google_ads"
  | "bigquery"
  | "ga4"
  | "quickbooks_gl"
  | "google_sheets"
  | "google_search_console"
  | "monthly_analytics";
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: Type errors in `fetch-seo-ranking.ts` (missing `gsc_quick_wins` in return value) — this is expected and will be fixed in Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/sources/seo-ranking-metrics.ts src/lib/schemas/types.ts
git commit -m "feat: add GSC quick wins types to SEO schema"
```

---

### Task 2: Add GSC Fetch + Analysis to Executor

**Files:**
- Modify: `src/lib/workflows/executors/fetch-seo-ranking.ts`

- [ ] **Step 1: Add GSC client singleton and CTR benchmarks**

Add after the existing `getSheetsClient()` function (around line 72):

```typescript
// ─── Google Search Console client ───────────────────────────────────────────

import type {
  StrikingDistanceOpportunity,
  CtrGapOpportunity,
  GscQuickWins,
} from "@/lib/schemas/sources/seo-ranking-metrics";

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

/** GSC property URLs mapped to site keys by order (same as TABS) */
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
  1: 0.398,
  2: 0.187,
  3: 0.102,
  4: 0.072,
  5: 0.051,
  6: 0.044,
  7: 0.030,
  8: 0.021,
  9: 0.019,
  10: 0.016,
};

function getBenchmarkCtr(position: number): number {
  const rounded = Math.round(position);
  if (rounded < 1) return CTR_BENCHMARKS[1];
  if (rounded > 10) return 0.01;
  return CTR_BENCHMARKS[rounded] ?? 0.01;
}
```

- [ ] **Step 2: Add GSC fetch and analysis functions**

Add after the `getBenchmarkCtr` function:

```typescript
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
```

- [ ] **Step 3: Update the main executor to fetch GSC data**

In the `fetchSeoRanking` function, after the Google Sheets fetch loop (after `sites.push(...)` block, around line 368), add GSC fetching before the return statement:

```typescript
  // ─── GSC Quick Wins (optional) ──────────────────────────────────────────────

  const gscQuickWins: GscQuickWins[] = [];
  const gscClient = getSearchConsoleClient();
  const gscSiteUrls = getGscSiteUrls();

  if (gscClient && Object.keys(gscSiteUrls).length > 0) {
    const gscEntries = Object.entries(gscSiteUrls);
    const gscResults = await Promise.allSettled(
      gscEntries.map(([, url]) => fetchGscData(gscClient, url, startDate, endDate)),
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
```

- [ ] **Step 4: Add `gsc_quick_wins` to the return statement**

Change the return object to include the new field:

```typescript
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
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (or errors only in visualization component, fixed in Task 4)

- [ ] **Step 6: Commit**

```bash
git add src/lib/workflows/executors/fetch-seo-ranking.ts
git commit -m "feat: add GSC striking distance + CTR gap analysis to SEO executor"
```

---

### Task 3: Update Workflow Definition + Prompts

**Files:**
- Modify: `src/lib/workflows.ts`
- Modify: `src/lib/workflows/prompts/seo-ranking.ts`

- [ ] **Step 1: Update workflow definition**

In `src/lib/workflows.ts`, find the `seo-ranking-analysis` entry and update:

```typescript
    description:
      "Keyword rank tracking, visibility scoring, tier distribution, biggest movers, and GSC quick wins (striking distance + CTR optimization).",
    // ...
    dataSources: ["google_sheets", "google_search_console"],
```

- [ ] **Step 2: Update analyze prompt**

In `src/lib/workflows/prompts/seo-ranking.ts`, add after the existing "CRITICAL" block in the analyze prompt (after the list of dashboard sections):

```
If GSC Quick Wins data is available, the dashboard also shows:
- Striking Distance table: queries ranking 5-20, sorted by estimated traffic gain if moved to position 3
- CTR Optimization table: queries ranking 1-10 where actual CTR underperforms the benchmark for that position

When GSC data is present, additionally focus on:
- Which striking distance keywords have the highest commercial intent (route queries > informational)
- Patterns in CTR underperformance (are title tags generic? missing pricing/schedule info? weak meta descriptions?)
- Cross-referencing: are any Google Sheets ranking improvements NOT reflected in GSC impressions (or vice versa)?
```

- [ ] **Step 3: Update recommend prompt**

In `src/lib/workflows/prompts/seo-ranking.ts`, update the CATEGORY line in the recommend prompt:

```
CATEGORY: [content/technical/link-building/local-seo/monitoring/title-optimization]
```

And add after the "SLE Business Context" section:

```
## GSC Quick Wins Context (when available)
If the data includes GSC striking distance and CTR gap tables, prioritize action items that:
- Target striking distance queries with the highest traffic_gain numbers
- Recommend specific title tag and meta description rewrites for CTR underperformers
- Reference the exact query and page URL from the GSC data
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/workflows.ts src/lib/workflows/prompts/seo-ranking.ts
git commit -m "feat: update SEO workflow definition and prompts for GSC data"
```

---

### Task 4: Add GSC Quick Wins Visualization

**Files:**
- Modify: `src/components/workflows/seo-ranking-fetch-summary.tsx`

- [ ] **Step 1: Add the GscQuickWinsSection component**

Add a new component before the `SeoRankingFetchSummary` export (around line 455). Import the needed types at the top of the file alongside existing imports:

```typescript
import type {
  SeoRankingMetrics,
  SeoSiteData,
  SeoSourceDetail,
  GscQuickWins,
  StrikingDistanceOpportunity,
  CtrGapOpportunity,
} from "@/lib/schemas/sources/seo-ranking-metrics";
```

Then the component:

```tsx
// ─── GSC Quick Wins section ─────────────────────────────────────────────────

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = new Intl.NumberFormat("en-US");

function pathOnly(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function gainColor(n: number): string {
  if (n > 50) return "text-emerald-400";
  if (n > 20) return "text-amber-400";
  return "";
}

function GscSiteSection({ data }: { data: GscQuickWins }) {
  return (
    <CollapsibleSection title={data.site_name} defaultOpen>
      <div className="space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            label="GSC Queries"
            value={num.format(data.total_queries)}
            tooltip="Total queries with at least 1 impression in this period"
          />
          <MetricCard
            label="Total Impressions"
            value={num.format(data.total_impressions)}
            tooltip="Total search impressions across all queries"
          />
          <MetricCard
            label="Total Clicks"
            value={num.format(data.total_clicks)}
            tooltip="Total clicks from search results"
          />
        </div>

        {/* Striking Distance */}
        {data.striking_distance.length > 0 && (
          <CollapsibleSection title="Striking Distance Opportunities" defaultOpen>
            <p className="text-[11px] text-muted-foreground mb-2">
              Queries ranking 5-20 with the highest estimated traffic gain if moved to position 3.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Query</th>
                    <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Page</th>
                    <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Pos</th>
                    <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Impr</th>
                    <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Clicks</th>
                    <th className="text-right py-1.5 pl-2 font-medium text-muted-foreground">Est. Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {data.striking_distance.map((row) => (
                    <tr key={`${row.query}-${row.page}`} className="border-b border-border/30">
                      <td className="py-1.5 pr-3 max-w-[200px] truncate" title={row.query}>{row.query}</td>
                      <td className="py-1.5 pr-3 max-w-[150px] truncate text-muted-foreground" title={row.page}>{pathOnly(row.page)}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{row.position}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">{num.format(row.impressions)}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">{row.current_clicks}</td>
                      <td className={`text-right py-1.5 pl-2 tabular-nums font-medium ${gainColor(row.traffic_gain)}`}>+{row.traffic_gain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}

        {/* CTR Gaps */}
        {data.ctr_gaps.length > 0 && (
          <CollapsibleSection title="CTR Optimization Opportunities" defaultOpen>
            <p className="text-[11px] text-muted-foreground mb-2">
              Queries ranking 1-10 where actual CTR is below the benchmark for that position. Fix with better title tags and meta descriptions.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Query</th>
                    <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Page</th>
                    <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Pos</th>
                    <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Impr</th>
                    <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">CTR</th>
                    <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Bench</th>
                    <th className="text-right py-1.5 pl-2 font-medium text-muted-foreground">Missed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ctr_gaps.map((row) => (
                    <tr key={`${row.query}-${row.page}`} className="border-b border-border/30">
                      <td className="py-1.5 pr-3 max-w-[200px] truncate" title={row.query}>{row.query}</td>
                      <td className="py-1.5 pr-3 max-w-[150px] truncate text-muted-foreground" title={row.page}>{pathOnly(row.page)}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{row.position}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">{num.format(row.impressions)}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-red-400">{pct(row.actual_ctr)}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">{pct(row.benchmark_ctr)}</td>
                      <td className={`text-right py-1.5 pl-2 tabular-nums font-medium ${gainColor(row.missed_clicks)}`}>+{row.missed_clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}
      </div>
    </CollapsibleSection>
  );
}
```

- [ ] **Step 2: Add the GSC section to the main component**

In the `SeoRankingFetchSummary` component, add after the per-site sections loop and before the empty state check:

```tsx
      {/* GSC Quick Wins */}
      {data.gsc_quick_wins && data.gsc_quick_wins.length > 0 && (
        <CollapsibleSection title="GSC Quick Wins" defaultOpen>
          <div className="space-y-4">
            {data.gsc_quick_wins.map((gsc) => (
              <GscSiteSection key={gsc.site_key} data={gsc} />
            ))}
          </div>
        </CollapsibleSection>
      )}
```

- [ ] **Step 3: Update the type guard to handle backward compatibility**

The `isSeoRankingMetrics` type guard doesn't need changes since it checks for `sites` and `metadata`, not `gsc_quick_wins`. But older cached data won't have `gsc_quick_wins`, so the rendering code already handles this with the `data.gsc_quick_wins &&` check.

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/workflows/seo-ranking-fetch-summary.tsx
git commit -m "feat: add GSC Quick Wins visualization to SEO fetch summary"
```

---

### Task 5: Add GSC Data Source Status Check

**Files:**
- Modify: `src/app/api/data-sources/route.ts`

- [ ] **Step 1: Add GSC connection check**

In the data sources route, add a GSC entry to the sources array (after the GA4 entry):

```typescript
      {
        name: "Google Search Console",
        description: "Keyword impressions, clicks, CTR, position",
        status: process.env.GSC_SITE_URLS ? "ok" : "not_configured",
        lastChecked: process.env.GSC_SITE_URLS ? new Date().toISOString() : null,
      },
```

This is a simple env var check (matching the GA4 pattern). Full connection testing is done at fetch time via `Promise.allSettled`.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/data-sources/route.ts
git commit -m "feat: add GSC to data sources status page"
```

---

### Task 6: Build Verification + Cache Clear

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 2: Clear cached SEO data**

Old cached runs won't have `gsc_quick_wins`. Clear the cache so the next run fetches fresh:

```bash
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.POSTGRES_URL);
(async () => {
  await sql\`DELETE FROM period_metrics WHERE workflow_slug = 'seo-ranking-analysis'\`;
  console.log('Cleared SEO period metrics cache');
})();
"
```

- [ ] **Step 3: Test without GSC (graceful fallback)**

Ensure `GSC_SITE_URLS` is NOT set in `.env.local`. Navigate to `/workflows/seo-ranking-analysis`, run for March 2026. Verify:
- Workflow completes normally
- Ranking data displays as before
- No "GSC Quick Wins" section appears
- No errors in console

- [ ] **Step 4: Configure GSC access**

Add service account to GSC properties:
1. Go to https://search.google.com/search-console
2. For each property (saltlakeexpress.com, slecharters.com, northwesternstage.com):
   - Settings → Users and permissions → Add user
   - Email: `bigquery-analysis-sa@jovial-root-443516-a7.iam.gserviceaccount.com`
   - Permission: Restricted (read-only)
3. Add to `.env.local`:
```
GSC_SITE_URLS=sc-domain:saltlakeexpress.com,sc-domain:slecharters.com,sc-domain:northwesternstage.com
```

- [ ] **Step 5: Test with GSC**

Clear cache again, run the workflow. Verify:
- GSC source badges appear (green for accessible properties)
- "GSC Quick Wins" section renders with striking distance and CTR gap tables
- Tables show query, page, position, impressions, and gain/missed columns
- Analyze step references GSC opportunities
- Recommend step includes title-optimization action items

- [ ] **Step 6: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: SEO Quick Wins - GSC striking distance + CTR optimization"
```
