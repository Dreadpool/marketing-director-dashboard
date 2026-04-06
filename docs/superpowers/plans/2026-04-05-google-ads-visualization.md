# Google Ads Visualization Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wall-of-text Google Ads workflow output with a structured dashboard matching the Meta Ads visualization quality -- segment health cards, color-coded metrics, inline diagnostics, and campaign tables.

**Architecture:** New visualization component (`google-ads-fetch-summary.tsx`) with type guard routing. Executor extended to compute per-segment YoY trends for CPA decomposition diagnostics. Follows the same patterns as `meta-ads-fetch-summary.tsx`.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, shadcn/ui (Badge, Tooltip), lucide-react icons, Vitest

**Design Spec:** `docs/superpowers/specs/2026-04-05-google-ads-visualization-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/schemas/sources/google-ads-metrics.ts` | Modify | Add `GoogleAdsSegmentTrend` type, add `segment_trends` to `GoogleAdsMetrics` |
| `src/lib/workflows/executors/fetch-google-ads.ts` | Modify | Compute per-segment trends from prior period campaign data |
| `src/components/workflows/google-ads-fetch-summary.tsx` | Create | Full visualization component (type guard, segment cards, diagnostics, campaign tables) |
| `src/components/workflows/fetch-step-summary.tsx` | Modify | Import and route Google Ads data to new component |
| `src/lib/workflows/__tests__/google-ads.test.ts` | Modify | Add type guard and segment trend tests |

---

### Task 1: Extend Types with Per-Segment Trends

**Files:**
- Modify: `src/lib/schemas/sources/google-ads-metrics.ts`
- Test: `src/lib/workflows/__tests__/google-ads.test.ts`

- [ ] **Step 1: Add GoogleAdsSegmentTrend type and segment_trends field**

In `src/lib/schemas/sources/google-ads-metrics.ts`, add the new type after the `GoogleAdsTrend` type (after line 79), and add the `segment_trends` field to `GoogleAdsMetrics`:

```typescript
export type GoogleAdsSegmentTrend = {
  segment: CampaignSegment;
  cpa: GoogleAdsTrend;
  avg_cpc: GoogleAdsTrend;
  cvr: GoogleAdsTrend;
  conversions: GoogleAdsTrend;
};
```

Add `segment_trends: GoogleAdsSegmentTrend[];` to the `GoogleAdsMetrics` type, after the `trends` field (after line 97).

The full `GoogleAdsMetrics` type should now be:
```typescript
export type GoogleAdsMetrics = {
  period: GoogleAdsPeriod;
  account_health: GoogleAdsAccountHealth;
  campaigns: GoogleAdsCampaignMetrics[];
  ground_truth: GoogleAdsGroundTruth;
  trends: {
    cpa: GoogleAdsTrend;
    roas: GoogleAdsTrend;
    conversions: GoogleAdsTrend;
    spend: GoogleAdsTrend;
  };
  segment_trends: GoogleAdsSegmentTrend[];
  metadata: {
    generated_at: string;
    loaded_sources: string[];
    missing_sources: string[];
    source_details: Record<string, GoogleAdsSourceDetail>;
  };
};
```

- [ ] **Step 2: Write test for the new type**

Add to `src/lib/workflows/__tests__/google-ads.test.ts`:

```typescript
import type {
  CampaignSegment,
  CpaStatus,
  RoasStatus,
  GoogleAdsSegmentTrend,
} from "@/lib/schemas/sources/google-ads-metrics";

// Add inside the "Google Ads metrics types" describe block:
it("GoogleAdsSegmentTrend has required fields", () => {
  const trend: GoogleAdsSegmentTrend = {
    segment: "non-brand",
    cpa: { current: 6, prior_month: 5, prior_year: 7, mom_change: 0.2, yoy_change: -0.14 },
    avg_cpc: { current: 1.89, prior_month: 1.80, prior_year: 1.85, mom_change: 0.05, yoy_change: 0.02 },
    cvr: { current: 0.032, prior_month: 0.035, prior_year: 0.041, mom_change: -0.086, yoy_change: -0.22 },
    conversions: { current: 572, prior_month: 620, prior_year: 650, mom_change: -0.077, yoy_change: -0.12 },
  };
  expect(trend.segment).toBe("non-brand");
  expect(trend.cpa.current).toBe(6);
  expect(trend.cvr.yoy_change).toBe(-0.22);
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/workflows/__tests__/google-ads.test.ts`
Expected: All tests pass including the new type test.

- [ ] **Step 4: Commit**

```bash
git add src/lib/schemas/sources/google-ads-metrics.ts src/lib/workflows/__tests__/google-ads.test.ts
git commit -m "feat(google-ads): add GoogleAdsSegmentTrend type for per-segment YoY diagnostics"
```

---

### Task 2: Extend Executor to Compute Per-Segment Trends

**Files:**
- Modify: `src/lib/workflows/executors/fetch-google-ads.ts`

- [ ] **Step 1: Add computeSegmentTrends function**

Add this function after the `computeTrend` function (after line 223) in `src/lib/workflows/executors/fetch-google-ads.ts`:

```typescript
function computeSegmentTrends(
  currentCampaigns: GoogleAdsCampaignMetrics[],
  priorMonthRows: GoogleAdsCampaignRow[] | null,
  priorYearRows: GoogleAdsCampaignRow[] | null,
): GoogleAdsSegmentTrend[] {
  // Map prior period rows to campaign metrics for segment grouping
  const priorMonthCampaigns = priorMonthRows?.map(mapCampaignRow) ?? [];
  const priorYearCampaigns = priorYearRows?.map(mapCampaignRow) ?? [];

  // Get active segments from current period
  const activeSegments = [...new Set(currentCampaigns.map((c) => c.segment))];

  return activeSegments.map((segment) => {
    const current = computeSegmentHealth(currentCampaigns, segment);
    const priorMonth = computeSegmentHealth(priorMonthCampaigns, segment);
    const priorYear = computeSegmentHealth(priorYearCampaigns, segment);

    const currentCvr = safeDivide(current.total_conversions, current.total_clicks);
    const priorMonthCvr = safeDivide(priorMonth.total_conversions, priorMonth.total_clicks);
    const hasPriorYear = priorYear.campaign_count > 0;
    const priorYearCvr = hasPriorYear
      ? safeDivide(priorYear.total_conversions, priorYear.total_clicks)
      : null;

    return {
      segment,
      cpa: computeTrend(
        current.cpa,
        priorMonth.cpa,
        hasPriorYear ? priorYear.cpa : null,
      ),
      avg_cpc: computeTrend(
        current.avg_cpc,
        priorMonth.avg_cpc,
        hasPriorYear ? priorYear.avg_cpc : null,
      ),
      cvr: computeTrend(
        currentCvr,
        priorMonthCvr,
        priorYearCvr,
      ),
      conversions: computeTrend(
        current.total_conversions,
        priorMonth.total_conversions,
        hasPriorYear ? priorYear.total_conversions : null,
      ),
    };
  });
}
```

- [ ] **Step 2: Add GoogleAdsSegmentTrend import**

At the top of the file, add `GoogleAdsSegmentTrend` to the import from `google-ads-metrics`:

```typescript
import type {
  CampaignSegment,
  CpaStatus,
  RoasStatus,
  GoogleAdsMetrics,
  GoogleAdsCampaignMetrics,
  GoogleAdsSegmentHealth,
  GoogleAdsAccountHealth,
  GoogleAdsGroundTruth,
  GoogleAdsTrend,
  GoogleAdsPeriod,
  GoogleAdsSourceDetail,
  GoogleAdsSegmentTrend,
} from "@/lib/schemas/sources/google-ads-metrics";
```

- [ ] **Step 3: Wire segment_trends into the return object**

In the `fetchGoogleAds` function, add the `computeSegmentTrends` call before the return statement (around line 360). Add this line after the `groundTruth` computation:

```typescript
  // Per-segment trends for diagnostic cards
  const segmentTrends = computeSegmentTrends(
    campaigns,
    priorMonthRows ? priorMonthRows.map(mapCampaignRow) : null,
    priorYearRows ? priorYearRows.map(mapCampaignRow) : null,
  );
```

Wait -- `computeSegmentTrends` already calls `mapCampaignRow` internally. We should pass the raw rows to avoid double-mapping. Update the function signature:

Actually, looking at the function I wrote in Step 1, it already accepts `GoogleAdsCampaignRow[] | null` for prior periods and maps them internally. But for `currentCampaigns` it accepts `GoogleAdsCampaignMetrics[]` (already mapped). So the call is:

```typescript
  const segmentTrends = computeSegmentTrends(campaigns, priorMonthRows, priorYearRows);
```

Where `campaigns` is the already-mapped current campaigns, and `priorMonthRows`/`priorYearRows` are the raw API rows (or null).

Then add `segment_trends: segmentTrends,` to the return object, after the `trends` field:

```typescript
  return {
    period: periodInfo,
    account_health: accountHealth,
    campaigns,
    ground_truth: groundTruth,
    trends: {
      cpa: computeTrend(currentCpa, priorMonthCpa, priorYearCpa),
      roas: computeTrend(currentRoas, priorMonthRoas, priorYearRoas),
      conversions: computeTrend(currentConversions, priorMonthConversions, priorYearConversions),
      spend: computeTrend(currentSpend, priorMonthSpend, priorYearSpend),
    },
    segment_trends: segmentTrends,
    metadata: {
      generated_at: new Date().toISOString(),
      loaded_sources: loadedSources,
      missing_sources: missingSources,
      source_details: sourceDetails,
    },
  };
```

- [ ] **Step 4: Run build to verify no type errors**

Run: `npx vitest run src/lib/workflows/__tests__/google-ads.test.ts && npm run build`
Expected: Tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflows/executors/fetch-google-ads.ts
git commit -m "feat(google-ads): compute per-segment YoY trends for CPA decomposition diagnostics"
```

---

### Task 3: Build the Visualization Component

**Files:**
- Create: `src/components/workflows/google-ads-fetch-summary.tsx`

This is the main task. The component has ~500 lines following the pattern of `meta-ads-fetch-summary.tsx`.

- [ ] **Step 1: Create the complete component file**

Create `src/components/workflows/google-ads-fetch-summary.tsx` with the following content:

```typescript
"use client";

import { useState } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import type {
  GoogleAdsMetrics,
  GoogleAdsSegmentHealth,
  GoogleAdsCampaignMetrics,
  GoogleAdsSegmentTrend,
  GoogleAdsSourceDetail,
  CampaignSegment,
} from "@/lib/schemas/sources/google-ads-metrics";

// ─── Type guard ──────────────────────────────────────────────────────────────

export function isGoogleAdsMetrics(data: unknown): data is GoogleAdsMetrics {
  return (
    typeof data === "object" &&
    data !== null &&
    "account_health" in data &&
    "campaigns" in data &&
    "ground_truth" in data &&
    "segment_trends" in data
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${n.toFixed(1)}%`;

// ─── Color helpers ───────────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<CampaignSegment, string> = {
  brand: "#60a5fa",
  "non-brand": "#4ade80",
  pmax: "#c084fc",
  competitor: "#f97316",
  video: "#06b6d4",
  other: "#888888",
};

function cpaColor(cpa: number): string {
  if (cpa <= 0) return "";
  if (cpa < 9) return "text-emerald-400";
  if (cpa < 14) return "text-amber-400";
  return "text-red-400";
}

function roasColor(roas: number): string {
  return roas >= 3.0 ? "text-muted-foreground" : "text-red-400";
}

function trendColor(change: number, inverted = false): string {
  const isBad = inverted ? change > 0 : change < 0;
  if (Math.abs(change) < 0.05) return "text-muted-foreground";
  return isBad ? "text-red-400" : "text-emerald-400";
}

function formatChange(change: number | null): string {
  if (change === null) return "—";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${(change * 100).toFixed(0)}%`;
}

// ─── Status badge ────────────────────────────────────────────────────────────

function statusBadge(segment: GoogleAdsSegmentHealth): {
  label: string;
  className: string;
} {
  if (segment.segment === "video") {
    return {
      label: "Awareness",
      className: "bg-muted text-muted-foreground border-border",
    };
  }
  if (segment.cpa_status === "on-target") {
    return {
      label: "Healthy",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  }
  if (segment.cpa_status === "elevated") {
    return {
      label: "Watch",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
  }
  return {
    label: "Bleeding",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  };
}

// ─── Segment label ───────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<CampaignSegment, string> = {
  brand: "BRAND",
  "non-brand": "NON-BRAND",
  pmax: "PMAX",
  competitor: "COMPETITOR",
  video: "VIDEO",
  other: "OTHER",
};

// ─── Collapsible section ─────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-1.5 text-left hover:opacity-80"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {!open && summary && (
          <span className="text-[10px] text-muted-foreground/60">
            {summary}
          </span>
        )}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

// ─── CPA Diagnostic ──────────────────────────────────────────────────────────

function CpaDiagnostic({
  segmentTrend,
  segmentHealth,
}: {
  segmentTrend: GoogleAdsSegmentTrend | undefined;
  segmentHealth: GoogleAdsSegmentHealth;
}) {
  // Zombie: spending with zero conversions
  if (segmentHealth.total_conversions === 0 && segmentHealth.total_spend > 0) {
    return (
      <div className="mt-2.5 border-t border-border/40 pt-2">
        <div className="text-[9px] font-bold text-red-400">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          ZOMBIE: Spending with zero conversions
        </div>
        <div className="mt-1 rounded bg-red-500/5 px-2 py-1 text-[9px] text-red-400">
          → Pause or restructure. No conversions to optimize toward.
        </div>
      </div>
    );
  }

  if (!segmentTrend) return null;

  // Use YoY if available, fall back to MoM
  const cpcChange = segmentTrend.avg_cpc.yoy_change ?? segmentTrend.avg_cpc.mom_change;
  const cvrChange = segmentTrend.cvr.yoy_change ?? segmentTrend.cvr.mom_change;
  const trendLabel = segmentTrend.avg_cpc.yoy_change !== null ? "YoY" : "MoM";

  // Determine diagnosis
  const cpcUp = cpcChange > 0.10;
  const cvrDown = cvrChange < -0.10;
  const cpcStable = Math.abs(cpcChange) <= 0.10;
  const cvrStable = Math.abs(cvrChange) <= 0.10;

  let diagnosis = "";
  let diagColor = "text-muted-foreground";

  if (cpcUp && cvrStable) {
    diagnosis = "CPC is the problem. Competition or Quality Score issue.";
    diagColor = "text-amber-400";
  } else if (cpcStable && cvrDown) {
    diagnosis = "CVR is the problem. Check landing pages and search term relevance.";
    diagColor = "text-amber-400";
  } else if (cpcUp && cvrDown) {
    diagnosis = "Both CPC and CVR degrading. Fix conversion rate first (free, higher leverage).";
    diagColor = "text-red-400";
  } else if (cpcStable && cvrStable) {
    diagnosis = "CPA elevated but components stable. Check if seasonal (compare YoY).";
    diagColor = "text-muted-foreground";
  } else {
    diagnosis = "Mixed signals. Review CPC and CVR trends.";
    diagColor = "text-amber-400";
  }

  const currentCvr = segmentHealth.total_clicks > 0
    ? segmentHealth.total_conversions / segmentHealth.total_clicks
    : 0;

  return (
    <div className="mt-2.5 border-t border-border/40 pt-2">
      <div className="mb-1.5 text-[9px] font-bold text-amber-400">
        <AlertTriangle className="mr-1 inline h-3 w-3" />
        WHY: CPA Decomposition
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded bg-muted/30 px-2 py-1">
          <div className="text-[8px] text-muted-foreground">CPC (cost/click)</div>
          <div className="text-[10px]">
            {usd2.format(segmentHealth.avg_cpc)}{" "}
            <span className={`text-[9px] ${trendColor(cpcChange, true)}`}>
              {formatChange(cpcChange)} {trendLabel}
            </span>
          </div>
        </div>
        <div className="rounded bg-muted/30 px-2 py-1">
          <div className="text-[8px] text-muted-foreground">CVR (conv rate)</div>
          <div className="text-[10px]">
            {pct(currentCvr * 100)}{" "}
            <span className={`text-[9px] ${trendColor(cvrChange, false)}`}>
              {formatChange(cvrChange)} {trendLabel}
            </span>
          </div>
        </div>
      </div>
      <div className={`mt-1.5 rounded px-2 py-1 text-[9px] ${diagColor} bg-muted/20`}>
        → {diagnosis}
      </div>
    </div>
  );
}

// ─── Segment card ────────────────────────────────────────────────────────────

function SegmentCard({
  segment,
  segmentTrend,
}: {
  segment: GoogleAdsSegmentHealth;
  segmentTrend: GoogleAdsSegmentTrend | undefined;
}) {
  const color = SEGMENT_COLORS[segment.segment];
  const badge = statusBadge(segment);
  const isVideo = segment.segment === "video";
  const showDiagnostic =
    !isVideo &&
    (segment.cpa_status === "elevated" || segment.cpa_status === "high");

  // YoY trend (prefer YoY, fall back to MoM)
  const cpaTrend = segmentTrend?.cpa;
  const convTrend = segmentTrend?.conversions;
  const cpaChange = cpaTrend?.yoy_change ?? cpaTrend?.mom_change ?? null;
  const convChange = convTrend?.yoy_change ?? convTrend?.mom_change ?? null;
  const trendLabel = cpaTrend?.yoy_change !== null ? "last year" : "last month";

  return (
    <div
      className="rounded-md bg-card p-3"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {/* Header: segment label + status badge */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold" style={{ color }}>
          {SEGMENT_LABELS[segment.segment]}
        </span>
        <Badge variant="outline" className={`text-[9px] ${badge.className}`}>
          {badge.label}
        </Badge>
      </div>

      {/* 2x2 metric grid */}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <div>
          <div className="text-[8px] text-muted-foreground">SPEND</div>
          <div>{usd.format(segment.total_spend)}</div>
        </div>
        {isVideo ? (
          <div>
            <div className="text-[8px] text-muted-foreground">CPV</div>
            <div>
              {usd2.format(
                segment.total_impressions > 0
                  ? segment.total_spend / segment.total_impressions
                  : 0,
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-[8px] text-muted-foreground">CPA</div>
            <div className={cpaColor(segment.cpa)}>
              {segment.total_conversions === 0 && segment.total_spend > 0
                ? "—"
                : usd2.format(segment.cpa)}
            </div>
          </div>
        )}
        {isVideo ? (
          <div>
            <div className="text-[8px] text-muted-foreground">VIEWS</div>
            <div>{num.format(segment.total_impressions)}</div>
          </div>
        ) : (
          <div>
            <div className="text-[8px] text-muted-foreground">ROAS</div>
            <div className={roasColor(segment.roas)}>
              {segment.roas.toFixed(1)}x
            </div>
          </div>
        )}
        {isVideo ? (
          <div>
            <div className="text-[8px] text-muted-foreground">CTR</div>
            <div>{pct(segment.ctr * 100)}</div>
          </div>
        ) : (
          <div>
            <div className="text-[8px] text-muted-foreground">CONV</div>
            <div>{num.format(segment.total_conversions)}</div>
          </div>
        )}
      </div>

      {/* YoY trend line */}
      {cpaChange !== null && !isVideo && (
        <div className="mt-1.5 text-[9px] text-muted-foreground">
          vs. {trendLabel}: CPA{" "}
          <span className={trendColor(cpaChange, true)}>
            {formatChange(cpaChange)}
          </span>
          {convChange !== null && (
            <>
              {" · Conv "}
              <span className={trendColor(convChange, false)}>
                {formatChange(convChange)}
              </span>
            </>
          )}
        </div>
      )}

      {/* Diagnostic (only when CPA elevated or high) */}
      {showDiagnostic && (
        <CpaDiagnostic
          segmentTrend={segmentTrend}
          segmentHealth={segment}
        />
      )}
    </div>
  );
}

// ─── Campaign table for one segment ──────────────────────────────────────────

function SegmentCampaignTable({
  campaigns,
  segment,
}: {
  campaigns: GoogleAdsCampaignMetrics[];
  segment: CampaignSegment;
}) {
  const filtered = campaigns
    .filter((c) => c.segment === segment)
    .sort((a, b) => b.spend - a.spend);

  if (filtered.length === 0) return null;

  const isVideo = segment === "video";

  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="border-b border-border/40 text-[9px] uppercase text-muted-foreground">
          <td className="px-1.5 py-1.5">Campaign</td>
          <td className="px-1.5 py-1.5 text-right">Spend</td>
          {isVideo ? (
            <>
              <td className="px-1.5 py-1.5 text-right">Impr</td>
              <td className="px-1.5 py-1.5 text-right">Clicks</td>
              <td className="px-1.5 py-1.5 text-right">CTR</td>
              <td className="px-1.5 py-1.5 text-right">Avg CPC</td>
            </>
          ) : (
            <>
              <td className="px-1.5 py-1.5 text-right">CPA</td>
              <td className="px-1.5 py-1.5 text-right">ROAS</td>
              <td className="px-1.5 py-1.5 text-right">Clicks</td>
              <td className="px-1.5 py-1.5 text-right">Conv</td>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {filtered.map((c) => {
          const isZombie = c.conversions === 0 && c.spend > 0 && !isVideo;
          return (
            <tr
              key={c.campaign_id}
              className={`border-b border-border/20 ${
                isZombie ? "bg-red-500/5" : ""
              }`}
            >
              <td className="px-1.5 py-1.5">
                <span
                  className={
                    c.status === "PAUSED" ? "text-muted-foreground/60" : ""
                  }
                  title={c.campaign_name}
                >
                  {c.campaign_name.length > 40
                    ? c.campaign_name.slice(0, 40) + "…"
                    : c.campaign_name}
                </span>
                {isZombie && (
                  <Badge
                    variant="outline"
                    className="ml-1.5 border-border bg-muted text-[8px] text-muted-foreground"
                  >
                    ZOMBIE
                  </Badge>
                )}
              </td>
              <td className="px-1.5 py-1.5 text-right tabular-nums">
                {usd.format(c.spend)}
              </td>
              {isVideo ? (
                <>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {num.format(c.impressions)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {num.format(c.clicks)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {pct(c.ctr * 100)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {usd2.format(c.avg_cpc)}
                  </td>
                </>
              ) : (
                <>
                  <td
                    className={`px-1.5 py-1.5 text-right tabular-nums ${cpaColor(c.cpa)}`}
                  >
                    {c.conversions === 0 ? "—" : usd2.format(c.cpa)}
                  </td>
                  <td
                    className={`px-1.5 py-1.5 text-right tabular-nums ${roasColor(c.roas)}`}
                  >
                    {c.spend === 0 ? "—" : `${c.roas.toFixed(1)}x`}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {num.format(c.clicks)}
                  </td>
                  <td
                    className={`px-1.5 py-1.5 text-right tabular-nums ${
                      isZombie ? "text-red-400" : ""
                    }`}
                  >
                    {num.format(c.conversions)}
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Source badges ────────────────────────────────────────────────────────────

function SourceBadges({
  details,
}: {
  details: Record<string, GoogleAdsSourceDetail>;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {Object.entries(details).map(([key, detail]) => {
        const Icon =
          detail.status === "ok"
            ? CheckCircle2
            : detail.status === "warning"
              ? AlertTriangle
              : XCircle;
        const iconColor =
          detail.status === "ok"
            ? "text-emerald-400"
            : detail.status === "warning"
              ? "text-amber-400"
              : "text-red-400";
        return (
          <TooltipProvider key={key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`flex items-center gap-1 text-[9px] ${iconColor}`}>
                  <Icon className="h-3 w-3" />
                  {detail.displayName}
                </span>
              </TooltipTrigger>
              {detail.message && (
                <TooltipContent>
                  <p className="text-xs">{detail.message}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GoogleAdsFetchSummary({
  data,
}: {
  data: GoogleAdsMetrics;
}) {
  const { period, account_health, campaigns, ground_truth, segment_trends, metadata } = data;
  const segments = account_health.segments;

  // Build segment trend lookup
  const trendBySegment = new Map(
    segment_trends.map((t) => [t.segment, t]),
  );

  // Channel context
  const channelContext =
    ground_truth.bigquery_bookings > 0
      ? `Google claims ${num.format(ground_truth.google_ads_conversions)} of ${num.format(ground_truth.bigquery_bookings)} total bookings (${Math.round((ground_truth.google_ads_conversions / ground_truth.bigquery_bookings) * 100)}%)`
      : null;

  // Segment order for campaign tables
  const segmentOrder: CampaignSegment[] = [
    "non-brand",
    "brand",
    "pmax",
    "competitor",
    "video",
    "other",
  ];
  const activeSegments = segmentOrder.filter((s) =>
    campaigns.some((c) => c.segment === s),
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* ── Header ── */}
        <div className="flex items-start justify-between border-b border-border/40 pb-3">
          <div>
            <h2 className="text-base font-semibold">Google Ads Analysis</h2>
            <p className="text-[11px] text-muted-foreground">
              Campaign performance by segment
              (Brand/Non-Brand/Competitor/PMax), CPA/ROAS decision metrics,
              and YoY trends.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">
              {period.month} {period.year}
            </div>
            <div className="text-sm font-semibold">
              Total Spend: {usd.format(account_health.total_spend)}
            </div>
            {channelContext && (
              <div className="text-[10px] text-muted-foreground">
                {channelContext}
              </div>
            )}
          </div>
        </div>

        {/* ── Source badges ── */}
        <SourceBadges details={metadata.source_details} />

        {/* ── Segment health cards ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((seg) => (
            <SegmentCard
              key={seg.segment}
              segment={seg}
              segmentTrend={trendBySegment.get(seg.segment)}
            />
          ))}
        </div>

        {/* ── Campaign tables by segment ── */}
        <div className="mt-2">
          {activeSegments.map((seg) => {
            const segCampaigns = campaigns.filter((c) => c.segment === seg);
            const segHealth = segments.find((s) => s.segment === seg);
            const segSpend = segCampaigns.reduce((s, c) => s + c.spend, 0);
            const segCpa = segHealth?.cpa ?? 0;
            const summary = `${segCampaigns.length} campaigns · ${usd.format(segSpend)} spend${seg !== "video" ? ` · CPA ${usd2.format(segCpa)}` : ""}`;

            return (
              <CollapsibleSection
                key={seg}
                title={`${SEGMENT_LABELS[seg]} Campaigns`}
                summary={summary}
                defaultOpen={seg === "non-brand"}
              >
                <SegmentCampaignTable campaigns={campaigns} segment={seg} />
              </CollapsibleSection>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/workflows/google-ads-fetch-summary.tsx
git commit -m "feat(google-ads): add structured visualization dashboard component

Segment-first layout with health cards, inline CPA diagnostics,
campaign tables grouped by segment, and zombie campaign badges."
```

---

### Task 4: Wire Component into Fetch Step Router

**Files:**
- Modify: `src/components/workflows/fetch-step-summary.tsx`
- Test: `src/lib/workflows/__tests__/google-ads.test.ts`

- [ ] **Step 1: Add import for Google Ads component**

At the top of `src/components/workflows/fetch-step-summary.tsx`, add the import alongside the existing workflow imports (after line 40):

```typescript
import {
  GoogleAdsFetchSummary,
  isGoogleAdsMetrics,
} from "./google-ads-fetch-summary";
```

- [ ] **Step 2: Add routing in the render function**

Find the type guard chain (around line 668-671):

```typescript
  if (isPromoCodeMetrics(data)) return <PromoCodeFetchSummary data={data} />;
  if (isMetaAdsMetrics(data)) return <MetaAdsFetchSummary data={data} />;
  if (isSeoRankingMetrics(data)) return <SeoRankingFetchSummary data={data} />;
  if (!isMasterMetrics(data)) return null;
```

Add the Google Ads check BEFORE the Meta check (order matters because Meta's guard is less specific):

```typescript
  if (isPromoCodeMetrics(data)) return <PromoCodeFetchSummary data={data} />;
  if (isGoogleAdsMetrics(data)) return <GoogleAdsFetchSummary data={data} />;
  if (isMetaAdsMetrics(data)) return <MetaAdsFetchSummary data={data} />;
  if (isSeoRankingMetrics(data)) return <SeoRankingFetchSummary data={data} />;
  if (!isMasterMetrics(data)) return null;
```

- [ ] **Step 3: Add type guard test**

Add to `src/lib/workflows/__tests__/google-ads.test.ts`:

```typescript
import { isGoogleAdsMetrics } from "@/components/workflows/google-ads-fetch-summary";

describe("isGoogleAdsMetrics type guard", () => {
  it("returns true for valid GoogleAdsMetrics data", () => {
    const data = {
      account_health: {},
      campaigns: [],
      ground_truth: {},
      segment_trends: [],
      metadata: {},
    };
    expect(isGoogleAdsMetrics(data)).toBe(true);
  });

  it("returns false for Meta Ads data (has signals, no ground_truth)", () => {
    const data = {
      account_health: {},
      campaigns: [],
      metadata: {},
      signals: {},
      audience: {},
    };
    expect(isGoogleAdsMetrics(data)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isGoogleAdsMetrics(null)).toBe(false);
  });

  it("returns false for string", () => {
    expect(isGoogleAdsMetrics("hello")).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests and build**

Run: `npx vitest run src/lib/workflows/__tests__/google-ads.test.ts && npm run build`
Expected: All tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/workflows/fetch-step-summary.tsx src/lib/workflows/__tests__/google-ads.test.ts
git commit -m "feat(google-ads): wire visualization into fetch step router

Type guard checks for ground_truth + segment_trends fields.
Routed before Meta check to prevent cross-contamination."
```

---

### Task 5: End-to-End UI Verification

**Files:**
- Test script: `/tmp/test-google-ads-viz.py` (temporary, not committed)

- [ ] **Step 1: Verify dev server is running**

Run: `lsof -iTCP -sTCP:LISTEN -P | grep node | head -5`
Expected: See a node process listening on port 3001 (or whatever port the dev server is on). If not running, start with `npm run dev`.

- [ ] **Step 2: Write and run Playwright verification script**

Create `/tmp/test-google-ads-viz.py`:

```python
"""Verify Google Ads visualization renders correctly."""
from playwright.sync_api import sync_playwright
import os

BASE = "http://localhost:3001"
DIR = "/tmp/google-ads-viz"
os.makedirs(DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.set_default_timeout(60000)

    # 1. Go to workflow page
    print("1. Loading Google Ads workflow...")
    page.goto(f"{BASE}/workflows/google-ads-analysis")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    page.screenshot(path=f"{DIR}/01-workflow-page.png")

    # 2. Run the analysis
    print("2. Running analysis...")
    run_btn = page.locator("text=Run Analysis").first
    if run_btn.is_visible():
        run_btn.click()
        print("   Clicked Run Analysis")
        page.wait_for_timeout(30000)
        page.screenshot(path=f"{DIR}/02-running.png")
        page.wait_for_timeout(30000)
        page.screenshot(path=f"{DIR}/03-complete.png", full_page=True)
    else:
        print("   Run button not visible, checking for existing run...")

    # 3. Check for segment cards
    body = page.inner_text("body")
    checks = {
        "Has segment labels": any(s in body for s in ["NON-BRAND", "BRAND", "PMAX"]),
        "Has status badges": any(s in body for s in ["Healthy", "Watch", "Bleeding"]),
        "Has CPA values": "$" in body,
        "Has campaign table": "Campaign" in body,
        "No wall of text (has structure)": "SPEND" in body and "CONV" in body,
    }

    print("\nVerification:")
    for check, result in checks.items():
        status = "PASS" if result else "FAIL"
        print(f"   [{status}] {check}")

    # 4. Check for errors
    has_error = "error" in body.lower() and "failed" in body.lower()
    print(f"\n   Has runtime errors: {has_error}")
    print(f"\n   Body preview: {body[:500]}")

    # 5. Also verify Meta Ads still works (cross-contamination check)
    print("\n4. Cross-contamination check: Meta Ads...")
    page.goto(f"{BASE}/workflows/meta-ads-analysis")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    meta_body = page.inner_text("body")
    meta_ok = "Meta" in meta_body or "TOF" in meta_body or "CPA" in meta_body
    print(f"   Meta Ads page loads: {meta_ok}")

    browser.close()
    print(f"\nScreenshots saved to {DIR}/")
```

Run: `python3 /tmp/test-google-ads-viz.py`
Expected: All checks PASS, no runtime errors, Meta Ads still works.

- [ ] **Step 3: Open in browser for manual verification**

Run: `open http://localhost:3001/workflows/google-ads-analysis`
Verify visually:
- Segment health cards with colored left borders
- Status badges (Healthy/Watch/Bleeding)
- CPA color-coded (green/amber/red)
- Inline diagnostic on elevated/high CPA segments
- Campaign tables grouped by segment
- Non-brand table open by default
- Zombie badges on zero-conversion campaigns
- Total spend in header
- Channel context line

- [ ] **Step 4: Final commit with any fixes**

If any fixes were needed during verification, commit them.

```bash
git add -A
git commit -m "fix(google-ads): address UI verification findings"
```
