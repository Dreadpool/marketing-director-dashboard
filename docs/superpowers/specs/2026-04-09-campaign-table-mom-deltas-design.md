# Campaign Table: Remove Stage Column + Add MoM Inline Deltas

## Context

The Meta Ads campaign table has a Stage column (TOF/RT/Other badges) that wastes space since Brady already knows his funnel stages. More importantly, there's no way to see how metrics changed month-over-month. Seeing the relationship between metric changes is key: spend up + CPA flat = good scaling, spend up + CPA up = bad.

## Changes

### 1. Fetch prior month campaign data

**File:** `src/lib/workflows/executors/fetch-meta-ads.ts`

Add `getMonthlyInsights(priorPeriod)` to the existing `Promise.allSettled` array. This is 1 additional API call, safe on developer tier. Prior period computed as month-1 (or Dec of prior year if January).

Return the prior campaign data as an optional field on `MetaAdsMetrics`:
```typescript
prior_campaigns?: MetaAdsCampaignRow[];
```

### 2. Compute MoM deltas on campaigns and ad sets

**File:** `src/lib/workflows/executors/fetch-meta-ads.ts`

After mapping campaigns, match each current campaign to its prior month counterpart by `campaign_id`. Compute percent change for spend, CPA, ROAS, and purchases. Attach as an optional `mom` field.

New types on `MetaAdsCampaignRow` and `MetaAdsAdSetRow`:
```typescript
mom?: {
  spend_pct: number | null;
  cpa_pct: number | null;
  roas_pct: number | null;
  purchases_pct: number | null;
}
```

Null when no prior match exists (new campaign/ad set). No frequency delta.

Also fetch prior month ad set data via `getAdSetInsights(priorPeriod)` added to the same `Promise.allSettled`. Match ad sets by `adset_id`.

Ad-level deltas are NOT computed. Ads change too frequently month to month. Ads keep the on-demand Analyze button for trend data.

### 3. Remove Stage column from campaign table

**File:** `src/components/workflows/meta-ads-fetch-summary.tsx`

- Remove the Stage `<th>` and `<td>` column from campaign rows
- Remove the `funnelBadge()` function
- Move HealthBadge into the campaign name cell (small badge after the name text)
- Table goes from 7 columns to 6: Campaign, Spend, CPA, ROAS, Purchases, Freq
- Ad set and ad rows also drop the Stage column, HealthBadge stays in the name cell

### 4. Render inline MoM deltas

**File:** `src/components/workflows/meta-ads-fetch-summary.tsx`

Each metric cell renders two lines:
- **Line 1:** Current value (existing rendering, unchanged)
- **Line 2:** Small (10px) colored percent change: `+18%`, `-3%`, or `→` for flat

Color logic (directional, not absolute):
- **Spend:** Neutral direction (green if up = investing more, but could also show muted). Recommendation: muted for spend changes since "more spend" isn't inherently good or bad.
- **CPA:** Rising = red (bad), declining = green (good). Inverted.
- **ROAS:** Rising = green (good), declining = red (bad).
- **Purchases:** Rising = green, declining = red.
- **Flat threshold:** Changes under 5% absolute show muted gray with `→` arrow.
- **No delta on frequency column.**
- **New campaigns (no prior match):** Show muted "new" label.

Applies to campaign rows and ad set rows. Ad rows do not show MoM deltas.

### 5. Backward compatibility

`mom` field is optional on both types. Old stored runs render without deltas (no crash, no empty rows). `prior_campaigns` is optional on `MetaAdsMetrics`. The UI checks `campaign.mom?.spend_pct` with optional chaining.

## Files

| File | Change |
|------|--------|
| `src/lib/schemas/sources/meta-ads-metrics.ts` | Add `MomDelta` type, optional `mom?` field on CampaignRow and AdSetRow, optional `prior_campaigns?` on MetaAdsMetrics |
| `src/lib/workflows/executors/fetch-meta-ads.ts` | Fetch prior month campaigns + ad sets, compute MoM deltas, attach to rows |
| `src/components/workflows/meta-ads-fetch-summary.tsx` | Remove Stage column, move HealthBadge to name cell, render inline deltas |

## Verification

1. `npm run build` passes
2. `npm test` passes
3. Run Meta Ads workflow on latest month — campaigns and ad sets show MoM deltas
4. Old stored runs still render (no badges, no deltas, no crash)
5. Stage column is gone, Health badge visible on campaign name
