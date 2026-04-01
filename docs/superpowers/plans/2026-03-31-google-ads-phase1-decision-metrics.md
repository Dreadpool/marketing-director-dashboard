# Google Ads Phase 1: Decision Metrics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Google Ads Analysis workflow (Phase 1) that shows CPA/ROAS decision metrics per segment (Brand/Non-Brand/Competitor/PMax/Video) with green/yellow/red thresholds, ground truth comparison against BigQuery bookings, and MoM/YoY trends.

**Architecture:** Executor fetches campaign data from Google Ads API for current, prior, and YoY periods via three `getMonthlySpend()` calls in parallel. Campaigns are classified into segments by name pattern matching. Account health is computed per segment with CPA/ROAS status flags. BigQuery sales orders provide ground truth booking count for over-attribution comparison. AI analyze + recommend steps use framework-aware prompts.

**Tech Stack:** TypeScript, Google Ads API (GAQL via google-ads-api SDK), BigQuery, Vitest

**Spec:** `docs/superpowers/specs/2026-03-31-google-ads-decision-framework.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/schemas/sources/google-ads-metrics.ts` | Output types for the executor |
| Create | `src/lib/workflows/executors/fetch-google-ads.ts` | Fetch executor function |
| Create | `src/lib/workflows/prompts/google-ads.ts` | Analyze + recommend prompts |
| Create | `src/lib/workflows/__tests__/google-ads.test.ts` | Tests for types, segmentation, thresholds, prompts |
| Modify | `src/lib/workflows/executors/index.ts` | Register executor |
| Modify | `src/lib/workflows/prompts/index.ts` | Register prompts |
| Modify | `src/lib/workflows.ts` | Change status to "active" |

---

### Task 1: Google Ads Metrics Types

**Files:**
- Create: `src/lib/schemas/sources/google-ads-metrics.ts`
- Test: `src/lib/workflows/__tests__/google-ads.test.ts`

- [ ] **Step 1: Create the metrics type file**

```typescript
// src/lib/schemas/sources/google-ads-metrics.ts

/**
 * GoogleAdsMetrics: Return type of the Google Ads Analysis fetch executor.
 * Decision framework: Vallaeys (Stars/Zombies/Bleeders) + Geddes (QS) + Impression Share.
 * Spec: docs/superpowers/specs/2026-03-31-google-ads-decision-framework.md
 */

export type GoogleAdsPeriod = {
  year: number;
  month: string;
  month_num: number;
  date_range: { start: string; end: string };
};

export type CampaignSegment = "brand" | "non-brand" | "competitor" | "pmax" | "video" | "other";

export type CpaStatus = "on-target" | "elevated" | "high";
export type RoasStatus = "above-target" | "watch" | "below-target";

export type GoogleAdsSegmentHealth = {
  segment: CampaignSegment;
  total_spend: number;
  total_clicks: number;
  total_impressions: number;
  total_conversions: number;
  total_conversions_value: number;
  cpa: number;
  roas: number;
  ctr: number;
  avg_cpc: number;
  cpa_status: CpaStatus;
  roas_status: RoasStatus;
  campaign_count: number;
};

export type GoogleAdsAccountHealth = {
  total_spend: number;
  total_clicks: number;
  total_impressions: number;
  total_conversions: number;
  total_conversions_value: number;
  cpa: number;
  roas: number;
  ctr: number;
  avg_cpc: number;
  cpa_status: CpaStatus;
  roas_status: RoasStatus;
  segments: GoogleAdsSegmentHealth[];
};

export type GoogleAdsCampaignMetrics = {
  campaign_id: string;
  campaign_name: string;
  status: string;
  segment: CampaignSegment;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversions_value: number;
  cpa: number;
  roas: number;
  ctr: number;
  avg_cpc: number;
};

export type GoogleAdsGroundTruth = {
  bigquery_bookings: number;
  google_ads_conversions: number;
  attribution_ratio: number;
  divergence_flag: boolean;
};

export type GoogleAdsTrend = {
  current: number;
  prior_month: number;
  prior_year: number | null;
  mom_change: number;
  yoy_change: number | null;
};

export type GoogleAdsSourceDetail = {
  displayName: string;
  status: "ok" | "warning" | "error";
  message?: string;
};

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
  metadata: {
    generated_at: string;
    loaded_sources: string[];
    missing_sources: string[];
    source_details: Record<string, GoogleAdsSourceDetail>;
  };
};
```

- [ ] **Step 2: Write type validation tests**

```typescript
// src/lib/workflows/__tests__/google-ads.test.ts

import { describe, it, expect } from "vitest";
import type {
  CampaignSegment,
  CpaStatus,
  RoasStatus,
  GoogleAdsMetrics,
} from "@/lib/schemas/sources/google-ads-metrics";

describe("Google Ads metrics types", () => {
  it("CampaignSegment covers all SLE campaign types", () => {
    const segments: CampaignSegment[] = [
      "brand", "non-brand", "competitor", "pmax", "video", "other",
    ];
    expect(segments).toHaveLength(6);
  });

  it("CpaStatus matches SLE thresholds", () => {
    const statuses: CpaStatus[] = ["on-target", "elevated", "high"];
    expect(statuses).toHaveLength(3);
  });

  it("RoasStatus includes watch tier", () => {
    const statuses: RoasStatus[] = ["above-target", "watch", "below-target"];
    expect(statuses).toHaveLength(3);
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run src/lib/workflows/__tests__/google-ads.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 4: Commit**

```bash
git add src/lib/schemas/sources/google-ads-metrics.ts src/lib/workflows/__tests__/google-ads.test.ts
git commit -m "feat: add Google Ads metrics types for decision framework"
```

---

### Task 2: Campaign Segmentation Logic

**Files:**
- Create: `src/lib/workflows/executors/fetch-google-ads.ts` (partial — segmentation helper only)
- Test: `src/lib/workflows/__tests__/google-ads.test.ts` (append)

- [ ] **Step 1: Write segmentation tests**

Append to `src/lib/workflows/__tests__/google-ads.test.ts`:

```typescript
import { classifySegment } from "@/lib/workflows/executors/fetch-google-ads";

describe("classifySegment", () => {
  it("classifies brand campaigns", () => {
    expect(classifySegment("SLE | Search | Brand")).toBe("brand");
  });

  it("classifies non-brand campaigns", () => {
    expect(classifySegment("SLE | Search | Non-Branded")).toBe("non-brand");
    expect(classifySegment("STGEO | Search | Non-Branded")).toBe("non-brand");
    expect(classifySegment("NWS | Search | Non-Branded")).toBe("non-brand");
    expect(classifySegment("SLE Charters")).toBe("non-brand");
  });

  it("classifies competitor campaigns", () => {
    expect(classifySegment("SLE | Search | Competitors")).toBe("competitor");
  });

  it("classifies PMax campaigns", () => {
    expect(classifySegment("Charters - P-Max")).toBe("pmax");
    expect(classifySegment("SLE - Performance Max")).toBe("pmax");
  });

  it("classifies video campaigns", () => {
    expect(classifySegment("GMA | Video Remarketing")).toBe("video");
    expect(classifySegment("SLE | Video | Brand")).toBe("video");
  });

  it("falls back to other for unknown patterns", () => {
    expect(classifySegment("Unknown Campaign Name")).toBe("other");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run src/lib/workflows/__tests__/google-ads.test.ts`
Expected: FAIL — `classifySegment` does not exist yet

- [ ] **Step 3: Implement classifySegment and threshold helpers**

Create `src/lib/workflows/executors/fetch-google-ads.ts` with the segmentation logic and thresholds:

```typescript
// src/lib/workflows/executors/fetch-google-ads.ts

import type { MonthPeriod } from "@/lib/schemas/types";
import type {
  CampaignSegment,
  CpaStatus,
  RoasStatus,
  GoogleAdsMetrics,
} from "@/lib/schemas/sources/google-ads-metrics";

// --- SLE Thresholds (derived from unit economics, matches Meta) ---

export const GOOGLE_ADS_THRESHOLDS = {
  cpa_on_target: 9,
  cpa_elevated: 14,
  roas_floor: 3.0,
  roas_watch: 2.0,
  over_attribution: 1.3,
  gp_per_order: 35.23,
  gross_margin: 0.43,
  ground_truth_divergence: 0.30,
} as const;

// --- Helpers ---

function safeDivide(num: number, den: number, fallback = 0): number {
  return den > 0 ? num / den : fallback;
}

export function classifySegment(campaignName: string): CampaignSegment {
  const name = campaignName.toLowerCase();
  if (name.includes("p-max") || name.includes("performance max")) return "pmax";
  if (name.includes("video")) return "video";
  if (name.includes("competitor")) return "competitor";
  if (name.includes("brand") && !name.includes("non-brand")) return "brand";
  if (name.includes("non-brand")) return "non-brand";
  // SLE-specific: charter and route campaigns are non-brand acquisition
  if (name.includes("charter") || name.includes("stgeo") || name.includes("nws")) return "non-brand";
  return "other";
}

export function getCpaStatus(cpa: number): CpaStatus {
  if (cpa <= GOOGLE_ADS_THRESHOLDS.cpa_on_target) return "on-target";
  if (cpa <= GOOGLE_ADS_THRESHOLDS.cpa_elevated) return "elevated";
  return "high";
}

export function getRoasStatus(roas: number): RoasStatus {
  if (roas >= GOOGLE_ADS_THRESHOLDS.roas_floor) return "above-target";
  if (roas >= GOOGLE_ADS_THRESHOLDS.roas_watch) return "watch";
  return "below-target";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run src/lib/workflows/__tests__/google-ads.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Add threshold tests**

Append to `src/lib/workflows/__tests__/google-ads.test.ts`:

```typescript
import {
  classifySegment,
  getCpaStatus,
  getRoasStatus,
  GOOGLE_ADS_THRESHOLDS,
} from "@/lib/workflows/executors/fetch-google-ads";

describe("GOOGLE_ADS_THRESHOLDS", () => {
  it("matches SLE unit economics", () => {
    expect(GOOGLE_ADS_THRESHOLDS.cpa_on_target).toBe(9);
    expect(GOOGLE_ADS_THRESHOLDS.cpa_elevated).toBe(14);
    expect(GOOGLE_ADS_THRESHOLDS.roas_floor).toBe(3.0);
    expect(GOOGLE_ADS_THRESHOLDS.gp_per_order).toBe(35.23);
    expect(GOOGLE_ADS_THRESHOLDS.gross_margin).toBe(0.43);
    expect(GOOGLE_ADS_THRESHOLDS.over_attribution).toBe(1.3);
  });
});

describe("getCpaStatus", () => {
  it("returns on-target for CPA <= $9", () => {
    expect(getCpaStatus(5)).toBe("on-target");
    expect(getCpaStatus(9)).toBe("on-target");
  });

  it("returns elevated for CPA $9-$14", () => {
    expect(getCpaStatus(9.01)).toBe("elevated");
    expect(getCpaStatus(14)).toBe("elevated");
  });

  it("returns high for CPA > $14", () => {
    expect(getCpaStatus(14.01)).toBe("high");
    expect(getCpaStatus(50)).toBe("high");
  });
});

describe("getRoasStatus", () => {
  it("returns above-target for ROAS >= 3.0x", () => {
    expect(getRoasStatus(3.0)).toBe("above-target");
    expect(getRoasStatus(5.0)).toBe("above-target");
  });

  it("returns watch for ROAS 2.0x-3.0x", () => {
    expect(getRoasStatus(2.0)).toBe("watch");
    expect(getRoasStatus(2.99)).toBe("watch");
  });

  it("returns below-target for ROAS < 2.0x", () => {
    expect(getRoasStatus(1.99)).toBe("below-target");
    expect(getRoasStatus(0)).toBe("below-target");
  });
});
```

- [ ] **Step 6: Run all tests**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run src/lib/workflows/__tests__/google-ads.test.ts`
Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/workflows/executors/fetch-google-ads.ts src/lib/workflows/__tests__/google-ads.test.ts
git commit -m "feat: add campaign segmentation and CPA/ROAS threshold logic"
```

---

### Task 3: Fetch Executor

**Files:**
- Modify: `src/lib/workflows/executors/fetch-google-ads.ts` (add main executor function)

- [ ] **Step 1: Implement the full fetchGoogleAds executor**

Append to `src/lib/workflows/executors/fetch-google-ads.ts` after the existing helpers:

```typescript
import { getMonthlySpend } from "@/lib/services/google-ads";
import { getSalesOrders } from "@/lib/services/bigquery-sales";
import type { GoogleAdsCampaignRow } from "@/lib/schemas/sources/google-ads";
import type {
  GoogleAdsMetrics,
  GoogleAdsCampaignMetrics,
  GoogleAdsSegmentHealth,
  GoogleAdsAccountHealth,
  GoogleAdsGroundTruth,
  GoogleAdsTrend,
  GoogleAdsSourceDetail,
} from "@/lib/schemas/sources/google-ads-metrics";

// Add these imports at the top of the file (alongside existing ones):
// import { microsToUSD } from "@/lib/schemas/utils";

function microsToUSD(micros: number | string): number {
  return Number(micros) / 1_000_000;
}

function mapCampaignRow(row: GoogleAdsCampaignRow): GoogleAdsCampaignMetrics {
  const spend = microsToUSD(row.metrics.cost_micros);
  const clicks = Number(row.metrics.clicks);
  const impressions = Number(row.metrics.impressions);
  const conversions = Number(row.metrics.conversions ?? 0);
  const conversionsValue = Number(row.metrics.conversions_value ?? 0);

  return {
    campaign_id: row.campaign.id,
    campaign_name: row.campaign.name,
    status: row.campaign.status ?? "UNKNOWN",
    segment: classifySegment(row.campaign.name),
    spend,
    clicks,
    impressions,
    conversions,
    conversions_value: conversionsValue,
    cpa: safeDivide(spend, conversions),
    roas: safeDivide(conversionsValue, spend),
    ctr: safeDivide(clicks, impressions),
    avg_cpc: safeDivide(spend, clicks),
  };
}

function computeSegmentHealth(
  campaigns: GoogleAdsCampaignMetrics[],
  segment: CampaignSegment,
): GoogleAdsSegmentHealth {
  const filtered = campaigns.filter((c) => c.segment === segment);
  const totalSpend = filtered.reduce((s, c) => s + c.spend, 0);
  const totalClicks = filtered.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = filtered.reduce((s, c) => s + c.impressions, 0);
  const totalConversions = filtered.reduce((s, c) => s + c.conversions, 0);
  const totalConversionsValue = filtered.reduce((s, c) => s + c.conversions_value, 0);
  const cpa = safeDivide(totalSpend, totalConversions);
  const roas = safeDivide(totalConversionsValue, totalSpend);

  return {
    segment,
    total_spend: totalSpend,
    total_clicks: totalClicks,
    total_impressions: totalImpressions,
    total_conversions: totalConversions,
    total_conversions_value: totalConversionsValue,
    cpa,
    roas,
    ctr: safeDivide(totalClicks, totalImpressions),
    avg_cpc: safeDivide(totalSpend, totalClicks),
    cpa_status: totalConversions > 0 ? getCpaStatus(cpa) : "on-target",
    roas_status: totalSpend > 0 ? getRoasStatus(roas) : "above-target",
    campaign_count: filtered.length,
  };
}

function computeAccountHealth(
  campaigns: GoogleAdsCampaignMetrics[],
): GoogleAdsAccountHealth {
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalConversionsValue = campaigns.reduce((s, c) => s + c.conversions_value, 0);
  const cpa = safeDivide(totalSpend, totalConversions);
  const roas = safeDivide(totalConversionsValue, totalSpend);

  const segmentTypes: CampaignSegment[] = ["brand", "non-brand", "competitor", "pmax", "video", "other"];
  const segments = segmentTypes
    .map((seg) => computeSegmentHealth(campaigns, seg))
    .filter((s) => s.campaign_count > 0);

  return {
    total_spend: totalSpend,
    total_clicks: totalClicks,
    total_impressions: totalImpressions,
    total_conversions: totalConversions,
    total_conversions_value: totalConversionsValue,
    cpa,
    roas,
    ctr: safeDivide(totalClicks, totalImpressions),
    avg_cpc: safeDivide(totalSpend, totalClicks),
    cpa_status: totalConversions > 0 ? getCpaStatus(cpa) : "on-target",
    roas_status: totalSpend > 0 ? getRoasStatus(roas) : "above-target",
    segments,
  };
}

function computeGroundTruth(
  googleConversions: number,
  bigqueryBookings: number,
): GoogleAdsGroundTruth {
  const ratio = safeDivide(googleConversions, bigqueryBookings, 1);
  return {
    bigquery_bookings: bigqueryBookings,
    google_ads_conversions: googleConversions,
    attribution_ratio: ratio,
    divergence_flag: Math.abs(ratio - 1) > GOOGLE_ADS_THRESHOLDS.ground_truth_divergence,
  };
}

function computeTrend(
  current: number,
  priorMonth: number,
  priorYear: number | null,
): GoogleAdsTrend {
  return {
    current,
    prior_month: priorMonth,
    prior_year: priorYear,
    mom_change: priorMonth > 0 ? (current - priorMonth) / priorMonth : 0,
    yoy_change: priorYear !== null && priorYear > 0
      ? (current - priorYear) / priorYear
      : null,
  };
}

function aggregateMetric(
  rows: GoogleAdsCampaignRow[],
  metric: "cost_micros" | "conversions" | "conversions_value",
): number {
  return rows.reduce((sum, r) => {
    const val = metric === "cost_micros"
      ? microsToUSD(r.metrics[metric])
      : Number(r.metrics[metric] ?? 0);
    return sum + val;
  }, 0);
}

function getPriorMonthPeriod(period: MonthPeriod): MonthPeriod {
  if (period.month === 1) return { year: period.year - 1, month: 12 };
  return { year: period.year, month: period.month - 1 };
}

function getYoYPeriod(period: MonthPeriod): MonthPeriod {
  return { year: period.year - 1, month: period.month };
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function fetchGoogleAds(period: MonthPeriod): Promise<GoogleAdsMetrics> {
  const startDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const lastDay = new Date(period.year, period.month, 0).getDate();
  const endDate = `${period.year}-${String(period.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const priorPeriod = getPriorMonthPeriod(period);
  const yoyPeriod = getYoYPeriod(period);

  // Fetch current, prior month, YoY, and BigQuery ground truth in parallel
  const [currentResult, priorResult, yoyResult, salesResult] =
    await Promise.allSettled([
      getMonthlySpend(period),
      getMonthlySpend(priorPeriod),
      getMonthlySpend(yoyPeriod),
      getSalesOrders(period),
    ]);

  // Current month is required
  if (currentResult.status === "rejected") {
    throw new Error(`Google Ads fetch failed: ${currentResult.reason}`);
  }
  const currentRows = currentResult.value;

  // Prior month and YoY are optional
  const priorRows = priorResult.status === "fulfilled" ? priorResult.value : [];
  const yoyRows = yoyResult.status === "fulfilled" ? yoyResult.value : null;

  // BigQuery ground truth is optional
  const salesOrders = salesResult.status === "fulfilled" ? salesResult.value : null;

  // Track source status
  const sourceDetails: Record<string, GoogleAdsSourceDetail> = {
    google_ads_current: {
      displayName: "Google Ads (Current Month)",
      status: "ok",
    },
    google_ads_prior: {
      displayName: "Google Ads (Prior Month)",
      status: priorResult.status === "fulfilled" ? "ok" : "warning",
      message: priorResult.status === "rejected"
        ? `Failed: ${priorResult.reason}` : undefined,
    },
    google_ads_yoy: {
      displayName: "Google Ads (Year-over-Year)",
      status: yoyResult.status === "fulfilled" ? "ok" : "warning",
      message: yoyResult.status === "rejected"
        ? `Failed: ${yoyResult.reason}` : undefined,
    },
    bigquery_sales: {
      displayName: "BigQuery Sales Orders (Ground Truth)",
      status: salesResult.status === "fulfilled" ? "ok" : "warning",
      message: salesResult.status === "rejected"
        ? `Failed: ${salesResult.reason}` : undefined,
    },
  };

  const loadedSources = Object.entries(sourceDetails)
    .filter(([, d]) => d.status === "ok")
    .map(([k]) => k);
  const missingSources = Object.entries(sourceDetails)
    .filter(([, d]) => d.status !== "ok")
    .map(([k]) => k);

  // Map campaigns
  const campaigns = currentRows
    .map(mapCampaignRow)
    .filter((c) => c.spend > 0 || c.conversions > 0);

  // Account health
  const accountHealth = computeAccountHealth(campaigns);

  // Ground truth comparison
  const bigqueryBookings = salesOrders?.length ?? 0;
  const groundTruth = computeGroundTruth(
    accountHealth.total_conversions,
    bigqueryBookings,
  );

  // Trends (MoM and YoY)
  const priorSpend = aggregateMetric(priorRows, "cost_micros");
  const priorConversions = aggregateMetric(priorRows, "conversions");
  const priorConversionsValue = aggregateMetric(priorRows, "conversions_value");
  const priorCpa = safeDivide(priorSpend, priorConversions);
  const priorRoas = safeDivide(priorConversionsValue, priorSpend);

  const yoySpend = yoyRows ? aggregateMetric(yoyRows, "cost_micros") : null;
  const yoyConversions = yoyRows ? aggregateMetric(yoyRows, "conversions") : null;
  const yoyConversionsValue = yoyRows ? aggregateMetric(yoyRows, "conversions_value") : null;
  const yoyCpa = yoyConversions !== null && yoySpend !== null
    ? safeDivide(yoySpend, yoyConversions) : null;
  const yoyRoas = yoyConversionsValue !== null && yoySpend !== null
    ? safeDivide(yoyConversionsValue, yoySpend) : null;

  const trends = {
    cpa: computeTrend(accountHealth.cpa, priorCpa, yoyCpa),
    roas: computeTrend(accountHealth.roas, priorRoas, yoyRoas),
    conversions: computeTrend(accountHealth.total_conversions, priorConversions, yoyConversions),
    spend: computeTrend(accountHealth.total_spend, priorSpend, yoySpend),
  };

  return {
    period: {
      year: period.year,
      month: MONTH_NAMES[period.month],
      month_num: period.month,
      date_range: { start: startDate, end: endDate },
    },
    account_health: accountHealth,
    campaigns,
    ground_truth: groundTruth,
    trends,
    metadata: {
      generated_at: new Date().toISOString(),
      loaded_sources: loadedSources,
      missing_sources: missingSources,
      source_details: sourceDetails,
    },
  };
}
```

Note: This step replaces the entire file. The final file should contain the imports, thresholds, helpers (`safeDivide`, `classifySegment`, `getCpaStatus`, `getRoasStatus`), all the private functions (`mapCampaignRow`, `computeSegmentHealth`, `computeAccountHealth`, `computeGroundTruth`, `computeTrend`, `aggregateMetric`, `getPriorMonthPeriod`, `getYoYPeriod`), and the exported `fetchGoogleAds` function. Make sure the imports at the top of the file include all dependencies:

```typescript
import type { MonthPeriod } from "@/lib/schemas/types";
import type { GoogleAdsCampaignRow } from "@/lib/schemas/sources/google-ads";
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
  GoogleAdsSourceDetail,
} from "@/lib/schemas/sources/google-ads-metrics";
import { getMonthlySpend } from "@/lib/services/google-ads";
import { getSalesOrders } from "@/lib/services/bigquery-sales";
```

- [ ] **Step 2: Run tests to verify existing tests still pass**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run src/lib/workflows/__tests__/google-ads.test.ts`
Expected: PASS (all existing tests)

- [ ] **Step 3: Commit**

```bash
git add src/lib/workflows/executors/fetch-google-ads.ts
git commit -m "feat: implement Google Ads fetch executor with segmentation and trends"
```

---

### Task 4: Prompts

**Files:**
- Create: `src/lib/workflows/prompts/google-ads.ts`
- Test: `src/lib/workflows/__tests__/google-ads.test.ts` (append)

- [ ] **Step 1: Write prompt tests**

Append to `src/lib/workflows/__tests__/google-ads.test.ts`:

```typescript
import { googleAdsPrompts } from "@/lib/workflows/prompts/google-ads";

describe("Google Ads prompts", () => {
  it("has analyze and recommend prompts", () => {
    expect(googleAdsPrompts.analyze).toBeDefined();
    expect(googleAdsPrompts.recommend).toBeDefined();
  });

  it("analyze prompt contains SLE unit economics", () => {
    const p = googleAdsPrompts.analyze;
    expect(p).toContain("$9");
    expect(p).toContain("$14");
    expect(p).toContain("$35.23");
    expect(p).toContain("1.3x");
    expect(p).toContain("3.0x");
  });

  it("analyze prompt references brand vs non-brand segmentation", () => {
    const p = googleAdsPrompts.analyze;
    expect(p).toContain("brand");
    expect(p).toContain("non-brand");
  });

  it("analyze prompt references ground truth comparison", () => {
    const p = googleAdsPrompts.analyze;
    expect(p).toContain("BigQuery");
    expect(p).toContain("ground truth");
  });

  it("recommend prompt uses ACTION/PRIORITY/CATEGORY format", () => {
    const p = googleAdsPrompts.recommend;
    expect(p).toContain("ACTION:");
    expect(p).toContain("PRIORITY:");
    expect(p).toContain("CATEGORY:");
  });

  it("prompts are substantial (>100 chars each)", () => {
    expect(googleAdsPrompts.analyze.length).toBeGreaterThan(100);
    expect(googleAdsPrompts.recommend.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run src/lib/workflows/__tests__/google-ads.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the prompts file**

```typescript
// src/lib/workflows/prompts/google-ads.ts

export const googleAdsPrompts: Record<string, string> = {
  analyze: `You are a paid search analyst for Salt Lake Express (SLE), a bus transportation company. You are providing INSIGHTS on Google Ads performance, not a data report.

CRITICAL: The user has already seen a dashboard above your output that shows ALL of the following:
- Account health: CPA (with status color), ROAS, conversions, spend — segmented by Brand / Non-Brand / Competitor / PMax / Video
- Campaign table with spend, CPA, ROAS, conversions, CTR, CPC per campaign
- Ground truth comparison: Google Ads conversions vs BigQuery actual bookings
- MoM and YoY trend arrows on all key metrics

Do NOT repeat numbers, metrics, or tables the dashboard already shows. Your job is to surface what the dashboard CANNOT show: patterns, connections between metrics, risks, and what to do about them.

## SLE Unit Economics
- GP per order: $35.23 (43% margin on $82 avg order, regular routes)
- Google Ads over-attribution: 1.3x (true CPA ≈ reported CPA × 1.3)
- CPA thresholds: <=$9 on-target, $9-$14 elevated, >$14 high
- ROAS floor: 3.0x. CPA is the primary decision metric, not ROAS.
- BigQuery is ground truth for bookings. Google Ads conversions are GA4 events, not actual purchases.

## Google Ads Decision Framework (Vallaeys / Geddes)
- Always analyze Brand and Non-Brand separately. Blended metrics are misleading.
- Non-Brand is the real acquisition engine. Brand inflates blended CPA downward.
- Focus on: Is non-brand CPA healthy? Are profitable campaigns budget-capped? Are there campaigns spending with no conversions (zombies)?

## Output Format

### Executive Summary (2-3 sentences)
Lead with the single most important finding. Is the account healthy or not? What's the one thing to pay attention to?

### Key Insights (3-5 max)
Each insight follows this structure:

**[One-line finding]**
Why it matters: [One sentence on business impact]
Action: [One sentence — what to do, or "Monitor"]

Focus on:
- Brand vs non-brand CPA divergence (blended CPA hides problems)
- Ground truth divergence (Google says X conversions, BigQuery shows Y bookings)
- MoM or YoY trends that signal a shift, not noise
- Campaigns spending significant budget with zero or few conversions (zombies/bleeders)
- Budget concentration risk (one campaign driving most conversions)

Do NOT include:
- Tables of numbers already on the dashboard
- Per-campaign breakdowns (the campaign table already shows this)
- Restating CPA/ROAS status that's already color-coded on the dashboard

### Formatting Rules
- Use ### for section headers (Executive Summary, Key Insights)
- Use **bold** for each insight title
- Use bullet points with "Why it matters:" and "Action:" for each insight
- Keep total output under 300 words
- No tables, no ASCII art, no dense paragraphs`,

  recommend: `You are creating action items from the Google Ads analysis for Salt Lake Express. You have the analysis insights and the full data.

## SLE Unit Economics
- GP per order: $35.23 (43% margin on $82 avg order)
- Google Ads over-attribution: 1.3x. CPA: <=$9 on-target, $9-$14 elevated, >$14 high
- ROAS floor: 3.0x
- BigQuery is ground truth. Google Ads conversions are GA4 events.

## Action Item Format

Each action MUST use this exact format for parsing:

ACTION: [Specific action with numbers. "Increase non-brand budget by $1,000/month" not "Consider increasing budget."]
PRIORITY: [HIGH/MEDIUM/LOW]
CATEGORY: [budget/keywords/bidding/structure/measurement/creative]

Provide 3-5 action items. HIGH = high CPA/ROAS impact + low effort. Be specific and actionable.

## Google Ads Specific Categories
- budget: Budget increases/decreases, reallocation between campaigns
- keywords: Negative keywords, match type changes, new keyword opportunities
- bidding: Bid strategy changes, target CPA/ROAS adjustments
- structure: Campaign consolidation, segmentation, search partner exclusion
- measurement: Conversion tracking fixes, attribution, ground truth alignment
- creative: Ad copy testing, RSA pinning, extension improvements

## Open Questions

End with 1-2 open questions about data quality or attribution that affect the analysis.

OPEN QUESTIONS:
- [Question about something the data can't answer]`,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run src/lib/workflows/__tests__/google-ads.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflows/prompts/google-ads.ts src/lib/workflows/__tests__/google-ads.test.ts
git commit -m "feat: add Google Ads analyze and recommend prompts"
```

---

### Task 5: Register and Activate

**Files:**
- Modify: `src/lib/workflows/executors/index.ts`
- Modify: `src/lib/workflows/prompts/index.ts`
- Modify: `src/lib/workflows.ts`
- Test: `src/lib/workflows/__tests__/google-ads.test.ts` (append)

- [ ] **Step 1: Write registration tests**

Append to `src/lib/workflows/__tests__/google-ads.test.ts`:

```typescript
import { getExecutor } from "@/lib/workflows/executors/index";
import { getDefaultPrompt } from "@/lib/workflows/prompts/index";
import { getWorkflowBySlug } from "@/lib/workflows";

describe("Google Ads workflow registration", () => {
  it("executor is registered", () => {
    const executor = getExecutor("google-ads-analysis");
    expect(executor).toBeDefined();
    expect(typeof executor).toBe("function");
  });

  it("analyze prompt is registered", () => {
    const prompt = getDefaultPrompt("google-ads-analysis", "analyze");
    expect(prompt).not.toBeNull();
    expect(prompt!.length).toBeGreaterThan(100);
  });

  it("recommend prompt is registered", () => {
    const prompt = getDefaultPrompt("google-ads-analysis", "recommend");
    expect(prompt).not.toBeNull();
    expect(prompt!.length).toBeGreaterThan(100);
  });

  it("workflow is active", () => {
    const wf = getWorkflowBySlug("google-ads-analysis");
    expect(wf).toBeDefined();
    expect(wf!.status).toBe("active");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run src/lib/workflows/__tests__/google-ads.test.ts`
Expected: FAIL — executor not registered, workflow still "coming-soon"

- [ ] **Step 3: Register executor**

Edit `src/lib/workflows/executors/index.ts`:

Add import at top:
```typescript
import { fetchGoogleAds } from "./fetch-google-ads";
```

Add to the executors record:
```typescript
const executors: Record<string, FetchExecutor> = {
  "monthly-analytics-review": fetchMonthlyAnalytics as unknown as FetchExecutor,
  "meta-ads-analysis": fetchMetaAds as unknown as FetchExecutor,
  "google-ads-analysis": fetchGoogleAds as unknown as FetchExecutor,
};
```

- [ ] **Step 4: Register prompts**

Edit `src/lib/workflows/prompts/index.ts`:

Add import at top:
```typescript
import { googleAdsPrompts } from "./google-ads";
```

Add to the defaultPrompts record:
```typescript
const defaultPrompts: Record<string, Record<string, string>> = {
  "monthly-analytics-review": monthlyAnalyticsPrompts,
  "meta-ads-analysis": metaAdsPrompts,
  "google-ads-analysis": googleAdsPrompts,
};
```

- [ ] **Step 5: Activate workflow**

Edit `src/lib/workflows.ts`. Change the `google-ads-analysis` workflow:

Change `status: "coming-soon"` to `status: "active"`.

Update description to:
```typescript
description: "Campaign performance by segment (Brand/Non-Brand/Competitor/PMax), CPA/ROAS decision metrics, ground truth comparison, and MoM/YoY trends.",
```

- [ ] **Step 6: Run all tests**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run`
Expected: PASS (all tests including existing workflow registry tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/workflows/executors/index.ts src/lib/workflows/prompts/index.ts src/lib/workflows.ts src/lib/workflows/__tests__/google-ads.test.ts
git commit -m "feat: register Google Ads executor, prompts, and activate workflow"
```

---

### Task 6: Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run lint**

Run: `cd /Users/brady/workspace/sle/marketing-director-dashboard && npm run lint`
Expected: No errors (warnings acceptable)

- [ ] **Step 4: Verify workflow appears in UI**

Start dev server: `npm run dev`
Navigate to `/workflows` — Google Ads Analysis should appear as an active workflow with the search icon.
Navigate to `/workflows/google-ads-analysis` — The workflow detail page should load without errors.
Navigate to `/calendar` — Google Ads should appear on the 10th.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build/lint issues from Google Ads workflow"
```
