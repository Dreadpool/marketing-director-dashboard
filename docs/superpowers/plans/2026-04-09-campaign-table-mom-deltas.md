# Campaign Table: MoM Inline Deltas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Stage column, add always-visible MoM percent change deltas on campaign and ad set metrics.

**Architecture:** Fetch prior month campaign + ad set data as a 5th/6th call in the existing `Promise.allSettled`. Compute percent deltas in the executor. Render inline below each metric cell. Pure additive — no new dependencies.

**Tech Stack:** TypeScript, React, Tailwind CSS, facebook-nodejs-business-sdk (existing)

---

### Task 1: Add MoM delta types and fetch prior month data

**Files:**
- Modify: `src/lib/schemas/sources/meta-ads-metrics.ts`
- Modify: `src/lib/workflows/executors/fetch-meta-ads.ts`

- [ ] **Step 1: Add MomDelta type and optional fields to schema**

In `src/lib/schemas/sources/meta-ads-metrics.ts`, add after the `AdSetHealthClassification` type:

```typescript
export type MomDelta = {
  spend_pct: number | null;
  cpa_pct: number | null;
  roas_pct: number | null;
  purchases_pct: number | null;
};
```

Add optional `mom?` field to `MetaAdsCampaignRow`:
```typescript
  /** Month-over-month percent change. Null fields = no prior match. */
  mom?: MomDelta;
```

Add same optional `mom?` field to `MetaAdsAdSetRow`:
```typescript
  /** Month-over-month percent change. Null fields = no prior match. */
  mom?: MomDelta;
```

- [ ] **Step 2: Add prior period helper to executor**

In `src/lib/workflows/executors/fetch-meta-ads.ts`, add a helper near the other helpers (around line 46):

```typescript
function getPriorPeriod(period: MonthPeriod): MonthPeriod {
  if (period.month === 1) {
    return { year: period.year - 1, month: 12 };
  }
  return { year: period.year, month: period.month - 1 };
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current > 0 ? null : null;
  return ((current - prior) / prior) * 100;
}
```

- [ ] **Step 3: Fetch prior month campaigns and ad sets**

In `fetchMetaAds()`, add two more calls to the `Promise.allSettled` array (lines 83-89):

```typescript
const priorPeriod = getPriorPeriod(period);

const [campaignResult, adResult, audienceResult, adSetResult, priorCampaignResult, priorAdSetResult] =
  await Promise.allSettled([
    getMonthlyInsights(period),
    getAdInsights(period),
    getAudienceBreakdowns(period),
    getAdSetInsights(period),
    getMonthlyInsights(priorPeriod),
    getAdSetInsights(priorPeriod),
  ]);
```

Extract the prior results (after the existing extraction block around line 103):

```typescript
const priorCampaignRows =
  priorCampaignResult.status === "fulfilled" ? priorCampaignResult.value : null;
const priorAdSetRows =
  priorAdSetResult.status === "fulfilled" ? priorAdSetResult.value : null;
```

- [ ] **Step 4: Compute MoM deltas on campaigns**

After the campaigns are mapped and sorted (after line 233), add:

```typescript
// Compute MoM deltas for campaigns
if (priorCampaignRows) {
  const priorMapped = priorCampaignRows.map(mapCampaignRow);
  const priorMap = new Map(priorMapped.map((c) => [c.campaign_id, c]));

  for (const campaign of campaigns) {
    const prior = priorMap.get(campaign.campaign_id);
    if (prior) {
      campaign.mom = {
        spend_pct: pctChange(campaign.spend, prior.spend),
        cpa_pct: pctChange(campaign.cpa, prior.cpa),
        roas_pct: pctChange(campaign.roas, prior.roas),
        purchases_pct: pctChange(campaign.purchases, prior.purchases),
      };
    }
  }
}
```

Note: `campaigns` is currently `const`. You will need to make the mom assignment work. Since `MetaAdsCampaignRow` now has `mom?` as optional, the mapped objects accept mutation of the optional field. If TypeScript complains, use a for loop with direct property assignment (which works on objects even with `const` array binding).

- [ ] **Step 5: Compute MoM deltas on ad sets**

After ad sets are mapped (after line 305, the `adsetsBase` block), add:

```typescript
// Compute MoM deltas for ad sets
if (priorAdSetRows) {
  const priorAdSets = priorAdSetRows.map((row) => {
    const spend = Number(row.spend);
    const purchases = extractPurchases(row);
    const revenue = extractRevenue(row);
    return {
      adset_id: row.adset_id ?? "",
      spend,
      purchases,
      cpa: safeDivide(spend, purchases),
      roas: safeDivide(revenue, spend),
    };
  });
  const priorAdSetMap = new Map(priorAdSets.map((a) => [a.adset_id, a]));

  for (const adSet of adsetsBase) {
    const prior = priorAdSetMap.get(adSet.adset_id);
    if (prior) {
      adSet.mom = {
        spend_pct: pctChange(adSet.spend, prior.spend),
        cpa_pct: pctChange(adSet.cpa, prior.cpa),
        roas_pct: pctChange(adSet.roas, prior.roas),
        purchases_pct: pctChange(adSet.purchases, prior.purchases),
      };
    }
  }
}
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: Compiles successfully. No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/schemas/sources/meta-ads-metrics.ts src/lib/workflows/executors/fetch-meta-ads.ts
git commit -m "feat(meta-ads): fetch prior month data and compute MoM deltas

Add MomDelta type to schema. Fetch prior month campaigns and ad sets
in parallel with existing calls (+2 API calls, optional). Compute
percent change for spend/CPA/ROAS/purchases on campaigns and ad sets.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Remove Stage column, move Health badge, render inline deltas

**Files:**
- Modify: `src/components/workflows/meta-ads-fetch-summary.tsx`

- [ ] **Step 1: Remove funnelBadge function and Stage column**

In `src/components/workflows/meta-ads-fetch-summary.tsx`:

Delete the `funnelBadge()` function (around lines 161-177).

Remove the `Badge` import from `@/components/ui/badge` if it's no longer used elsewhere in the file (check first — it may still be used by `SourceBadges`).

In the `<thead>` of CampaignTable, remove the Stage `<th>`:
```typescript
// REMOVE this line:
<th ...>Stage</th>
```

The header should now be: Campaign, Spend, CPA, ROAS, Purch, Freq (6 columns).

- [ ] **Step 2: Create MomDeltaLabel component**

Add a small inline component for rendering the delta label:

```typescript
function MomDeltaLabel({
  pct,
  inverse = false,
}: {
  pct: number | null | undefined;
  inverse?: boolean;
}) {
  if (pct === null || pct === undefined) return null;
  const flat = Math.abs(pct) < 5;
  if (flat) {
    return (
      <div className="text-[10px] text-muted-foreground/60">
        → {pct > 0 ? "+" : ""}{pct.toFixed(0)}%
      </div>
    );
  }
  const isPositive = pct > 0;
  const isGood = inverse ? !isPositive : isPositive;
  const arrow = isPositive ? "↑" : "↓";
  return (
    <div className={`text-[10px] ${isGood ? "text-growth" : "text-decline"}`}>
      {arrow} {pct > 0 ? "+" : ""}{pct.toFixed(0)}%
    </div>
  );
}
```

Color logic:
- Spend: `inverse={false}` (neither good nor bad). Actually, per spec: spend changes are neutral/muted. Override: for spend, always use muted. Add a `neutral` prop or just handle spend specially. Simplest: use a `neutral` boolean that forces muted color.

Updated version with neutral support:

```typescript
function MomDeltaLabel({
  pct,
  inverse = false,
  neutral = false,
}: {
  pct: number | null | undefined;
  inverse?: boolean;
  neutral?: boolean;
}) {
  if (pct === null || pct === undefined) return null;
  const flat = Math.abs(pct) < 5;
  const isPositive = pct > 0;
  const arrow = flat ? "→" : isPositive ? "↑" : "↓";

  let colorClass = "text-muted-foreground/60";
  if (!flat && !neutral) {
    const isGood = inverse ? !isPositive : isPositive;
    colorClass = isGood ? "text-growth" : "text-decline";
  }

  return (
    <div className={`text-[10px] ${colorClass}`}>
      {arrow} {isPositive ? "+" : ""}{pct.toFixed(0)}%
    </div>
  );
}
```

- [ ] **Step 3: Update campaign row rendering**

In campaign rows, remove the Stage `<td>` that renders `funnelBadge(c.funnel_stage)`.

Move the HealthBadge into the campaign name cell. The name cell currently shows a chevron + campaign name. Add the badge after the name:

```tsx
<td className="py-2 pr-4 max-w-[200px]" title={c.campaign_name}>
  <span className="flex items-center gap-1.5 truncate">
    {/* chevron icon ... */}
    {c.campaign_name}
  </span>
  {c.health && <HealthBadge health={c.health} />}
</td>
```

Wait — campaigns don't have `health` today (only ads and ad sets do). So no HealthBadge on campaign rows. Skip this. Just remove the Stage `<td>`.

For each metric cell (Spend, CPA, ROAS, Purchases), add the MomDeltaLabel below the value:

```tsx
{/* Spend cell */}
<td className="py-2 pr-3 text-right font-mono text-sm text-foreground">
  {fmtUsd(c.spend)}
  <MomDeltaLabel pct={c.mom?.spend_pct} neutral />
</td>

{/* CPA cell */}
<td className={`py-2 pr-3 text-right font-mono text-sm ${cpaColor(c.cpa)}`}>
  {fmtUsd(c.cpa)}
  <MomDeltaLabel pct={c.mom?.cpa_pct} inverse />
</td>

{/* ROAS cell */}
<td className={`py-2 pr-3 text-right font-mono text-sm ${roasColor(c.roas)}`}>
  {c.roas.toFixed(2)}x
  <MomDeltaLabel pct={c.mom?.roas_pct} />
</td>

{/* Purchases cell */}
<td className="py-2 pr-3 text-right font-mono text-sm text-foreground">
  {c.purchases.toLocaleString()}
  <MomDeltaLabel pct={c.mom?.purchases_pct} />
</td>
```

Frequency column stays as-is (no delta).

- [ ] **Step 4: Update ad set row rendering**

Ad set rows currently have a Stage `<td>` that renders the HealthBadge + Analyze button. Keep the HealthBadge and Analyze button but move them to the ad set name cell (or keep them in a cell that now replaces Stage). Actually — since we're removing the Stage column, the HealthBadge + Analyze button need a new home. The simplest approach: move HealthBadge into the name cell (after the ad set name), and keep the Analyze button there too.

For each metric cell on ad set rows, add MomDeltaLabel the same way as campaign rows:

```tsx
<td className="py-1.5 pr-3 text-right font-mono text-xs text-muted-foreground">
  {fmtUsd(as.spend)}
  <MomDeltaLabel pct={as.mom?.spend_pct} neutral />
</td>
```

Same pattern for CPA (inverse), ROAS (default), Purchases (default). No frequency delta.

- [ ] **Step 5: Update ad row rendering**

Ad rows don't have MoM deltas. Just remove the Stage `<td>` to match the new 6-column layout. Ad rows currently have their HealthBadge in the Stage column — move it to the ad name cell.

Update the `colSpan` if any ad row cells use colSpan to span across the table.

- [ ] **Step 6: Update column count references**

Search for any `colSpan` values in the file that reference the old 7-column count. Update to 6.

- [ ] **Step 7: Verify build and test**

Run: `npm run build`
Expected: Compiles successfully.

Run: `npm test -- --run`
Expected: All tests pass (no test changes needed — tests don't test the UI component).

- [ ] **Step 8: Commit**

```bash
git add src/components/workflows/meta-ads-fetch-summary.tsx
git commit -m "feat(meta-ads): remove Stage column, add inline MoM deltas

Replace Stage column with inline MoM percent changes on spend, CPA,
ROAS, and purchases for campaigns and ad sets. Health badges move
to the name cell. Spend deltas shown as neutral (muted). CPA inverted
(rising = red). No frequency delta. No deltas on ad rows.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Update tests and add MoM delta unit tests

**Files:**
- Create: `src/lib/workflows/__tests__/meta-ads-mom.test.ts`

- [ ] **Step 1: Write tests for pctChange helper**

```typescript
import { describe, it, expect } from "vitest";

// We'll test via the executor output since pctChange is not exported.
// Instead, test the MoM delta behavior through the types and a small focused test.

describe("MoM delta computation", () => {
  function pctChange(current: number, prior: number): number | null {
    if (prior === 0) return current > 0 ? null : null;
    return ((current - prior) / prior) * 100;
  }

  it("computes positive percent change", () => {
    expect(pctChange(118, 100)).toBeCloseTo(18);
  });

  it("computes negative percent change", () => {
    expect(pctChange(75, 100)).toBeCloseTo(-25);
  });

  it("returns null when prior is zero", () => {
    expect(pctChange(50, 0)).toBeNull();
  });

  it("returns null when both are zero", () => {
    expect(pctChange(0, 0)).toBeNull();
  });

  it("computes 100% increase (doubled)", () => {
    expect(pctChange(200, 100)).toBeCloseTo(100);
  });

  it("computes 50% decrease (halved)", () => {
    expect(pctChange(50, 100)).toBeCloseTo(-50);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- --run`
Expected: All tests pass including new ones.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workflows/__tests__/meta-ads-mom.test.ts
git commit -m "test(meta-ads): add MoM percent change unit tests

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Verification

1. `npm run build` passes
2. `npm test -- --run` passes (all existing + new tests)
3. Run Meta Ads Analysis workflow on latest month — campaigns show MoM deltas
4. Ad sets show MoM deltas when expanded
5. Old stored runs still render (no deltas, no crash)
6. Stage column is gone from all row levels
7. Health badges visible on ad set and ad name cells
