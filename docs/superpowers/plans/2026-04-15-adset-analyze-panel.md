# Ad Set Analyze Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an inline diagnostic panel that expands below a flagged ad set showing weekly trends, peer comparison, a diagnostic framework, and a recommended action.

**Architecture:** Single new component `AdSetAnalyzePanel` rendered inside the campaign table when trend data is loaded. It receives the ad set, its daily trend data, and the sibling ad sets for peer comparison. All logic is deterministic (no LLM). Charts use Recharts (already installed). Peer bars and diagnostic cards use plain Tailwind divs.

**Tech Stack:** React, TypeScript, Recharts, Tailwind CSS, existing `AdSetDailyTrendResponse` data from the adset-daily API endpoint.

**Spec:** `docs/superpowers/specs/2026-04-15-adset-analyze-panel-design.md`
**Mockup:** `.superpowers/brainstorm/67993-1776305591/content/analyze-panel.html`

---

## File Structure

| File | Responsibility |
|------|---------------|
| **Create:** `src/components/workflows/adset-analyze-panel.tsx` | The full analyze panel component. Self-contained. Contains the header, trend charts, peer comparison, diagnostic framework, and action bar. |
| **Modify:** `src/components/workflows/meta-ads-fetch-summary.tsx` | Import and render `AdSetAnalyzePanel` below ad set rows when trend data exists. Pass required props. |
| **Create:** `src/lib/workflows/classifiers/meta-ads-diagnostic.ts` | Pure function: given an ad set and its campaign peers, determine which diagnostic scenario matches and return the diagnosis text + action text. |
| **Create:** `src/lib/workflows/__tests__/meta-ads-diagnostic.test.ts` | Tests for the diagnostic classifier. |

---

### Task 1: Diagnostic Classifier

Pure function that determines which of the four diagnostic scenarios matches an ad set's data. This drives the highlighted card and action text in the panel.

**Files:**
- Create: `src/lib/workflows/classifiers/meta-ads-diagnostic.ts`
- Create: `src/lib/workflows/__tests__/meta-ads-diagnostic.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/workflows/__tests__/meta-ads-diagnostic.test.ts
import { describe, it, expect } from "vitest";
import { diagnoseAdSet } from "../classifiers/meta-ads-diagnostic";
import type { MetaAdsAdSetRow } from "@/lib/schemas/sources/meta-ads-metrics";

function makeAdSet(
  overrides: Partial<MetaAdsAdSetRow> & { adset_id: string; campaign_id: string },
): MetaAdsAdSetRow {
  return {
    adset_name: "Test Ad Set",
    spend: 500,
    impressions: 10000,
    reach: 5000,
    clicks: 100,
    frequency: 2,
    purchases: 10,
    attributed_revenue: 500,
    cpa: 50,
    roas: 1,
    ...overrides,
  };
}

describe("diagnoseAdSet", () => {
  const peers = [
    makeAdSet({ adset_id: "a1", campaign_id: "c1", clicks: 120, impressions: 10000, frequency: 2 }),
    makeAdSet({ adset_id: "a2", campaign_id: "c1", clicks: 100, impressions: 10000, frequency: 2.5 }),
    makeAdSet({ adset_id: "a3", campaign_id: "c1", clicks: 50, impressions: 10000, frequency: 2 }),
  ];

  it("diagnoses exhaustion: low CTR + high frequency", () => {
    const adset = makeAdSet({
      adset_id: "a3",
      campaign_id: "c1",
      clicks: 50,
      impressions: 10000,
      frequency: 4.5,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.scenario).toBe("exhaustion");
    expect(result.action).toContain("Refresh");
  });

  it("diagnoses audience/creative: low CTR + low frequency", () => {
    const adset = makeAdSet({
      adset_id: "a3",
      campaign_id: "c1",
      clicks: 50,
      impressions: 10000,
      frequency: 1.5,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.scenario).toBe("audience_or_creative");
  });

  it("diagnoses post-click: good CTR + low conversions", () => {
    const adset = makeAdSet({
      adset_id: "a1",
      campaign_id: "c1",
      clicks: 120,
      impressions: 10000,
      frequency: 2,
      purchases: 0,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.scenario).toBe("post_click");
    expect(result.action).toContain("landing page");
  });

  it("diagnoses auction competition: rising CPA + good CTR", () => {
    const adset = makeAdSet({
      adset_id: "a1",
      campaign_id: "c1",
      clicks: 120,
      impressions: 10000,
      frequency: 2,
      purchases: 10,
      mom: { spend_pct: 5, cpa_pct: 40, roas_pct: -30, purchases_pct: -10 },
    });
    // Campaign CPA did NOT rise (so it's not seasonal)
    const result = diagnoseAdSet(adset, peers, { campaignCpaPct: 5 });
    expect(result.scenario).toBe("auction_competition");
  });

  it("includes median CTR in diagnosis text", () => {
    const adset = makeAdSet({
      adset_id: "a3",
      campaign_id: "c1",
      clicks: 50,
      impressions: 10000,
      frequency: 4.5,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.diagnosis).toContain("campaign median");
  });

  it("returns context values", () => {
    const adset = makeAdSet({
      adset_id: "a3",
      campaign_id: "c1",
      clicks: 50,
      impressions: 10000,
      frequency: 4.5,
      spend: 950,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.context.frequency).toBe(4.5);
    expect(result.context.spend).toBe(950);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/workflows/__tests__/meta-ads-diagnostic.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the diagnostic classifier**

```typescript
// src/lib/workflows/classifiers/meta-ads-diagnostic.ts
import type { MetaAdsAdSetRow } from "@/lib/schemas/sources/meta-ads-metrics";

export type DiagnosticScenario =
  | "audience_or_creative"
  | "exhaustion"
  | "post_click"
  | "auction_competition";

export type DiagnosticResult = {
  scenario: DiagnosticScenario;
  diagnosis: string;
  action: string;
  context: {
    frequency: number;
    adsetCtr: number;
    medianCtr: number;
    pctBelowMedian: number;
    spend: number;
    spendPctOfCampaign: number;
  };
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function diagnoseAdSet(
  adset: MetaAdsAdSetRow,
  campaignPeers: MetaAdsAdSetRow[],
  options?: { campaignCpaPct?: number | null },
): DiagnosticResult {
  const adsetCtr = adset.impressions > 0 ? adset.clicks / adset.impressions : 0;
  const peerCtrs = campaignPeers
    .filter((a) => a.impressions > 0)
    .map((a) => a.clicks / a.impressions);
  const medianCtr = median(peerCtrs);
  const pctBelowMedian = medianCtr > 0 ? ((medianCtr - adsetCtr) / medianCtr) * 100 : 0;

  const totalCampaignSpend = campaignPeers.reduce((s, a) => s + a.spend, 0);
  const spendPctOfCampaign = totalCampaignSpend > 0
    ? (adset.spend / totalCampaignSpend) * 100
    : 0;

  const lowCtr = pctBelowMedian >= 25;
  const highFreq = adset.frequency >= 3.5;
  const hasClicks = adset.clicks > 0;
  const lowCvr = hasClicks && adset.purchases === 0;
  const risingCpa =
    adset.mom?.cpa_pct != null &&
    adset.mom.cpa_pct >= 25 &&
    (options?.campaignCpaPct == null || options.campaignCpaPct < 25);

  const ctx: DiagnosticResult["context"] = {
    frequency: adset.frequency,
    adsetCtr,
    medianCtr,
    pctBelowMedian,
    spend: adset.spend,
    spendPctOfCampaign,
  };

  const fmtCtr = (v: number) => `${(v * 100).toFixed(2)}%`;
  const fmtPct = (v: number) => `${Math.round(v)}%`;

  // Priority order: exhaustion > audience/creative > post-click > auction > fallback
  if (lowCtr && highFreq) {
    return {
      scenario: "exhaustion",
      diagnosis: `CTR is ${fmtPct(pctBelowMedian)} below campaign median (${fmtCtr(adsetCtr)} vs ${fmtCtr(medianCtr)}). Frequency is ${adset.frequency.toFixed(1)}. This audience has seen these ads too many times.`,
      action: `Refresh creative or expand the audience. Frequency is ${adset.frequency.toFixed(1)} and CTR has dropped well below peers.`,
      context: ctx,
    };
  }

  if (lowCtr && !highFreq) {
    return {
      scenario: "audience_or_creative",
      diagnosis: `CTR is ${fmtPct(pctBelowMedian)} below campaign median (${fmtCtr(adsetCtr)} vs ${fmtCtr(medianCtr)}). Frequency is ${adset.frequency.toFixed(1)}, so the audience isn't oversaturated. The audience or the creative isn't resonating.`,
      action: `Review creative in this ad set. If similar creative works in other ad sets, the audience is wrong. If other audiences respond to different creative, this creative is the problem.`,
      context: ctx,
    };
  }

  if (!lowCtr && lowCvr) {
    return {
      scenario: "post_click",
      diagnosis: `CTR is ${fmtCtr(adsetCtr)}, in line with peers. But conversion rate is ${adset.purchases}/${adset.clicks} clicks. People click but don't buy.`,
      action: `Check the landing page. The creative drives clicks, but something breaks after the click. Or this audience clicks but isn't actually in-market.`,
      context: ctx,
    };
  }

  if (risingCpa && !lowCtr) {
    const cpaPct = Math.round(adset.mom!.cpa_pct!);
    return {
      scenario: "auction_competition",
      diagnosis: `CPA increased ${cpaPct}% vs last month while CTR held steady. Other ad sets in this campaign didn't see the same increase. Auction competition is driving costs up.`,
      action: `Auction competition is driving costs up on this audience. Ride it out or find a less competitive audience segment.`,
      context: ctx,
    };
  }

  // Fallback: default to audience/creative
  return {
    scenario: "audience_or_creative",
    diagnosis: `CTR is ${fmtCtr(adsetCtr)} (campaign median: ${fmtCtr(medianCtr)}). No single clear signal stands out. Review the ad set's creative and audience targeting.`,
    action: `Review creative in this ad set. If similar creative works in other ad sets, the audience is wrong.`,
    context: ctx,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/workflows/__tests__/meta-ads-diagnostic.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflows/classifiers/meta-ads-diagnostic.ts src/lib/workflows/__tests__/meta-ads-diagnostic.test.ts
git commit -m "feat: add diagnostic classifier for ad set analyze panel"
```

---

### Task 2: AdSetAnalyzePanel Component

The main panel component with all five sections: header, trend charts, peer comparison, diagnostic framework, and action bar.

**Files:**
- Create: `src/components/workflows/adset-analyze-panel.tsx`

**Dependencies:** Task 1 (diagnostic classifier)

- [ ] **Step 1: Create the panel component**

```typescript
// src/components/workflows/adset-analyze-panel.tsx
"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Area,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type {
  MetaAdsAdSetRow,
  MetaAdsCampaignRow,
  AdSetDailyTrendResponse,
  DailyPoint,
} from "@/lib/schemas/sources/meta-ads-metrics";
import {
  diagnoseAdSet,
  type DiagnosticScenario,
} from "@/lib/workflows/classifiers/meta-ads-diagnostic";

// ─── Chart colors (oklch to match dashboard theme) ─────────────────────────

const GOLD = "oklch(0.78 0.12 85)";
const RED = "oklch(0.65 0.2 25)";
const GREEN = "oklch(0.65 0.15 160)";
const MUTED = "oklch(0.35 0 0)";
const GRID = "oklch(0.22 0 0)";

// ─── Weekly aggregation ─────────────────────────────────────────────────────

type WeeklyPoint = {
  week: string; // "Mar 3" format
  ctr: number;
  cpa: number;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
};

function aggregateWeekly(dailyAds: AdSetDailyTrendResponse["ads"]): WeeklyPoint[] {
  // Merge all ads' daily points into ad-set-level daily totals
  const dayMap = new Map<string, { spend: number; impressions: number; clicks: number; purchases: number }>();

  for (const ad of dailyAds) {
    for (const d of ad.daily) {
      const existing = dayMap.get(d.date) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0 };
      existing.spend += d.spend;
      existing.impressions += d.impressions;
      existing.clicks += d.clicks;
      existing.purchases += d.purchases;
      dayMap.set(d.date, existing);
    }
  }

  // Sort by date
  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Group into weeks (7-day buckets from first day)
  const weeks: WeeklyPoint[] = [];
  let bucket: typeof days = [];

  for (const day of days) {
    bucket.push(day);
    if (bucket.length === 7) {
      flushBucket(bucket, weeks);
      bucket = [];
    }
  }
  if (bucket.length > 0) flushBucket(bucket, weeks);

  return weeks;
}

function flushBucket(
  bucket: [string, { spend: number; impressions: number; clicks: number; purchases: number }][],
  weeks: WeeklyPoint[],
) {
  const totals = bucket.reduce(
    (acc, [, d]) => ({
      spend: acc.spend + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      purchases: acc.purchases + d.purchases,
    }),
    { spend: 0, impressions: 0, clicks: 0, purchases: 0 },
  );

  const date = new Date(bucket[0][0]);
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  weeks.push({
    week: label,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    cpa: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
    spend: totals.spend,
    impressions: totals.impressions,
    clicks: totals.clicks,
    purchases: totals.purchases,
  });
}

// ─── Diagnostic card definitions ────────────────────────────────────────────

const DIAGNOSTIC_CARDS: {
  scenario: DiagnosticScenario;
  signal: string;
  problem: string;
  actionHint: string;
}[] = [
  {
    scenario: "audience_or_creative",
    signal: "Low CTR + Low Frequency",
    problem: "Audience or creative mismatch. They see it and ignore it.",
    actionHint: "Compare creative across ad sets to isolate the variable.",
  },
  {
    scenario: "exhaustion",
    signal: "Low CTR + High Frequency",
    problem: "Audience exhaustion. They've seen it too many times.",
    actionHint: "Refresh creative or expand the audience.",
  },
  {
    scenario: "post_click",
    signal: "Good CTR + Low Conversions",
    problem: "Post-click problem. The ad works but the landing page doesn't.",
    actionHint: "Check landing page. The creative isn't the issue.",
  },
  {
    scenario: "auction_competition",
    signal: "Rising CPA + Stable Metrics",
    problem: "Auction competition. Someone else is bidding on this audience.",
    actionHint: "Ride it out or find a less competitive audience.",
  },
];

// ─── Formatters ─────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pctFmt = (v: number) => `${(v * 100).toFixed(2)}%`;

// ─── Main Component ─────────────────────────────────────────────────────────

interface AdSetAnalyzePanelProps {
  adSet: MetaAdsAdSetRow;
  trendData: AdSetDailyTrendResponse;
  campaignAdSets: MetaAdsAdSetRow[];
  campaign: MetaAdsCampaignRow;
  onCollapse: () => void;
}

export function AdSetAnalyzePanel({
  adSet,
  trendData,
  campaignAdSets,
  campaign,
  onCollapse,
}: AdSetAnalyzePanelProps) {
  const weeklyData = aggregateWeekly(trendData.ads);
  const diagnosis = diagnoseAdSet(adSet, campaignAdSets, {
    campaignCpaPct: campaign.mom?.cpa_pct,
  });

  // Campaign median CTR (flat line value for chart)
  const medianCtr = diagnosis.context.medianCtr;
  const medianCpa =
    campaignAdSets.filter((a) => a.purchases > 0).length > 0
      ? (() => {
          const cpas = campaignAdSets
            .filter((a) => a.purchases > 0)
            .map((a) => a.cpa)
            .sort((a, b) => a - b);
          const mid = Math.floor(cpas.length / 2);
          return cpas.length % 2 === 0 ? (cpas[mid - 1] + cpas[mid]) / 2 : cpas[mid];
        })()
      : 0;

  // Peer CTRs for the bar chart, sorted descending
  const peerBars = [...campaignAdSets]
    .filter((a) => a.impressions > 0)
    .map((a) => ({
      adset_id: a.adset_id,
      name: a.adset_name,
      ctr: a.clicks / a.impressions,
      isCurrent: a.adset_id === adSet.adset_id,
    }))
    .sort((a, b) => b.ctr - a.ctr);

  const maxPeerCtr = peerBars.length > 0 ? peerBars[0].ctr : 0;

  // Days running estimate (from daily data)
  const allDates = trendData.ads.flatMap((a) => a.daily.map((d) => d.date));
  const uniqueDates = new Set(allDates);
  const daysRunning = uniqueDates.size;

  const totalCampaignSpend = campaignAdSets.reduce((s, a) => s + a.spend, 0);
  const spendPct = totalCampaignSpend > 0 ? Math.round((adSet.spend / totalCampaignSpend) * 100) : 0;

  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="mx-4 mb-2 rounded-lg border border-border bg-card overflow-hidden">
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-border/50">
            <div className="max-w-[600px]">
              <h3 className="font-heading text-sm font-semibold text-foreground">
                {adSet.adset_name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {diagnosis.diagnosis}
              </p>
            </div>
            <div className="flex gap-5 shrink-0 ml-6">
              {[
                { value: adSet.frequency.toFixed(1), label: "Frequency", warn: adSet.frequency >= 3.5 },
                { value: `${daysRunning}d`, label: "Running", warn: false },
                { value: usd.format(adSet.spend), label: "Spend", warn: false },
                { value: `${spendPct}%`, label: "of Campaign", warn: false },
              ].map((pill) => (
                <div key={pill.label} className="text-center">
                  <div className={`font-mono text-sm font-medium ${pill.warn ? "text-amber-400" : "text-foreground"}`}>
                    {pill.value}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mt-0.5">
                    {pill.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Charts ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 divide-x divide-border/50">
            {/* CTR Chart */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  CTR Over Time
                </span>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 rounded bg-gold" /> This ad set
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 rounded border-t border-dashed border-muted-foreground/40" /> Campaign median
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: MUTED }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                    tick={{ fontSize: 10, fill: MUTED }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <RechartsTooltip
                    formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "CTR"]}
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "#71717a" }}
                  />
                  <ReferenceLine y={medianCtr} stroke={MUTED} strokeDasharray="6 4" strokeWidth={1.5} />
                  <defs>
                    <linearGradient id="ctrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GOLD} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={GOLD} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="ctr" fill="url(#ctrFill)" stroke="none" />
                  <Line type="monotone" dataKey="ctr" stroke={GOLD} strokeWidth={2} dot={{ r: 3, fill: GOLD }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* CPA Chart */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  CPA Over Time
                </span>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 rounded bg-red-500" /> This ad set
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 rounded border-t border-dashed border-muted-foreground/40" /> Campaign median
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: MUTED }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                    tick={{ fontSize: 10, fill: MUTED }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <RechartsTooltip
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "CPA"]}
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "#71717a" }}
                  />
                  <ReferenceLine y={medianCpa} stroke={MUTED} strokeDasharray="6 4" strokeWidth={1.5} />
                  <ReferenceLine y={9} stroke={GREEN} strokeDasharray="3 6" strokeWidth={0.8} label={{ value: "$9 target", position: "right", fill: GREEN, fontSize: 9, opacity: 0.5 }} />
                  <defs>
                    <linearGradient id="cpaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={RED} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={RED} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="cpa" fill="url(#cpaFill)" stroke="none" />
                  <Line type="monotone" dataKey="cpa" stroke={RED} strokeWidth={2} dot={{ r: 3, fill: RED }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Peer Comparison ─────────────────────────────────── */}
          <div className="px-5 py-4 border-t border-border/50">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-3">
              CTR — Campaign Peers
            </div>
            <div className="space-y-1.5">
              {peerBars.map((peer) => (
                <div key={peer.adset_id} className="flex items-center gap-3">
                  <div
                    className={`w-40 text-xs truncate shrink-0 ${peer.isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}
                    title={peer.name}
                  >
                    {peer.name}
                    {peer.isCurrent && <span className="ml-1 text-muted-foreground/50">&#x25C0;</span>}
                  </div>
                  <div className="flex-1 h-[18px] bg-muted/20 rounded-sm relative overflow-hidden">
                    <div
                      className={`h-full rounded-sm ${peer.isCurrent ? "bg-amber-500/25" : "bg-emerald-500/20"}`}
                      style={{ width: `${maxPeerCtr > 0 ? (peer.ctr / maxPeerCtr) * 100 : 0}%` }}
                    />
                    {/* Median marker on first bar only to avoid clutter */}
                    {peer === peerBars[0] && medianCtr > 0 && maxPeerCtr > 0 && (
                      <div
                        className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-muted-foreground/40 rounded"
                        style={{ left: `${(medianCtr / maxPeerCtr) * 100}%` }}
                      >
                        <span className="absolute -top-3.5 -translate-x-1/2 text-[9px] text-muted-foreground/40 whitespace-nowrap">
                          median
                        </span>
                      </div>
                    )}
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] ${peer.isCurrent ? "text-amber-400" : "text-muted-foreground/60"}`}>
                      {pctFmt(peer.ctr)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Diagnostic Framework ───────────────────────────── */}
          <div className="px-5 py-4 border-t border-border/50">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-3">
              What&apos;s the problem?
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DIAGNOSTIC_CARDS.map((card) => {
                const isActive = card.scenario === diagnosis.scenario;
                return (
                  <div
                    key={card.scenario}
                    className={`rounded-md border p-3 transition-opacity ${
                      isActive
                        ? "border-gold/25 bg-gold/[0.06] opacity-100"
                        : "border-border/30 bg-background opacity-40"
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-1 ${isActive ? "text-gold" : "text-foreground"}`}>
                      {card.signal}
                      {isActive && <span className="ml-1.5 text-gold/60">&#10003;</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mb-1">{card.problem}</div>
                    <div className="text-[11px] font-medium text-gold/80">{card.actionHint}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Action Bar ─────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-background">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center text-sm">
                &#8635;
              </div>
              <div>
                <div className="text-xs font-medium text-foreground">
                  {DIAGNOSTIC_CARDS.find((c) => c.scenario === diagnosis.scenario)?.actionHint}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 max-w-xl">
                  {diagnosis.action}
                </div>
              </div>
            </div>
            <button
              onClick={onCollapse}
              className="text-[11px] text-muted-foreground/50 border border-border/50 rounded px-3 py-1 hover:border-muted-foreground/30 hover:text-muted-foreground transition-colors"
            >
              Collapse
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -5`
Expected: Build completes successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/workflows/adset-analyze-panel.tsx
git commit -m "feat: add AdSetAnalyzePanel component with trend charts, peer comparison, diagnostic framework"
```

---

### Task 3: Wire Panel Into Campaign Table

Render `AdSetAnalyzePanel` inside the campaign table when trend data exists for an ad set. Pass the required props.

**Files:**
- Modify: `src/components/workflows/meta-ads-fetch-summary.tsx`

- [ ] **Step 1: Add imports**

At the top of `meta-ads-fetch-summary.tsx`, add the import:

```typescript
import { AdSetAnalyzePanel } from "@/components/workflows/adset-analyze-panel";
```

Add it after the existing lucide-react imports (around line 25).

- [ ] **Step 2: Render the panel below the ad set row**

In the `CampaignTable` function, find the section where ad rows are rendered (after the ad set `</tr>` tag, around line 719-796). Replace the ad rows section with the analyze panel when trend data exists, and show ad rows below it.

Replace the block starting at `{/* Ad rows */}` (line 721) through the end of the Fragment (line 797) with:

```typescript
                        {/* Analyze Panel (shows when trend data loaded) */}
                        {trendData.has(as.adset_id) && (
                          <AdSetAnalyzePanel
                            adSet={as}
                            trendData={trendData.get(as.adset_id)!}
                            campaignAdSets={childAdSets}
                            campaign={c}
                            onCollapse={() => {
                              setTrendData((prev) => {
                                const next = new Map(prev);
                                next.delete(as.adset_id);
                                return next;
                              });
                            }}
                          />
                        )}

                        {/* Ad rows (below the analyze panel, or standalone if no analysis) */}
                        {isAdSetExpanded &&
                          childAds.map((ad) => {
                            const adTrend = trendData
                              .get(as.adset_id)
                              ?.ads.find((t) => t.ad_id === ad.ad_id);
                            return (
                              <tr
                                key={ad.ad_id}
                                className="border-b border-border/20 border-l-2 border-l-border/40 bg-muted/5 text-xs"
                              >
                                <td
                                  className="py-1.5 pr-4 pl-14 max-w-[200px] text-muted-foreground/80"
                                  title={ad.ad_name}
                                >
                                  <div className="flex items-center gap-2">
                                    <AdThumbnail
                                      ad={ad}
                                      onClick={setLightboxAd}
                                    />
                                    <div className="min-w-0">
                                      <span className="truncate block text-xs">
                                        {ad.ad_name}
                                      </span>
                                      <HealthBadge
                                        health={
                                          adTrend?.revised_health ?? ad.health
                                        }
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground/60">
                                  {usd.format(ad.spend)}
                                </td>
                                <td className={`py-1.5 pr-3 text-right tabular-nums ${cpaColor(ad.cpa)}`}>
                                  {ad.purchases > 0 ? (
                                    <span className="inline-flex items-center gap-1 justify-end">
                                      {adTrend && (
                                        <TrendArrow
                                          direction={adTrend.trend.cpa_direction}
                                          inverse
                                        />
                                      )}
                                      {usd2.format(ad.cpa)}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground/60">
                                  {ad.clicks > 0 ? (
                                    <span><span className="text-[10px] text-muted-foreground/40">CVR </span>{pct((ad.purchases / ad.clicks) * 100)}</span>
                                  ) : "—"}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground/60">
                                  {num.format(ad.purchases)}
                                </td>
                                <td className="py-1.5 text-right tabular-nums text-muted-foreground/60">
                                  {ad.impressions > 0 ? (
                                    <span className="inline-flex items-center gap-1 justify-end">
                                      {adTrend && (
                                        <TrendArrow
                                          direction={adTrend.trend.ctr_direction}
                                        />
                                      )}
                                      <span className="text-[10px] text-muted-foreground/40">CTR </span>
                                      {pct((ad.clicks / ad.impressions) * 100)}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
```

Note: The `campaign` variable is `c` in the existing code (the loop variable from `campaigns.map((c) => ...)`). The `childAdSets` variable already exists from the existing `adSetsFor` call.

- [ ] **Step 3: Pass `campaigns` data to access MoM**

The `CampaignTable` already receives `campaigns` as a prop. The `c` variable in the loop is the campaign row. The `childAdSets` is already computed via `adSetsFor(c.campaign_id)`. No additional prop changes needed.

- [ ] **Step 4: Build and verify**

Run: `npm run build 2>&1 | tail -5`
Expected: Build passes

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (118 existing + 6 new = 124)

- [ ] **Step 6: Commit**

```bash
git add src/components/workflows/meta-ads-fetch-summary.tsx
git commit -m "feat: wire AdSetAnalyzePanel into campaign table"
```

---

### Task 4: Visual Verification & Polish

Test the full flow by running the dev server and verifying the panel renders correctly.

**Files:** None (verification only)

- [ ] **Step 1: Start dev server and run a Meta Ads Analysis**

Run: `npm run dev`

Navigate to the Meta Ads Analysis workflow, run an analysis on the latest month. Wait for completion. Expand a campaign to see ad sets.

- [ ] **Step 2: Verify flags render on ad sets**

Check that "Low CTR" and/or "CPA ↑" badges appear on ad sets that meet the thresholds. Hover to see tooltip detail.

- [ ] **Step 3: Click Analyze on a flagged ad set**

Verify:
1. "Analyzing..." text shows while loading
2. Panel appears inline below the ad set row
3. Header shows the diagnosis text and context pills
4. CTR chart shows gold line with campaign median dashed overlay
5. CPA chart shows red line with campaign median dashed overlay and $9 target line
6. Peer comparison shows horizontal bars ranked by CTR with the current ad set highlighted in amber
7. One diagnostic card is highlighted in gold
8. Action bar shows the recommended action at the bottom
9. "Collapse" button removes the panel

- [ ] **Step 4: Verify Analyze on non-flagged ad sets**

Click Analyze on an ad set WITHOUT flags. The panel should still render (the diagnostic framework still highlights whichever scenario matches). This validates that any ad set can be analyzed, not just flagged ones.

- [ ] **Step 5: Check backward compatibility with old runs**

Load a previously completed run (from run history). Verify:
- Old ad set rows render without flags (no crashes)
- Old ad rows still show health badges
- Clicking Analyze still works (fetches on demand)

- [ ] **Step 6: Fix any visual issues**

If charts are too tall/short, spacing is off, colors don't match the mockup, or text overflows — fix inline. This is polish work.

- [ ] **Step 7: Final build check**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 8: Commit and push**

```bash
git add -A
git commit -m "feat: ad set analyze panel with diagnostic framework, trend charts, peer comparison"
git push
```

---

## Verification Checklist

- [ ] `npm run build` passes
- [ ] `npx vitest run` passes (124+ tests)
- [ ] Analyze panel renders inline below flagged ad set
- [ ] CTR and CPA charts show weekly data with campaign median overlay
- [ ] Peer comparison shows all campaign ad sets ranked
- [ ] Correct diagnostic card highlighted based on data patterns
- [ ] Action bar shows clear, deterministic recommendation
- [ ] Collapse button works
- [ ] Old stored runs don't crash
- [ ] Non-flagged ad sets can still be analyzed
