# SEO Quick Wins: GSC Striking Distance + CTR Optimization

**Date:** 2026-04-05
**Status:** Design
**Workflow:** `seo-ranking-analysis` (extends existing)

## Problem

The SEO Ranking Analysis workflow tracks keyword positions and visibility trends. This tells you whether your SEO person is performing. It does NOT tell you what to focus on to grow organic traffic. The highest-leverage, lowest-cost SEO improvements come from two analyses that require Google Search Console data:

1. **Striking Distance**: Keywords ranking 5-20 where Google already considers you relevant but you're not getting clicks. Moving from position 12 to 6 increases traffic 5-10x.
2. **CTR Optimization**: Keywords ranking 1-10 where your actual click-through rate is below the benchmark for that position. Fix is usually a better title tag and meta description. Costs nothing. Results in 2-3 weeks.

## Design

### Architecture: Expand Existing Executor

The `fetchSeoRanking` executor gains GSC as a second data source alongside Google Sheets. GSC is optional - if credentials aren't configured or properties aren't accessible, the workflow still runs with ranking data only. The `SeoRankingMetrics` type expands with a `gsc_quick_wins` field.

### Data Source: Google Search Console API

**API**: `google.searchconsole` via `googleapis` (already installed v171.4.0)
**Auth**: Same service account credential pattern as Google Sheets (`GOOGLE_CREDENTIALS_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`). Scope: `https://www.googleapis.com/auth/webmasters.readonly`.
**Prerequisite**: Service account email must be added as a user on each GSC property.

**Environment variable**:
```
GSC_SITE_URLS=sc-domain:saltlakeexpress.com,sc-domain:slecharters.com,sc-domain:northwesternstage.com
```
Comma-separated list of GSC property URLs. Maps to site keys (`sle`, `charters`, `nwsl`) by order (same order as the `TABS` constant in the executor).

**API call per site**:
```
searchconsole.searchanalytics.query({
  siteUrl: propertyUrl,
  requestBody: {
    startDate: period start (YYYY-MM-DD),
    endDate: period end (YYYY-MM-DD),
    dimensions: ["query", "page"],
    rowLimit: 1000,
    dataState: "final"
  }
})
```

Returns rows with: `keys[0]` = query, `keys[1]` = page URL, `clicks`, `impressions`, `ctr`, `position`.

### Data Processing

**Noise filter**: Exclude queries with < 10 impressions (too noisy to act on).

**Striking Distance Analysis** (per site):
- Filter: position >= 5 AND position <= 20
- Sort: impressions DESC
- For each query, estimate traffic gain if moved to position 3:
  - `estimated_clicks_at_pos3 = impressions * 0.102` (10.2% CTR at position 3)
  - `traffic_gain = estimated_clicks_at_pos3 - clicks`
- Return top 20 by traffic_gain

**CTR Optimization Analysis** (per site):
- Filter: position >= 1 AND position < 10
- For each query, compare actual CTR to benchmark:
  - `ctr_gap = benchmark_ctr(position) - actual_ctr`
  - `missed_clicks = impressions * ctr_gap`
- Filter: only queries where `ctr_gap > 0.02` (at least 2% underperformance)
- Sort: missed_clicks DESC
- Return top 20 by missed_clicks

**CTR Benchmarks** (First Page Sage 2025, organic desktop):

| Position | Benchmark CTR |
|----------|--------------|
| 1 | 39.8% |
| 2 | 18.7% |
| 3 | 10.2% |
| 4 | 7.2% |
| 5 | 5.1% |
| 6 | 4.4% |
| 7 | 3.0% |
| 8 | 2.1% |
| 9 | 1.9% |
| 10 | 1.6% |

For fractional positions (e.g., 3.7), use `Math.round(position)` to snap to the nearest integer, then look up the benchmark. Positions > 10 use 1.0% as the benchmark floor.

### Type Additions

Extend `SeoRankingMetrics` in `src/lib/schemas/sources/seo-ranking-metrics.ts`:

```typescript
export type GscQueryRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

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

// Add to SeoRankingMetrics:
export type SeoRankingMetrics = {
  period: SeoRankingPeriod;
  sites: SeoSiteData[];
  gsc_quick_wins: GscQuickWins[];  // NEW - empty array if GSC not configured
  metadata: {
    generated_at: string;
    loaded_sources: string[];
    missing_sources: string[];
    source_details: Record<string, SeoSourceDetail>;
  };
};
```

### Executor Changes

In `src/lib/workflows/executors/fetch-seo-ranking.ts`:

1. Add GSC client singleton (`getSearchConsoleClient()`) following the same pattern as `getSheetsClient()`
2. Read `GSC_SITE_URLS` env var, parse into array
3. After fetching Google Sheets data, fetch GSC data for each site via `Promise.allSettled`
4. Run striking distance and CTR gap analyses
5. Add results to `gsc_quick_wins` array
6. Track GSC sources in metadata (`gsc_sle`, `gsc_charters`, `gsc_nwsl`)

If `GSC_SITE_URLS` is not set, skip GSC entirely and return empty `gsc_quick_wins: []`.

### Visualization Changes

In `src/components/workflows/seo-ranking-fetch-summary.tsx`:

Add a new top-level collapsible section "GSC Quick Wins" after the per-site ranking sections (only rendered if `data.gsc_quick_wins.length > 0`).

Per site within this section:

**Striking Distance Opportunities** table:
- Columns: Query | Page | Position | Impressions | Current Clicks | Est. Gain
- Color: traffic_gain > 50 = green, > 20 = amber, else default
- Truncate page URL to path only

**CTR Optimization Opportunities** table:
- Columns: Query | Page | Position | Impressions | Actual CTR | Benchmark | Missed Clicks
- Color: missed_clicks > 50 = green, > 20 = amber, else default
- Show CTR as percentages

### Prompt Updates

Update `src/lib/workflows/prompts/seo-ranking.ts`:

**analyze prompt** additions:
- Add context about GSC Quick Wins data being available
- Ask AI to highlight the highest-impact striking distance opportunities
- Ask AI to identify patterns in CTR underperformance (are title tags generic? missing price/schedule info?)

**recommend prompt** additions:
- Add `title-optimization` as a new CATEGORY option
- Action items should reference specific queries and pages from the GSC data
- Prioritize based on traffic_gain and missed_clicks numbers

### Workflow Definition Changes

Update `src/lib/workflows.ts`:
- Add `"google_search_console"` to dataSources array
- Update description to mention GSC quick wins

### Data Source Type

Add `"google_search_console"` to the `DataSource` union in `src/lib/schemas/types.ts`.

### Setup Verification

Add GSC connection check in `src/app/api/data-sources/route.ts` that:
1. Checks if `GSC_SITE_URLS` env var is set
2. Attempts to list sites via `searchconsole.sites.list()` to verify access
3. Reports status per property

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/schemas/sources/seo-ranking-metrics.ts` | Add GSC types, extend SeoRankingMetrics |
| `src/lib/schemas/types.ts` | Add `google_search_console` to DataSource |
| `src/lib/workflows/executors/fetch-seo-ranking.ts` | Add GSC client, fetch, analysis logic |
| `src/lib/workflows/prompts/seo-ranking.ts` | Update analyze + recommend prompts |
| `src/lib/workflows.ts` | Update dataSources array and description |
| `src/components/workflows/seo-ranking-fetch-summary.tsx` | Add GSC Quick Wins visualization |
| `src/app/api/data-sources/route.ts` | Add GSC connection check |

## Verification

1. `npm run build` passes
2. Without `GSC_SITE_URLS`: workflow runs normally, no GSC section appears
3. With `GSC_SITE_URLS` configured and service account added to properties:
   - Navigate to `/workflows/seo-ranking-analysis`
   - Run for March 2026
   - Verify GSC Quick Wins section appears with striking distance and CTR gap tables
   - Verify analyze step references GSC opportunities
   - Verify recommend step produces specific action items with query/page references
4. Check `/settings/data-sources` shows GSC connection status
