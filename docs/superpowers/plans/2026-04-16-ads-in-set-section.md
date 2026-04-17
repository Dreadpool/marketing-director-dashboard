# Ads in This Set — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-ad sparkline section inside the AdSetAnalyzePanel showing each ad's daily CTR trend, ranked by performance.

**Architecture:** Add an "Ads in this set" section to the existing `AdSetAnalyzePanel` component between the diagnostic framework and the action bar. SVG sparklines (no chart library — simpler than Recharts for small inline charts). Pass the parent's `ads` array as a new prop for thumbnail URLs.

**Tech Stack:** React, TypeScript, Tailwind CSS, inline SVG for sparklines.

**Spec:** `docs/superpowers/specs/2026-04-16-ads-in-set-section-design.md`
**Mockup:** `.superpowers/brainstorm/27188-1776393237/content/ads-in-set.html`

---

## File Structure

| File | Change |
|------|--------|
| **Modify:** `src/components/workflows/adset-analyze-panel.tsx` | Add `ads` prop, add "Ads in this set" section with sparklines |
| **Modify:** `src/components/workflows/meta-ads-fetch-summary.tsx` | Pass `ads` prop (filtered by ad set) to `AdSetAnalyzePanel` |

---

### Task 1: Add "Ads in this set" section to the panel

**Files:**
- Modify: `src/components/workflows/adset-analyze-panel.tsx`

- [ ] **Step 1: Add `MetaAdsAdRow` to the type import and add `ads` prop**

In `adset-analyze-panel.tsx`, update the type import (line 14-18) to include `MetaAdsAdRow`:

```typescript
import type {
  MetaAdsAdSetRow,
  MetaAdsCampaignRow,
  MetaAdsAdRow,
  AdSetDailyTrendResponse,
} from "@/lib/schemas/sources/meta-ads-metrics";
```

Update the `AdSetAnalyzePanelProps` interface (line 144-150) to add the `ads` prop:

```typescript
interface AdSetAnalyzePanelProps {
  adSet: MetaAdsAdSetRow;
  trendData: AdSetDailyTrendResponse;
  campaignAdSets: MetaAdsAdSetRow[];
  campaign: MetaAdsCampaignRow;
  ads?: MetaAdsAdRow[];
  onCollapse: () => void;
}
```

Update the destructuring (line 152-158) to include `ads`:

```typescript
export function AdSetAnalyzePanel({
  adSet,
  trendData,
  campaignAdSets,
  campaign,
  ads,
  onCollapse,
}: AdSetAnalyzePanelProps) {
```

- [ ] **Step 2: Add the sparkline helper function**

Add this function before the main component (after the `pctFmt` formatter, around line 140):

```typescript
// ─── Sparkline SVG ──────────────────────────────────────────────────────────

function Sparkline({ points, color, fillColor }: { points: number[]; color: string; fillColor: string }) {
  if (points.length < 2) return null;

  const width = 280;
  const height = 36;
  const padding = 2;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => ({
    x: padding + (i / (points.length - 1)) * (width - padding * 2),
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
  }));

  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPath = `M${coords[0].x},${coords[0].y} ${coords.map((c) => `L${c.x},${c.y}`).join(" ")} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[36px]" preserveAspectRatio="none">
      <path d={areaPath} fill={fillColor} />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2" fill={color} />
    </svg>
  );
}
```

- [ ] **Step 3: Add the "Ads in this set" section**

Insert this block between the diagnostic framework `</div>` (line 373) and the `{/* Action Bar */}` comment (line 375):

```typescript
          {/* Ads in this set */}
          {trendData.ads.length > 0 && (
            <div className="px-5 py-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  Ads in this set
                </span>
                <span className="text-[10px] text-muted-foreground/30">
                  Ranked by CTR. Sparklines show daily CTR over the period.
                </span>
              </div>
              <div className="space-y-0">
                {(() => {
                  const adRows = trendData.ads
                    .map((adTrend) => {
                      const totalSpend = adTrend.daily.reduce((s, d) => s + d.spend, 0);
                      const totalImpressions = adTrend.daily.reduce((s, d) => s + d.impressions, 0);
                      const totalClicks = adTrend.daily.reduce((s, d) => s + d.clicks, 0);
                      const totalPurchases = adTrend.daily.reduce((s, d) => s + d.purchases, 0);
                      const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
                      const cpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
                      const dailyCtrs = adTrend.daily.map((d) => d.impressions > 0 ? d.clicks / d.impressions : 0);
                      const adMatch = ads?.find((a) => a.ad_id === adTrend.ad_id);
                      return {
                        ad_id: adTrend.ad_id,
                        ad_name: adTrend.ad_name,
                        spend: totalSpend,
                        purchases: totalPurchases,
                        ctr,
                        cpa,
                        dailyCtrs,
                        image_url: adMatch?.image_url ?? adMatch?.thumbnail_url ?? null,
                      };
                    })
                    .sort((a, b) => b.ctr - a.ctr);

                  const showTags = adRows.length >= 3;

                  return adRows.map((ad, idx) => {
                    const isBest = idx === 0;
                    const isWorst = showTags && idx === adRows.length - 1;

                    const sparkColor = isBest ? GREEN : isWorst ? "oklch(0.65 0.2 25 / 0.6)" : MUTED;
                    const sparkFill = isBest ? "oklch(0.65 0.15 160 / 0.08)" : isWorst ? "oklch(0.65 0.2 25 / 0.05)" : "oklch(0.35 0 0 / 0.05)";

                    return (
                      <div
                        key={ad.ad_id}
                        className={`grid items-center gap-3 py-2.5 px-3 rounded-md transition-colors hover:bg-muted/10 ${
                          isBest ? "bg-emerald-500/[0.03] border-l-2 border-l-emerald-500/40 pl-2.5" :
                          isWorst ? "bg-red-500/[0.02]" : ""
                        }`}
                        style={{ gridTemplateColumns: "40px 1fr 240px 70px 70px" }}
                      >
                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded bg-muted/20 border border-border/30 overflow-hidden flex items-center justify-center">
                          {ad.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-muted-foreground/30">IMG</span>
                          )}
                        </div>

                        {/* Name + meta */}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate" title={ad.ad_name}>
                            {ad.ad_name}
                          </div>
                          <div className="flex gap-2 text-[10px] text-muted-foreground/50 mt-0.5">
                            <span>{usd.format(ad.spend)} spend</span>
                            <span>{ad.purchases} purchases</span>
                            {isBest && <span className="text-emerald-400 font-medium">Best in set</span>}
                            {isWorst && <span className="text-red-400/70 font-medium">Lowest CTR</span>}
                          </div>
                        </div>

                        {/* Sparkline */}
                        <div className="relative">
                          <Sparkline points={ad.dailyCtrs} color={sparkColor} fillColor={sparkFill} />
                        </div>

                        {/* CTR */}
                        <div className="text-right">
                          <div className={`font-mono text-[11px] ${isBest ? "text-emerald-400" : isWorst ? "text-red-400" : "text-muted-foreground"}`}>
                            {pctFmt(ad.ctr)}
                          </div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/30 mt-0.5">CTR</div>
                        </div>

                        {/* CPA */}
                        <div className="text-right">
                          <div className={`font-mono text-[11px] ${
                            ad.purchases === 0 ? "text-muted-foreground/30" :
                            ad.cpa < 9 ? "text-emerald-400" :
                            ad.cpa > 14 ? "text-red-400" :
                            ad.cpa > 9 ? "text-amber-400" :
                            "text-muted-foreground"
                          }`}>
                            {ad.purchases > 0 ? `$${ad.cpa.toFixed(2)}` : "\u2014"}
                          </div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/30 mt-0.5">CPA</div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
```

- [ ] **Step 4: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build passes

- [ ] **Step 5: Commit**

```bash
git add src/components/workflows/adset-analyze-panel.tsx
git commit -m "feat: add per-ad sparkline section to analyze panel"
```

---

### Task 2: Pass ads prop from campaign table

**Files:**
- Modify: `src/components/workflows/meta-ads-fetch-summary.tsx`

- [ ] **Step 1: Add `ads` prop to the AdSetAnalyzePanel call**

In `meta-ads-fetch-summary.tsx`, find the `AdSetAnalyzePanel` rendering (around line 724). Add the `ads` prop, filtering the parent's `ads` array by the current ad set's ID:

Change:
```typescript
                          <AdSetAnalyzePanel
                            adSet={as}
                            trendData={trendData.get(as.adset_id)!}
                            campaignAdSets={childAdSets}
                            campaign={c}
                            onCollapse={() => {
```

To:
```typescript
                          <AdSetAnalyzePanel
                            adSet={as}
                            trendData={trendData.get(as.adset_id)!}
                            campaignAdSets={childAdSets}
                            campaign={c}
                            ads={ads.filter((a) => a.adset_id === as.adset_id)}
                            onCollapse={() => {
```

Note: `ads` is already available in scope — it's a prop of `CampaignTable` (line 472: `ads: MetaAdsAdRow[]`).

- [ ] **Step 2: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build passes

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit and push**

```bash
git add src/components/workflows/meta-ads-fetch-summary.tsx
git commit -m "feat: pass ads prop to analyze panel for thumbnails"
git push
```

---

## Verification Checklist

- [ ] `npm run build` passes
- [ ] `npx vitest run` passes
- [ ] Click Analyze on an ad set → panel shows "Ads in this set" section
- [ ] Ads ranked by CTR (best at top)
- [ ] Best performer has green left border, "Best in set" tag, green sparkline
- [ ] Worst performer (3+ ads) has faint red tint, "Lowest CTR" tag, red sparkline
- [ ] Middle performers have neutral gray sparklines
- [ ] Thumbnails render when available
- [ ] CTR and CPA values color-coded correctly
- [ ] Sparkline shapes show daily CTR trends clearly
