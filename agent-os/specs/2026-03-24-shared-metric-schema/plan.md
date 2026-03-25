# Shared Metric Schema / Data Normalization Layer

## Context

The Marketing Director Dashboard pulls data from 6 sources (Meta Ads, Google Ads, BigQuery, GA4, Google Sheets, Monthly Analytics). Each uses different field names, units, and definitions for overlapping metrics. The critical problems: "conversions" means different things per platform (Meta Pixel purchases vs GA4 events vs actual BigQuery transactions), "revenue" can be platform-attributed or actual, and Google Ads reports monetary values in micros. This spec creates TypeScript interfaces and transformer functions that normalize everything into a shared structure the dashboard and AI assistant consume.

No API routes, no database, no React components. Pure types and functions in `src/lib/schemas/`.

## File Tree

```
src/lib/schemas/
  index.ts          -- Barrel export
  types.ts          -- Foundation types (DateRange, DataSource, DataProvenance, etc.)
  metrics.ts        -- Normalized metric interfaces (NormalizedRevenue, NormalizedAdSpend, etc.)
  dashboard.ts      -- DashboardMetrics aggregate type
  utils.ts          -- Utility functions (microsToUSD, normalizeEmail, percentChange, etc.)
  sources/          -- Raw API response types per source
  transformers/     -- Pure normalization functions per source
```

## Key Decisions

1. Conversions are an array of NormalizedConversions, one per source. Each carries source, attributionWindow, isGroundTruth. BigQuery is ground truth. Dashboard shows them side-by-side.
2. Revenue has `actual` (BigQuery ground truth) and `platformAttributed[]` (Meta, Google, GA4). No ambiguity about which is real.
3. CPA vs CAC are separate types. CPA = platform spend / platform conversions. CAC = total spend / BigQuery new customers.
4. Google Ads cost_micros always divided by 1_000_000.
5. All percentages stored as decimals (0.10 = 10%).
6. All dates as ISO YYYY-MM-DD strings.
