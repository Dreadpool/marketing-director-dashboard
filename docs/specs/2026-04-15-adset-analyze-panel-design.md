# Ad Set Analyze Panel — Design Spec

## Goal

When a user clicks "Analyze" on a flagged ad set, an inline panel expands below the row showing weekly trends, peer comparison, a diagnostic framework, and a recommended action. Everything is deterministic (no LLM). The user sees exactly what's wrong and what to do.

## Visual Reference

Mockup at `.superpowers/brainstorm/67993-1776305591/content/analyze-panel.html`

## What the Panel Shows

### 1. Header

**Left side:** Ad set name + plain English diagnosis. One or two sentences generated from data patterns:
- "CTR is {pctBelow}% below campaign median ({adsetCtr}% vs {medianCtr}%). Frequency is {freq}. This pattern indicates **audience exhaustion**."
- "CPA increased {cpaPct}% vs last month while campaign CPA stayed flat. This ad set is underperforming relative to peers."

**Right side:** Context pills — Frequency, Days Running, Spend, % of Campaign Spend.

### 2. Two Charts (side by side)

**Left: CTR Over Time** — Line chart (Recharts). Gold line = this ad set's weekly CTR. Dashed gray line = campaign median CTR. Area fill under the gold line.

**Right: CPA Over Time** — Line chart. Red line = this ad set's weekly CPA. Dashed gray line = campaign median CPA. Green dashed line = $9 target CPA.

Both charts show weekly data points for the month. X-axis = week start dates. Y-axis = metric value.

Data source: the existing `/api/workflows/meta-ads-analysis/adset-daily` endpoint returns daily points per ad. Aggregate daily points to weekly for the ad set (sum spend/clicks/impressions/purchases across all ads in the set, compute CTR and CPA per week).

Campaign median: compute from all ad sets in the campaign (already available in the fetch output passed as props).

### 3. Peer Comparison

Horizontal bar chart. All ad sets in the campaign ranked by CTR. Each bar's width = proportional CTR. The current ad set is highlighted (amber fill, bold name with arrow indicator). Campaign median marked with a vertical line and label.

Data source: all ad sets from the same campaign, already available in the parent component's data.

### 4. Diagnostic Framework

Four cards in a 2x2 grid. Each card describes one scenario:

| Card | Signal | Problem | Action |
|------|--------|---------|--------|
| 1 | Low CTR + Low Frequency | Audience or creative mismatch | Compare creative across ad sets |
| 2 | Low CTR + High Frequency | Audience exhaustion | Refresh creative or expand audience |
| 3 | Good CTR + Low Conversions | Post-click problem | Check landing page |
| 4 | Rising CPA + Stable Metrics | Auction competition | Ride it out or find new audience |

One card is highlighted (gold border + gold background tint). Selection logic:

```
highFreq = adset.frequency >= 3.5
lowCtr = adset CTR is 25%+ below campaign median (same threshold as the flag)
goodCtr = !lowCtr
lowCvr = adset has clicks but conversion rate is bottom 30% of campaign (or zero purchases)
risingCpa = adset.mom.cpa_pct >= 25 AND campaign.mom.cpa_pct < 25

if lowCtr AND highFreq → card 2 (exhaustion)
if lowCtr AND !highFreq → card 1 (audience/creative)
if goodCtr AND lowCvr → card 3 (post-click)
if risingCpa AND !lowCtr → card 4 (auction competition)
fallback → card 1
```

Non-active cards are dimmed (opacity 0.4).

### 5. Action Bar

Bottom strip. Left side: icon + recommended action (one sentence) + supporting detail. Right side: "Collapse" button.

Action text is deterministic, keyed to the active diagnostic card:
- Card 1: "Review creative in this ad set. If similar creative works in other ad sets, the audience is wrong."
- Card 2: "Refresh creative or expand the audience. Frequency is {freq} and CTR has dropped {pct}% over the period."
- Card 3: "Check the landing page. CTR is strong ({ctr}%) but conversion rate is {cvr}%."
- Card 4: "Auction competition is driving costs up. Consider pausing or finding a less competitive audience."

## Data Flow

1. User clicks "Analyze" on an ad set row
2. Existing `handleAnalyze()` POSTs to `/api/workflows/meta-ads-analysis/adset-daily`
3. Response contains daily points per ad in the ad set
4. `AdSetAnalyzePanel` receives:
   - `trendData: AdSetDailyTrendResponse` (daily points per ad)
   - `adSet: MetaAdsAdSetRow` (the flagged ad set)
   - `campaignAdSets: MetaAdsAdSetRow[]` (all ad sets in the same campaign)
   - `period: MetaAdsPeriod`
5. Panel computes:
   - Weekly aggregates from daily points (sum across ads, then group by week)
   - Campaign median CTR per week (from campaignAdSets or from daily data if available)
   - Which diagnostic card to highlight
   - Action text
6. Panel renders the five sections

## Components

| Component | File | Purpose |
|-----------|------|---------|
| `AdSetAnalyzePanel` | `src/components/workflows/adset-analyze-panel.tsx` | Main panel, orchestrates layout |
| Inline in panel | — | Trend charts (Recharts `LineChart` with `Area`) |
| Inline in panel | — | Peer comparison bars (simple div-based, no chart library needed) |
| Inline in panel | — | Diagnostic grid + action bar |

Single file. The panel is self-contained. Charts use Recharts (already installed). Peer bars are CSS divs (simpler and more controllable than a chart library for horizontal bars).

## What Changes in Existing Code

**`meta-ads-fetch-summary.tsx`:**
- Import `AdSetAnalyzePanel`
- When `trendData` exists for an ad set, render `AdSetAnalyzePanel` below the ad set row instead of (or in addition to) the individual ad rows
- Pass `campaignAdSets` (filter `data.adsets` by `campaign_id`)

**No API changes.** The existing adset-daily endpoint provides all the daily data needed. Campaign peer data is already in the fetch output.

## Campaign Median for Charts

For the weekly campaign median overlay, we need weekly CTR/CPA for the campaign as a whole. Two options:

**Option A (simple):** Use the monthly aggregate campaign median as a flat dashed line. No weekly breakdown. This is what the mockup shows.

**Option B (richer):** Fetch daily data for ALL ad sets in the campaign and compute weekly medians. This requires multiple API calls or a new endpoint.

**Decision: Option A.** A flat median line is clear and requires no extra API calls. The user sees "your ad set is below the campaign average" without needing the campaign's weekly fluctuation. The trend shape of the ad set's own line is the primary signal.

## Backward Compatibility

The Analyze button already exists. Old runs without daily data: clicking Analyze still works (fetches on demand). The panel renders from whatever data comes back. If no daily data is available (API error), the existing error state displays.

Ad sets without flags can still be analyzed (the button is already there for all ad sets with ads). The diagnostic framework still highlights whichever scenario matches the data, regardless of whether a flag fired.
