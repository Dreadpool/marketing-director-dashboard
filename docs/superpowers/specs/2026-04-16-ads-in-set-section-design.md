# Ads in This Set — Analyze Panel Section

## Goal

Add a per-ad section inside the existing AdSetAnalyzePanel that shows each ad's daily CTR sparkline, ranked by performance. No flags, no badges. The sparkline shape tells the story.

## Visual Reference

Mockup at `.superpowers/brainstorm/27188-1776393237/content/ads-in-set.html`

## Placement

Inside `AdSetAnalyzePanel` (`src/components/workflows/adset-analyze-panel.tsx`), between the diagnostic framework section and the action bar.

## What It Shows

A section with header "Ads in this set" and subtitle "Ranked by CTR. Sparklines show daily CTR over the period."

Each ad row (grid layout):
1. **Thumbnail** (40x40) — from `ad.image_url` or `ad.thumbnail_url` (already available in the ads array from the parent component). Falls back to a placeholder icon.
2. **Name + meta** — ad name, spend, purchases count. Best performer gets a green "Best in set" text tag. Worst gets a muted red "Lowest CTR" tag. Tags are plain text, not badges.
3. **CTR sparkline** — SVG polyline from daily CTR data points. Green stroke for best performer. Red stroke (dimmed) for worst. Gray for middle. Subtle area fill matching the stroke color. Last point gets a dot.
4. **CTR value** — right-aligned, color-coded (green if best, red if worst, muted otherwise).
5. **CPA value** — right-aligned, color-coded by the existing `cpaColor()` function logic (green < $9, amber $9-$14, red > $14).

## Ranking and Highlighting

Ads sorted by CTR descending (best at top). Highlighting:
- Best performer (rank 1): green left border (2px), subtle green background tint, green sparkline stroke.
- Worst performer (last rank): subtle red background tint, dimmed red sparkline stroke. Only if 3+ ads in the set (with 2 ads, "worst" is meaningless noise).
- Middle: neutral background, gray sparkline.

## Data Source

The `AdSetDailyTrendResponse` already contains per-ad daily data (`ads: AdDailyTrend[]`). Each `AdDailyTrend` has:
- `ad_id`, `ad_name`
- `daily: DailyPoint[]` (date, spend, impressions, clicks, purchases, cpa, ctr)
- `trend: TrendSummary`

The parent component (`meta-ads-fetch-summary.tsx`) also has the `ads` array with `image_url`/`thumbnail_url` from the fetch output. These need to be passed through to the panel or looked up by ad_id.

## Component Changes

**Modify:** `src/components/workflows/adset-analyze-panel.tsx`
- Add a new section between diagnostic framework and action bar
- Build sparkline data from `trendData.ads[].daily` (extract CTR per day)
- SVG sparkline: simple polyline + area path, no chart library needed (Recharts is overkill for sparklines)

**Modify:** `src/components/workflows/meta-ads-fetch-summary.tsx`
- Pass the `ads` array (with thumbnails) to `AdSetAnalyzePanel` as a new prop so it can look up image URLs by ad_id

**New prop on AdSetAnalyzePanel:**
```typescript
ads?: MetaAdsAdRow[]; // ads in this ad set, for thumbnail URLs
```

## No New API Calls

All data comes from the existing adset-daily response and the fetch output already in memory.
