# Meta Ads Guided Evaluation — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core evaluation loop — Step 1 (Decision Metrics) + CPA Diagnostic sub-flow (D1-D5) + Step 6 (Action Items Summary) — with interactive AI evaluation, user agree/override, and per-step editable action items.

**Architecture:** New `guided-evaluation` workflow type with its own evaluation engine, separate from the linear fetch→analyze→recommend pipeline. Shares DB tables with existing workflows. Interactive step-by-step execution where each step pauses for user input.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM (Neon Postgres), Anthropic SDK (Haiku 4.5), Framer Motion

**Spec:** `docs/superpowers/specs/2026-03-30-meta-ads-guided-evaluation-design.md`

**Verification:** `npm run build` + `npm run lint` + visual testing in browser.

---

## Task 1: Evaluation Types

**Purpose:** Define all TypeScript types for the guided evaluation system: step definitions, user responses, evaluation state, and API payloads. This is the foundation every subsequent task imports.

**Files to create:**
- `src/lib/workflows/evaluations/types.ts`

**Code:**

```typescript
// src/lib/workflows/evaluations/types.ts

import type { MonthPeriod } from "@/lib/schemas/types";

// ─── Step Definition Types ──────────────────────────────────────────────────

export type EvaluationStepCondition =
  | { type: "always" }
  | { type: "cpa-off-target" }
  | { type: "phase2-placeholder" };

export type EvaluationStepDef = {
  id: string;
  label: string;
  description: string;
  /** Main spine step number (1-6) or null for diagnostic sub-steps */
  spineStep: number | null;
  /** For diagnostic sub-steps: parent spine step id */
  parentStepId?: string;
  /** Display order within the full step sequence */
  order: number;
  /** When this step should be included in the evaluation */
  condition: EvaluationStepCondition;
  /** Threshold criteria for AI evaluation */
  thresholds?: Record<string, string>;
};

// ─── Runtime Types ──────────────────────────────────────────────────────────

export type UserDecision = "agree" | "override";

export type UserResponse = {
  decision: UserDecision;
  overrideReason?: string;
};

export type EvaluationActionItem = {
  id?: string;
  text: string;
  priority: "critical" | "high" | "medium";
  owner: "agency" | "director" | "joint";
  stepId: string;
};

export type StepStatus =
  | "pending"
  | "active"
  | "completed"
  | "skipped"
  | "error";

export type EvaluationStepState = {
  stepId: string;
  status: StepStatus;
  data?: Record<string, unknown>;
  aiEvaluation?: string;
  userResponse?: UserResponse;
  actionItems?: EvaluationActionItem[];
  error?: string;
};

// ─── API Request/Response Types ─────────────────────────────────────────────

export type StartEvaluationRequest = {
  period: MonthPeriod;
};

export type StartEvaluationResponse = {
  runId: string;
  currentStep: PreparedStep;
};

export type PreparedStep = {
  stepId: string;
  label: string;
  description: string;
  spineStep: number | null;
  parentStepId?: string;
  order: number;
  data: Record<string, unknown>;
  aiEvaluation: string;
  suggestedActions: EvaluationActionItem[];
  totalSteps: number;
  completedSteps: StepDecisionSummary[];
  /** Step IDs for all steps in the current evaluation (including skipped) */
  allStepIds: string[];
};

export type StepDecisionSummary = {
  stepId: string;
  label: string;
  decision: UserDecision;
  overrideReason?: string;
  actionItems: EvaluationActionItem[];
};

export type RespondRequest = {
  decision: UserDecision;
  overrideReason?: string;
  actionItems: EvaluationActionItem[];
};

export type RespondResponse =
  | { done: false; nextStep: PreparedStep }
  | { done: true; runId: string; summary: EvaluationSummary };

export type EvaluationSummary = {
  runId: string;
  period: MonthPeriod;
  completedSteps: StepDecisionSummary[];
  allActionItems: EvaluationActionItem[];
};

// ─── Resume Types ───────────────────────────────────────────────────────────

export type ResumeEvaluationResponse =
  | { status: "none" }
  | { status: "in-progress"; runId: string; currentStep: PreparedStep }
  | { status: "completed"; runId: string; summary: EvaluationSummary };

// ─── Campaign Frequency Row (for D1 weekly frequency fetch) ─────────────────

export type CampaignFrequencyRow = {
  campaign_id: string;
  campaign_name: string;
  frequency: number;
  impressions: number;
  reach: number;
  date_start: string;
  date_stop: string;
};
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add evaluation types for guided workflow system`

---

## Task 2: DB Schema Changes

**Purpose:** Add `userResponse` (jsonb) to `workflowStepRuns` and `owner` (varchar 20) to `actionItems`.

**Files to modify:**
- `src/db/schema.ts`

**Code changes to `src/db/schema.ts`:**

In the `workflowStepRuns` table, add after the `error` column:

```typescript
  userResponse: jsonb("user_response"),
```

In the `actionItems` table, add after the `category` column:

```typescript
  owner: varchar("owner", { length: 20 }),
```

The full modified `workflowStepRuns` table becomes:

```typescript
export const workflowStepRuns = pgTable("workflow_step_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => workflowRuns.id),
  stepId: varchar("step_id", { length: 50 }).notNull(),
  stepOrder: integer("step_order").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  aiOutput: text("ai_output"),
  error: text("error"),
  userResponse: jsonb("user_response"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});
```

The full modified `actionItems` table becomes:

```typescript
export const actionItems = pgTable("action_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => workflowRuns.id),
  stepId: varchar("step_id", { length: 50 }).notNull(),
  workflowSlug: varchar("workflow_slug", { length: 100 }).notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  text: text("text").notNull(),
  priority: varchar("priority", { length: 10 }),
  category: varchar("category", { length: 50 }),
  owner: varchar("owner", { length: 20 }),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});
```

After code change, generate and push the migration:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add userResponse and owner columns to DB schema`

---

## Task 3: Step Definitions

**Purpose:** Define all Phase 1 evaluation steps with their IDs, labels, conditions, ordering, and threshold metadata. Steps 2-5 are defined as phase2-placeholder condition types.

**Files to create:**
- `src/lib/workflows/evaluations/meta-ads-monthly.ts`

**Code:**

```typescript
// src/lib/workflows/evaluations/meta-ads-monthly.ts

import type { EvaluationStepDef } from "./types";

export const SLE_THRESHOLDS = {
  cpa_on_target: 9,
  cpa_elevated: 14,
  roas_floor: 3.0,
  frequency_fatigue: 3.0,
  cpm_mom_increase: 0.3,
  ctr_mom_decrease: 0.2,
  blended_cac_ceiling: 22,
  over_attribution: 1.3,
  gp_per_order: 35.23,
  gross_margin: 0.43,
  learning_budget_per_adset: 6000,
  monthly_budget: 6900,
} as const;

export const META_ADS_EVALUATION_STEPS: EvaluationStepDef[] = [
  // ─── Step 1: Decision Metrics ───────────────────────────────────────────────
  {
    id: "step1-decision-metrics",
    label: "Decision Metrics",
    description:
      "Check CPA, ROAS, and purchase volume against SLE thresholds. Determines whether to enter the CPA diagnostic sub-flow.",
    spineStep: 1,
    order: 0,
    condition: { type: "always" },
    thresholds: {
      cpa_on_target: `<$${SLE_THRESHOLDS.cpa_on_target} (3:1+ GP ratio after 1.3x over-attribution)`,
      cpa_elevated: `$${SLE_THRESHOLDS.cpa_on_target}-$${SLE_THRESHOLDS.cpa_elevated} (2:1 to 3:1 GP ratio)`,
      cpa_high: `>$${SLE_THRESHOLDS.cpa_elevated} (below 2:1, losing money)`,
      roas_floor: `${SLE_THRESHOLDS.roas_floor}x (GP breakeven after COGS + over-attribution)`,
      retargeting_vs_prospecting:
        "Retargeting CPA should be lower than prospecting CPA",
    },
  },

  // ─── CPA Diagnostic Sub-Flow (D1-D5) ───────────────────────────────────────
  {
    id: "d1-frequency",
    label: "D1: Frequency Check",
    description:
      "Check 7-day rolling frequency by campaign. >3.0 in 7 days = fatigue risk.",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 1,
    condition: { type: "cpa-off-target" },
    thresholds: {
      frequency_7day: `>${SLE_THRESHOLDS.frequency_fatigue} in 7 days = fatigue risk`,
      diagnosis:
        "People seeing the same ad too many times. Creative fatigue or audience too small.",
    },
  },
  {
    id: "d2-cpm-trend",
    label: "D2: CPM Trend",
    description:
      "Compare current month CPM vs prior month CPM by campaign. >30% increase MoM is a flag.",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 2,
    condition: { type: "cpa-off-target" },
    thresholds: {
      cpm_mom_increase: `>${SLE_THRESHOLDS.cpm_mom_increase * 100}% MoM increase`,
      diagnosis:
        "Auction getting more expensive. Audience saturated or seasonal competition.",
    },
  },
  {
    id: "d3-ctr-trend",
    label: "D3: CTR Trend",
    description:
      "Compare current month CTR vs prior month CTR by campaign. >20% decrease MoM is a flag.",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 3,
    condition: { type: "cpa-off-target" },
    thresholds: {
      ctr_mom_decrease: `>${SLE_THRESHOLDS.ctr_mom_decrease * 100}% MoM decrease`,
      diagnosis:
        "People ignoring the creative. Ad not grabbing attention or not relevant to audience.",
    },
  },
  {
    id: "d4-conversion-rate",
    label: "D4: Conversion Rate",
    description:
      "Check click volume vs purchase volume. Clicks stable or up but purchases down = landing page problem.",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 4,
    condition: { type: "cpa-off-target" },
    thresholds: {
      pattern:
        "Clicks stable or up + purchases down = not an ads problem (landing page, booking flow, pricing, or offer)",
    },
  },
  {
    id: "d5-pattern-match",
    label: "D5: Pattern Match",
    description:
      "Combine signals from D1-D4 into a root cause diagnosis with targeted action items.",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 5,
    condition: { type: "cpa-off-target" },
    thresholds: {
      creative_fatigue: "freq↑ + CTR↓ + CPA↑",
      audience_saturation: "CPM↑ + freq stable + CPA↑",
      landing_page_problem: "CTR stable + CVR↓ + CPA↑",
      growth_engine_broken:
        "Retargeting CPA good + prospecting CPA bad",
      attribution_inflation: "Meta purchases >> SLE bookings",
    },
  },

  // ─── Steps 2-5: Phase 2 Placeholders ─────────────────────────────────────
  {
    id: "step2-backend-verification",
    label: "Backend Verification",
    description:
      "Cross-reference Meta-reported purchases with actual SLE bookings, blended CAC, and MER.",
    spineStep: 2,
    order: 6,
    condition: { type: "phase2-placeholder" },
  },
  {
    id: "step3-campaign-structure",
    label: "Campaign Structure",
    description:
      "Evaluate active campaigns, budget distribution, spend concentration, and consolidation opportunities.",
    spineStep: 3,
    order: 7,
    condition: { type: "phase2-placeholder" },
  },
  {
    id: "step4-creative-health",
    label: "Creative Health",
    description:
      "Analyze ad-level performance, hook/hold rates, creative fatigue, and refresh needs.",
    spineStep: 4,
    order: 8,
    condition: { type: "phase2-placeholder" },
  },
  {
    id: "step5-audience-check",
    label: "Audience Check",
    description:
      "Review audience segment efficiency, geographic targeting, and demographic performance.",
    spineStep: 5,
    order: 9,
    condition: { type: "phase2-placeholder" },
  },

  // ─── Step 6: Action Items Summary ─────────────────────────────────────────
  {
    id: "step6-action-summary",
    label: "Action Items Summary",
    description:
      "Review and finalize all action items accumulated from the evaluation. Final edit pass before saving.",
    spineStep: 6,
    order: 10,
    condition: { type: "always" },
  },
];

/**
 * Given the CPA status from Step 1, determine which steps are active.
 * Returns the ordered list of step IDs for this evaluation run.
 */
export function resolveActiveSteps(
  cpaIsOffTarget: boolean,
): string[] {
  return META_ADS_EVALUATION_STEPS.filter((step) => {
    if (step.condition.type === "always") return true;
    if (step.condition.type === "cpa-off-target") return cpaIsOffTarget;
    if (step.condition.type === "phase2-placeholder") return false;
    return false;
  }).map((s) => s.id);
}

export function getStepDef(
  stepId: string,
): EvaluationStepDef | undefined {
  return META_ADS_EVALUATION_STEPS.find((s) => s.id === stepId);
}

export function getMainSpineSteps(): EvaluationStepDef[] {
  return META_ADS_EVALUATION_STEPS.filter((s) => s.spineStep !== null);
}

export function getDiagnosticSteps(): EvaluationStepDef[] {
  return META_ADS_EVALUATION_STEPS.filter(
    (s) => s.spineStep === null && s.condition.type === "cpa-off-target",
  );
}
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: define Phase 1 evaluation step definitions and thresholds`

---

## Task 4: Meta Ads Service — Weekly Frequency + Prior Month

**Purpose:** Add `getWeeklyFrequency()` method to the Meta Ads service for CPA diagnostic D1. Prior month insights already work by calling `getMonthlyInsights()` with a prior month period, so no new method is needed for D2/D3.

**Files to modify:**
- `src/lib/services/meta-ads.ts`

**Code to append at the end of `src/lib/services/meta-ads.ts`:**

```typescript
import type { CampaignFrequencyRow } from "@/lib/workflows/evaluations/types";

/**
 * Fetch 7-day rolling frequency by campaign for the last 7 days of the given month.
 * Used by CPA Diagnostic step D1 to check short-term frequency fatigue.
 */
export async function getWeeklyFrequency(
  period: MonthPeriod,
): Promise<CampaignFrequencyRow[]> {
  const lastDay = new Date(period.year, period.month, 0).getDate();
  const endDate = `${period.year}-${String(period.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Start 6 days before end to get a 7-day window
  const startObj = new Date(period.year, period.month - 1, lastDay - 6);
  const startDate = `${startObj.getFullYear()}-${String(startObj.getMonth() + 1).padStart(2, "0")}-${String(startObj.getDate()).padStart(2, "0")}`;

  const account = getAdAccount();

  const cursor = await account.getInsights(
    ["campaign_id", "campaign_name", "frequency", "impressions", "reach"],
    {
      time_range: { since: startDate, until: endDate },
      level: "campaign",
    },
  );

  const rows: CampaignFrequencyRow[] = [];

  for (;;) {
    for (const raw of cursor) {
      const row = raw as Record<string, unknown>;
      rows.push({
        campaign_id: String(row.campaign_id ?? ""),
        campaign_name: String(row.campaign_name ?? ""),
        frequency: Number(row.frequency ?? 0),
        impressions: Number(row.impressions ?? 0),
        reach: Number(row.reach ?? 0),
        date_start: startDate,
        date_stop: endDate,
      });
    }

    if (cursor.hasNext()) {
      await cursor.next();
    } else {
      break;
    }
  }

  return rows;
}
```

Note: The import for `CampaignFrequencyRow` needs to be added at the top of the file alongside the existing imports.

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add getWeeklyFrequency to Meta Ads service for 7-day frequency diagnostic`

---

## Task 5: Evaluation Engine

**Purpose:** Core orchestration logic for the guided evaluation. Handles: initializing a run, preparing step data + AI evaluation, handling user responses, determining the next step, and resuming in-progress runs.

**Files to create:**
- `src/lib/workflows/evaluation-engine.ts`

**Code:**

```typescript
// src/lib/workflows/evaluation-engine.ts

import { db } from "@/db";
import {
  workflowRuns,
  workflowStepRuns,
  actionItems,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import type { MonthPeriod } from "@/lib/schemas/types";
import type {
  PreparedStep,
  UserDecision,
  EvaluationActionItem,
  StepDecisionSummary,
  UserResponse,
  EvaluationSummary,
  RespondResponse,
  ResumeEvaluationResponse,
} from "./evaluations/types";
import {
  META_ADS_EVALUATION_STEPS,
  resolveActiveSteps,
  getStepDef,
  SLE_THRESHOLDS,
} from "./evaluations/meta-ads-monthly";
import { fetchMetaAds } from "./executors/fetch-meta-ads";
import {
  getMonthlyInsights,
  getWeeklyFrequency,
} from "@/lib/services/meta-ads";
import { getEvaluationPrompt } from "./prompts/meta-ads-evaluation";
import type { MetaAdsMetrics } from "@/lib/schemas/sources/meta-ads-metrics";

const anthropic = new Anthropic();

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPriorPeriod(period: MonthPeriod): MonthPeriod {
  if (period.month === 1) {
    return { year: period.year - 1, month: 12 };
  }
  return { year: period.year, month: period.month - 1 };
}

function isCpaOffTarget(metrics: MetaAdsMetrics): boolean {
  return (
    metrics.account_health.cpa_status === "elevated" ||
    metrics.account_health.cpa_status === "high"
  );
}

async function runAiEvaluation(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function parseAiActionItems(
  aiOutput: string,
  stepId: string,
): EvaluationActionItem[] {
  const items: EvaluationActionItem[] = [];
  const lines = aiOutput.split("\n");

  let currentText: string | null = null;
  let currentPriority: EvaluationActionItem["priority"] = "medium";
  let currentOwner: EvaluationActionItem["owner"] = "agency";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("ACTION:")) {
      if (currentText) {
        items.push({
          text: currentText,
          priority: currentPriority,
          owner: currentOwner,
          stepId,
        });
      }
      currentText = trimmed.slice(7).trim();
      currentPriority = "medium";
      currentOwner = "agency";
    } else if (trimmed.startsWith("PRIORITY:") && currentText) {
      const val = trimmed.slice(9).trim().toLowerCase();
      if (val === "critical" || val === "high" || val === "medium") {
        currentPriority = val;
      }
    } else if (trimmed.startsWith("OWNER:") && currentText) {
      const val = trimmed.slice(6).trim().toLowerCase();
      if (val === "agency" || val === "director" || val === "joint") {
        currentOwner = val;
      }
    }
  }

  if (currentText) {
    items.push({
      text: currentText,
      priority: currentPriority,
      owner: currentOwner,
      stepId,
    });
  }

  return items;
}

/** Build a context string from completed step decisions for AI prompt context. */
function buildPriorDecisionsContext(
  decisions: StepDecisionSummary[],
): string {
  if (decisions.length === 0) return "";

  const parts = decisions.map((d) => {
    let text = `- ${d.label}: ${d.decision.toUpperCase()}`;
    if (d.overrideReason) {
      text += ` (override reason: "${d.overrideReason}")`;
    }
    if (d.actionItems.length > 0) {
      text +=
        "\n  Action items: " +
        d.actionItems.map((a) => a.text).join("; ");
    }
    return text;
  });

  return "## Prior Step Decisions\n\n" + parts.join("\n");
}

// ─── Data Preparation ───────────────────────────────────────────────────────

/**
 * Cached data store for a single evaluation run.
 * Avoids re-fetching the same data across steps within a single request.
 */
type RunDataCache = {
  metrics: MetaAdsMetrics;
  priorMonthCampaigns?: Awaited<ReturnType<typeof getMonthlyInsights>>;
  weeklyFrequency?: Awaited<ReturnType<typeof getWeeklyFrequency>>;
};

const runDataCaches = new Map<string, RunDataCache>();

async function getOrFetchMetrics(
  runId: string,
  period: MonthPeriod,
): Promise<MetaAdsMetrics> {
  const cached = runDataCaches.get(runId);
  if (cached) return cached.metrics;

  const metrics = await fetchMetaAds(period);
  runDataCaches.set(runId, { metrics });
  return metrics;
}

async function getOrFetchPriorMonth(
  runId: string,
  period: MonthPeriod,
) {
  const cached = runDataCaches.get(runId);
  if (cached?.priorMonthCampaigns) return cached.priorMonthCampaigns;

  const priorPeriod = getPriorPeriod(period);
  const priorCampaigns = await getMonthlyInsights(priorPeriod);

  if (cached) {
    cached.priorMonthCampaigns = priorCampaigns;
  }

  return priorCampaigns;
}

async function getOrFetchWeeklyFrequency(
  runId: string,
  period: MonthPeriod,
) {
  const cached = runDataCaches.get(runId);
  if (cached?.weeklyFrequency) return cached.weeklyFrequency;

  const freq = await getWeeklyFrequency(period);

  if (cached) {
    cached.weeklyFrequency = freq;
  }

  return freq;
}

async function prepareStepData(
  stepId: string,
  runId: string,
  period: MonthPeriod,
): Promise<Record<string, unknown>> {
  const metrics = await getOrFetchMetrics(runId, period);

  switch (stepId) {
    case "step1-decision-metrics": {
      const tofCampaigns = metrics.campaigns.filter(
        (c) => c.funnel_stage === "tof",
      );
      const rtCampaigns = metrics.campaigns.filter(
        (c) => c.funnel_stage === "retargeting",
      );
      const tofSpend = tofCampaigns.reduce((s, c) => s + c.spend, 0);
      const tofPurchases = tofCampaigns.reduce(
        (s, c) => s + c.purchases,
        0,
      );
      const rtSpend = rtCampaigns.reduce((s, c) => s + c.spend, 0);
      const rtPurchases = rtCampaigns.reduce(
        (s, c) => s + c.purchases,
        0,
      );

      return {
        account_health: metrics.account_health,
        prospecting: {
          spend: tofSpend,
          purchases: tofPurchases,
          cpa: tofPurchases > 0 ? tofSpend / tofPurchases : 0,
          campaign_count: tofCampaigns.length,
        },
        retargeting: {
          spend: rtSpend,
          purchases: rtPurchases,
          cpa: rtPurchases > 0 ? rtSpend / rtPurchases : 0,
          campaign_count: rtCampaigns.length,
        },
        period: metrics.period,
        thresholds: {
          cpa_on_target: SLE_THRESHOLDS.cpa_on_target,
          cpa_elevated: SLE_THRESHOLDS.cpa_elevated,
          roas_floor: SLE_THRESHOLDS.roas_floor,
        },
      };
    }

    case "d1-frequency": {
      const weeklyFreq = await getOrFetchWeeklyFrequency(runId, period);
      return {
        weekly_frequency: weeklyFreq,
        threshold: SLE_THRESHOLDS.frequency_fatigue,
        period: metrics.period,
      };
    }

    case "d2-cpm-trend": {
      const priorCampaigns = await getOrFetchPriorMonth(runId, period);
      const currentCampaigns = metrics.campaigns;

      const cpmComparisons = currentCampaigns.map((curr) => {
        const prior = priorCampaigns.find(
          (p) => p.campaign_id === curr.campaign_id,
        );
        const priorCpm = prior ? Number(prior.cpm ?? 0) : null;
        const change =
          priorCpm && priorCpm > 0
            ? (curr.cpm - priorCpm) / priorCpm
            : null;
        return {
          campaign_id: curr.campaign_id,
          campaign_name: curr.campaign_name,
          current_cpm: curr.cpm,
          prior_cpm: priorCpm,
          change_pct: change,
          flagged:
            change !== null && change > SLE_THRESHOLDS.cpm_mom_increase,
        };
      });

      return {
        cpm_comparisons: cpmComparisons,
        threshold_pct: SLE_THRESHOLDS.cpm_mom_increase * 100,
        period: metrics.period,
      };
    }

    case "d3-ctr-trend": {
      const priorCampaigns = await getOrFetchPriorMonth(runId, period);
      const currentCampaigns = metrics.campaigns;

      const ctrComparisons = currentCampaigns.map((curr) => {
        const prior = priorCampaigns.find(
          (p) => p.campaign_id === curr.campaign_id,
        );
        const priorCtr = prior ? Number(prior.ctr ?? 0) : null;
        const change =
          priorCtr && priorCtr > 0
            ? (curr.ctr - priorCtr) / priorCtr
            : null;
        return {
          campaign_id: curr.campaign_id,
          campaign_name: curr.campaign_name,
          current_ctr: curr.ctr,
          prior_ctr: priorCtr,
          change_pct: change,
          flagged:
            change !== null &&
            change < -SLE_THRESHOLDS.ctr_mom_decrease,
        };
      });

      return {
        ctr_comparisons: ctrComparisons,
        threshold_pct: SLE_THRESHOLDS.ctr_mom_decrease * 100,
        period: metrics.period,
      };
    }

    case "d4-conversion-rate": {
      return {
        account_clicks: metrics.account_health.total_clicks,
        account_purchases: metrics.account_health.total_purchases,
        account_spend: metrics.account_health.total_spend,
        conversion_rate:
          metrics.account_health.total_clicks > 0
            ? metrics.account_health.total_purchases /
              metrics.account_health.total_clicks
            : 0,
        campaigns: metrics.campaigns.map((c) => ({
          campaign_name: c.campaign_name,
          clicks: c.clicks,
          purchases: c.purchases,
          conversion_rate:
            c.clicks > 0 ? c.purchases / c.clicks : 0,
        })),
        period: metrics.period,
      };
    }

    case "d5-pattern-match": {
      // Aggregate signals from D1-D4 data (re-fetch from cache)
      const weeklyFreq = await getOrFetchWeeklyFrequency(runId, period);
      const priorCampaigns = await getOrFetchPriorMonth(runId, period);
      const currentCampaigns = metrics.campaigns;

      const avgFrequency7d =
        weeklyFreq.length > 0
          ? weeklyFreq.reduce((s, r) => s + r.frequency, 0) /
            weeklyFreq.length
          : 0;

      const avgCurrentCpm =
        currentCampaigns.length > 0
          ? currentCampaigns.reduce((s, c) => s + c.cpm, 0) /
            currentCampaigns.length
          : 0;

      const matchedPrior = priorCampaigns.filter((p) =>
        currentCampaigns.some((c) => c.campaign_id === p.campaign_id),
      );
      const avgPriorCpm =
        matchedPrior.length > 0
          ? matchedPrior.reduce((s, p) => s + Number(p.cpm ?? 0), 0) /
            matchedPrior.length
          : 0;

      const avgCurrentCtr =
        currentCampaigns.length > 0
          ? currentCampaigns.reduce((s, c) => s + c.ctr, 0) /
            currentCampaigns.length
          : 0;
      const avgPriorCtr =
        matchedPrior.length > 0
          ? matchedPrior.reduce((s, p) => s + Number(p.ctr ?? 0), 0) /
            matchedPrior.length
          : 0;

      const cvr =
        metrics.account_health.total_clicks > 0
          ? metrics.account_health.total_purchases /
            metrics.account_health.total_clicks
          : 0;

      const tofCampaigns = currentCampaigns.filter(
        (c) => c.funnel_stage === "tof",
      );
      const rtCampaigns = currentCampaigns.filter(
        (c) => c.funnel_stage === "retargeting",
      );
      const tofCpa =
        tofCampaigns.reduce((s, c) => s + c.purchases, 0) > 0
          ? tofCampaigns.reduce((s, c) => s + c.spend, 0) /
            tofCampaigns.reduce((s, c) => s + c.purchases, 0)
          : 0;
      const rtCpa =
        rtCampaigns.reduce((s, c) => s + c.purchases, 0) > 0
          ? rtCampaigns.reduce((s, c) => s + c.spend, 0) /
            rtCampaigns.reduce((s, c) => s + c.purchases, 0)
          : 0;

      return {
        signals: {
          frequency_7d: avgFrequency7d,
          frequency_flagged:
            avgFrequency7d > SLE_THRESHOLDS.frequency_fatigue,
          cpm_current: avgCurrentCpm,
          cpm_prior: avgPriorCpm,
          cpm_change_pct:
            avgPriorCpm > 0
              ? (avgCurrentCpm - avgPriorCpm) / avgPriorCpm
              : null,
          cpm_flagged:
            avgPriorCpm > 0 &&
            (avgCurrentCpm - avgPriorCpm) / avgPriorCpm >
              SLE_THRESHOLDS.cpm_mom_increase,
          ctr_current: avgCurrentCtr,
          ctr_prior: avgPriorCtr,
          ctr_change_pct:
            avgPriorCtr > 0
              ? (avgCurrentCtr - avgPriorCtr) / avgPriorCtr
              : null,
          ctr_flagged:
            avgPriorCtr > 0 &&
            (avgCurrentCtr - avgPriorCtr) / avgPriorCtr <
              -SLE_THRESHOLDS.ctr_mom_decrease,
          conversion_rate: cvr,
          prospecting_cpa: tofCpa,
          retargeting_cpa: rtCpa,
        },
        account_health: metrics.account_health,
        period: metrics.period,
      };
    }

    case "step6-action-summary": {
      return {
        period: metrics.period,
        account_health: metrics.account_health,
      };
    }

    default:
      return {};
  }
}

// ─── Step Preparation (data + AI) ───────────────────────────────────────────

async function prepareStep(
  stepId: string,
  runId: string,
  period: MonthPeriod,
  completedDecisions: StepDecisionSummary[],
  allActiveStepIds: string[],
): Promise<PreparedStep> {
  const stepDef = getStepDef(stepId);
  if (!stepDef) throw new Error(`Unknown step: ${stepId}`);

  const data = await prepareStepData(stepId, runId, period);

  let aiEvaluation = "";
  let suggestedActions: EvaluationActionItem[] = [];

  // Step 6 (action summary) does not need AI evaluation
  if (stepId !== "step6-action-summary") {
    const systemPrompt = getEvaluationPrompt(stepId);
    const priorContext = buildPriorDecisionsContext(completedDecisions);

    const userMessage = [
      `Evaluate for period ${period.year}-${String(period.month).padStart(2, "0")}.`,
      "",
      "## Step Data",
      JSON.stringify(data, null, 2),
      "",
      priorContext,
    ].join("\n");

    aiEvaluation = await runAiEvaluation(systemPrompt, userMessage);
    suggestedActions = parseAiActionItems(aiEvaluation, stepId);
  }

  return {
    stepId,
    label: stepDef.label,
    description: stepDef.description,
    spineStep: stepDef.spineStep,
    parentStepId: stepDef.parentStepId,
    order: stepDef.order,
    data,
    aiEvaluation,
    suggestedActions,
    totalSteps: allActiveStepIds.length,
    completedSteps: completedDecisions,
    allStepIds: allActiveStepIds,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize a guided evaluation run. Creates DB records, fetches initial data,
 * prepares Step 1, and returns synchronously.
 */
export async function initEvaluationRun(
  slug: string,
  period: MonthPeriod,
): Promise<{ runId: string; currentStep: PreparedStep }> {
  // Check for existing in-progress run
  const existingRuns = await db
    .select()
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.workflowSlug, slug),
        eq(workflowRuns.periodYear, period.year),
        eq(workflowRuns.periodMonth, period.month),
        eq(workflowRuns.status, "running"),
      ),
    )
    .limit(1);

  if (existingRuns.length > 0) {
    // Resume existing run
    const resumeResult = await resumeEvaluationRun(
      existingRuns[0].id,
      slug,
      period,
    );
    if (resumeResult.status === "in-progress") {
      return {
        runId: existingRuns[0].id,
        currentStep: resumeResult.currentStep,
      };
    }
    // If completed, fall through to create new run
  }

  // Create run record
  const [run] = await db
    .insert(workflowRuns)
    .values({
      workflowSlug: slug,
      periodYear: period.year,
      periodMonth: period.month,
      status: "running",
    })
    .returning();

  const runId = run.id;

  // Fetch initial data to determine CPA status (needed for branching)
  const metrics = await getOrFetchMetrics(runId, period);
  const cpaOffTarget = isCpaOffTarget(metrics);
  const activeStepIds = resolveActiveSteps(cpaOffTarget);

  // Create step run records for all active steps
  const stepInserts = activeStepIds.map((stepId, i) => ({
    runId,
    stepId,
    stepOrder: i,
    status: "pending" as const,
  }));

  await db.insert(workflowStepRuns).values(stepInserts);

  // Prepare Step 1
  const firstStepId = activeStepIds[0];
  const currentStep = await prepareStep(
    firstStepId,
    runId,
    period,
    [],
    activeStepIds,
  );

  // Mark Step 1 as active
  await db
    .update(workflowStepRuns)
    .set({ status: "running", startedAt: new Date(), outputData: currentStep.data as Record<string, unknown>, aiOutput: currentStep.aiEvaluation })
    .where(
      and(
        eq(workflowStepRuns.runId, runId),
        eq(workflowStepRuns.stepId, firstStepId),
      ),
    );

  return { runId, currentStep };
}

/**
 * Handle user response for a step. Records decision and action items,
 * prepares next step, returns it.
 */
export async function handleStepResponse(
  runId: string,
  stepId: string,
  slug: string,
  period: MonthPeriod,
  decision: UserDecision,
  overrideReason: string | undefined,
  submittedActionItems: EvaluationActionItem[],
): Promise<RespondResponse> {
  // 1. Record the user response on the step
  const userResponse: UserResponse = { decision };
  if (overrideReason) {
    userResponse.overrideReason = overrideReason;
  }

  await db
    .update(workflowStepRuns)
    .set({
      status: "completed",
      completedAt: new Date(),
      userResponse: userResponse as unknown as Record<string, unknown>,
    })
    .where(
      and(
        eq(workflowStepRuns.runId, runId),
        eq(workflowStepRuns.stepId, stepId),
      ),
    );

  // 2. Save action items to DB
  if (submittedActionItems.length > 0) {
    await db.insert(actionItems).values(
      submittedActionItems.map((item) => ({
        runId,
        stepId,
        workflowSlug: slug,
        periodYear: period.year,
        periodMonth: period.month,
        text: item.text,
        priority: item.priority,
        category: item.owner,
        owner: item.owner,
      })),
    );
  }

  // 3. Determine next step
  const stepRows = await db
    .select()
    .from(workflowStepRuns)
    .where(eq(workflowStepRuns.runId, runId))
    .orderBy(workflowStepRuns.stepOrder);

  const allStepIds = stepRows.map((s) => s.stepId);
  const currentIndex = allStepIds.indexOf(stepId);
  const nextIndex = currentIndex + 1;

  // Build completed decisions from all completed steps
  const completedDecisions = await buildCompletedDecisions(runId);

  if (nextIndex >= allStepIds.length) {
    // Evaluation complete
    await db
      .update(workflowRuns)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(workflowRuns.id, runId));

    // Clean up cache
    runDataCaches.delete(runId);

    const allItems = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.runId, runId));

    return {
      done: true,
      runId,
      summary: {
        runId,
        period,
        completedSteps: completedDecisions,
        allActionItems: allItems.map((item) => ({
          id: item.id,
          text: item.text,
          priority: (item.priority as EvaluationActionItem["priority"]) ?? "medium",
          owner: (item.owner as EvaluationActionItem["owner"]) ?? "agency",
          stepId: item.stepId,
        })),
      },
    };
  }

  // Prepare next step
  const nextStepId = allStepIds[nextIndex];
  const nextStep = await prepareStep(
    nextStepId,
    runId,
    period,
    completedDecisions,
    allStepIds,
  );

  // Mark next step as active in DB
  await db
    .update(workflowStepRuns)
    .set({ status: "running", startedAt: new Date(), outputData: nextStep.data as Record<string, unknown>, aiOutput: nextStep.aiEvaluation })
    .where(
      and(
        eq(workflowStepRuns.runId, runId),
        eq(workflowStepRuns.stepId, nextStepId),
      ),
    );

  return { done: false, nextStep };
}

/**
 * Resume an in-progress evaluation run. Reconstructs state from DB.
 */
export async function resumeEvaluationRun(
  runId: string,
  slug: string,
  period: MonthPeriod,
): Promise<ResumeEvaluationResponse> {
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId))
    .limit(1);

  if (!run) return { status: "none" };

  if (run.status === "completed") {
    const completedDecisions = await buildCompletedDecisions(runId);
    const allItems = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.runId, runId));

    return {
      status: "completed",
      runId,
      summary: {
        runId,
        period: { year: run.periodYear, month: run.periodMonth },
        completedSteps: completedDecisions,
        allActionItems: allItems.map((item) => ({
          id: item.id,
          text: item.text,
          priority: (item.priority as EvaluationActionItem["priority"]) ?? "medium",
          owner: (item.owner as EvaluationActionItem["owner"]) ?? "agency",
          stepId: item.stepId,
        })),
      },
    };
  }

  // Find the current (running or first pending) step
  const stepRows = await db
    .select()
    .from(workflowStepRuns)
    .where(eq(workflowStepRuns.runId, runId))
    .orderBy(workflowStepRuns.stepOrder);

  const currentStepRow =
    stepRows.find((s) => s.status === "running") ??
    stepRows.find((s) => s.status === "pending");

  if (!currentStepRow) return { status: "none" };

  const allStepIds = stepRows.map((s) => s.stepId);
  const completedDecisions = await buildCompletedDecisions(runId);

  // Re-prepare the current step
  const currentStep = await prepareStep(
    currentStepRow.stepId,
    runId,
    period,
    completedDecisions,
    allStepIds,
  );

  return { status: "in-progress", runId, currentStep };
}

/**
 * Build completed decision summaries from the DB for a run.
 */
async function buildCompletedDecisions(
  runId: string,
): Promise<StepDecisionSummary[]> {
  const stepRows = await db
    .select()
    .from(workflowStepRuns)
    .where(
      and(
        eq(workflowStepRuns.runId, runId),
        eq(workflowStepRuns.status, "completed"),
      ),
    )
    .orderBy(workflowStepRuns.stepOrder);

  const items = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.runId, runId));

  return stepRows
    .filter((s) => s.userResponse)
    .map((s) => {
      const response = s.userResponse as unknown as UserResponse;
      const stepDef = getStepDef(s.stepId);
      const stepItems = items
        .filter((item) => item.stepId === s.stepId)
        .map((item) => ({
          id: item.id,
          text: item.text,
          priority: (item.priority as EvaluationActionItem["priority"]) ?? "medium",
          owner: (item.owner as EvaluationActionItem["owner"]) ?? "agency",
          stepId: item.stepId,
        }));

      return {
        stepId: s.stepId,
        label: stepDef?.label ?? s.stepId,
        decision: response.decision,
        overrideReason: response.overrideReason,
        actionItems: stepItems,
      };
    });
}

/**
 * Retry a failed step. Re-prepares its data and AI evaluation.
 */
export async function retryStep(
  runId: string,
  stepId: string,
  slug: string,
  period: MonthPeriod,
): Promise<PreparedStep> {
  const stepRows = await db
    .select()
    .from(workflowStepRuns)
    .where(eq(workflowStepRuns.runId, runId))
    .orderBy(workflowStepRuns.stepOrder);

  const allStepIds = stepRows.map((s) => s.stepId);
  const completedDecisions = await buildCompletedDecisions(runId);

  // Reset step status
  await db
    .update(workflowStepRuns)
    .set({ status: "running", error: null, startedAt: new Date() })
    .where(
      and(
        eq(workflowStepRuns.runId, runId),
        eq(workflowStepRuns.stepId, stepId),
      ),
    );

  const step = await prepareStep(
    stepId,
    runId,
    period,
    completedDecisions,
    allStepIds,
  );

  // Update step with new data
  await db
    .update(workflowStepRuns)
    .set({ outputData: step.data as Record<string, unknown>, aiOutput: step.aiEvaluation })
    .where(
      and(
        eq(workflowStepRuns.runId, runId),
        eq(workflowStepRuns.stepId, stepId),
      ),
    );

  return step;
}
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add evaluation engine for guided workflow orchestration`

---

## Task 6: AI Prompts

**Purpose:** Per-step system prompts for Haiku 4.5 AI evaluation. Each prompt is focused on its step's specific evaluation criteria and expected output format.

**Files to create:**
- `src/lib/workflows/prompts/meta-ads-evaluation.ts`

**Files to modify:**
- `src/lib/workflows/prompts/index.ts` (add import, but not strictly needed since evaluation engine calls `getEvaluationPrompt` directly)

**Code for `src/lib/workflows/prompts/meta-ads-evaluation.ts`:**

```typescript
// src/lib/workflows/prompts/meta-ads-evaluation.ts

const evaluationPrompts: Record<string, string> = {
  "step1-decision-metrics": `You are evaluating Meta Ads decision metrics for Salt Lake Express (SLE), a bus transportation company.

## Your Task
Assess the three CTC decision metrics: CPA, ROAS, and purchase volume. Determine if CPA is on-target, elevated, or high.

## SLE Unit Economics
- GP per order: $35.23 (regular routes, 43% margin on $82 avg order)
- Meta over-attribution: 1.3x (true CPA ≈ Meta CPA × 1.3)
- Max Meta CPA for 3:1 GP ratio: $9
- Max Meta CPA for 2:1 GP ratio: $14
- ROAS breakeven: 3.0x

## Thresholds
- CPA <$9: ON-TARGET (healthy, scaling opportunity)
- CPA $9-$14: ELEVATED (watch closely, investigate diagnostics)
- CPA >$14: HIGH (losing money, immediate action needed)
- ROAS: ≥3.0x above breakeven, <3.0x below breakeven
- Retargeting CPA should be LOWER than prospecting CPA

## Output Format
Start with a status assessment: ON-TARGET, ELEVATED, or HIGH.

Provide a brief evaluation (3-5 sentences) covering:
1. Account CPA with status
2. ROAS relative to 3.0x floor
3. Prospecting CPA vs retargeting CPA comparison
4. Purchase volume observation

Then provide action items if CPA is elevated or high:

ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]

If CPA is on-target, suggest 1-2 scaling or testing opportunities instead.`,

  "d1-frequency": `You are diagnosing potential frequency fatigue for Salt Lake Express Meta Ads campaigns.

## Context
CPA has been flagged as elevated or high. You are checking if high ad frequency is a contributing factor.

## Threshold
7-day frequency >3.0 = fatigue risk. Regional markets (like bus transportation) have smaller audiences, so fatigue hits faster than national brands.

## What High Frequency Means
People are seeing the same ad too many times. This causes creative fatigue (they ignore it) or indicates the audience is too small (same people keep being served).

## Output Format
Assess each campaign's 7-day frequency. Flag any above 3.0.

Provide a brief diagnosis (2-3 sentences).

If frequency issues found, provide action items:
ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]`,

  "d2-cpm-trend": `You are diagnosing CPM trends for Salt Lake Express Meta Ads campaigns.

## Context
CPA has been flagged as elevated or high. You are checking if rising auction costs (CPM) are a contributing factor.

## Threshold
CPM increase >30% MoM = flagged. This means the cost to reach people is rising significantly.

## What Rising CPM Means
The auction is getting more expensive. Possible causes: audience saturation (Meta has shown your ads to everyone reachable), seasonal competition (other advertisers bidding more), or audience overlap between campaigns.

## Output Format
Compare current vs prior month CPM for each campaign. Flag any with >30% increase.

Provide a brief diagnosis (2-3 sentences).

If CPM issues found, provide action items:
ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]`,

  "d3-ctr-trend": `You are diagnosing CTR trends for Salt Lake Express Meta Ads campaigns.

## Context
CPA has been flagged as elevated or high. You are checking if declining click-through rates are a contributing factor.

## Threshold
CTR decrease >20% MoM = flagged. This means fewer people are clicking your ads relative to impressions.

## What Declining CTR Means
People are ignoring the creative. The ad is not grabbing attention or is no longer relevant to the audience. This is a strong signal of creative fatigue.

## Output Format
Compare current vs prior month CTR for each campaign. Flag any with >20% decrease.

Provide a brief diagnosis (2-3 sentences).

If CTR issues found, provide action items:
ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]`,

  "d4-conversion-rate": `You are diagnosing conversion rate for Salt Lake Express Meta Ads campaigns.

## Context
CPA has been flagged as elevated or high. You are checking if the problem is with ad delivery (getting clicks) or with conversion (turning clicks into purchases).

## Key Distinction
If clicks are stable or up but purchases are down, the problem is NOT the ads. The issue is downstream: landing page, booking flow, pricing, or offer. This is critical because the fix is completely different from an ads problem.

## Output Format
Report click volume, purchase volume, and conversion rate (purchases/clicks).

Assess whether the pattern suggests an ads problem or a downstream problem.

Provide a brief diagnosis (2-3 sentences).

If conversion rate issues found, provide action items:
ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]`,

  "d5-pattern-match": `You are performing a root cause diagnosis for Salt Lake Express Meta Ads CPA issues by combining signals from the diagnostic sub-flow.

## Signal Patterns
Match the observed signals to these known patterns:

1. **Creative Fatigue**: frequency↑ + CTR↓ + CPA↑
   → Audience has seen ads too many times, ignoring them
   → Fix: New creative, rotate ads, expand audience

2. **Audience Saturation**: CPM↑ + frequency stable + CPA↑
   → Reached everyone in the audience, auction costs rising
   → Fix: Expand audiences, new lookalikes, broader targeting

3. **Landing Page Problem**: CTR stable + CVR↓ + CPA↑
   → Ads are working (people click) but they don't convert
   → Fix: Landing page optimization, booking flow review, offer testing

4. **Growth Engine Broken**: Retargeting CPA good + Prospecting CPA bad
   → Only converting warm audiences, not acquiring new customers
   → Fix: Prospecting creative refresh, new audience testing, budget rebalance

5. **Attribution Inflation**: Meta purchases >> actual SLE bookings
   → Meta taking credit for organic conversions
   → Fix: CAPI audit, attribution window review, incrementality test

## Output Format
State which pattern(s) best match the observed signals. Explain the reasoning.

Provide 3-5 targeted action items based on the diagnosed root cause:
ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]`,
};

export function getEvaluationPrompt(stepId: string): string {
  const prompt = evaluationPrompts[stepId];
  if (!prompt) {
    return `You are evaluating Meta Ads performance for Salt Lake Express. Analyze the provided data and suggest action items.\n\nACTION: [recommendation]\nPRIORITY: [CRITICAL/HIGH/MEDIUM]\nOWNER: [AGENCY/DIRECTOR/JOINT]`;
  }
  return prompt;
}
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add per-step AI evaluation prompts for Meta Ads guided evaluation`

---

## Task 7: Workflow Registration

**Purpose:** Add `workflowType` to the `Workflow` interface and register the `meta-ads-evaluation` workflow.

**Files to modify:**
- `src/lib/workflows.ts`

**Code changes:**

1. Add `workflowType` to the `Workflow` interface:

```typescript
export interface Workflow {
  slug: string;
  title: string;
  description: string;
  icon: string;
  status: "coming-soon" | "active";
  cadence: WorkflowCadence;
  dataSources: DataSource[];
  workflowType?: "linear" | "guided-evaluation";
  steps: WorkflowStepDef[];
}
```

2. Add the new workflow to the `workflows` array. Insert it after `meta-ads-analysis` (index 4) so related workflows are adjacent:

```typescript
  {
    slug: "meta-ads-evaluation",
    title: "Meta Ads Monthly Evaluation",
    description:
      "Interactive step-by-step evaluation of Meta Ads performance using the CTC framework. AI evaluates each metric against thresholds, you confirm or override, and build action items as you go.",
    icon: "clipboard-check",
    status: "active",
    cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 10 } },
    dataSources: ["meta_ads"],
    workflowType: "guided-evaluation",
    steps: [],
  },
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: register meta-ads-evaluation workflow with guided-evaluation type`

---

## Task 8: Run Route Dispatch

**Purpose:** Modify the existing `/api/workflows/[slug]/run` route to detect `workflowType` and dispatch guided evaluations synchronously (returning `{ runId, currentStep }` instead of kicking off background execution).

**Files to modify:**
- `src/app/api/workflows/[slug]/run/route.ts`

**Full replacement code for `src/app/api/workflows/[slug]/run/route.ts`:**

```typescript
import { NextResponse, after } from "next/server";
import { initWorkflowRun, executeWorkflowSteps } from "@/lib/workflows/engine";
import { initEvaluationRun } from "@/lib/workflows/evaluation-engine";
import { getWorkflowBySlug } from "@/lib/workflows";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RunParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: RunParams) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { period } = body;

    if (
      !period ||
      typeof period.year !== "number" ||
      typeof period.month !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid period. Provide { year: number, month: number }" },
        { status: 400 },
      );
    }

    const workflow = getWorkflowBySlug(slug);
    if (!workflow) {
      return NextResponse.json(
        { error: `Workflow not found: ${slug}` },
        { status: 404 },
      );
    }

    // Dispatch based on workflow type
    if (workflow.workflowType === "guided-evaluation") {
      // Synchronous: fetch data, prepare Step 1, return immediately
      const result = await initEvaluationRun(slug, period);
      return NextResponse.json(result);
    }

    // Linear workflow: existing behavior (background execution)
    const { runId } = await initWorkflowRun(slug, period);

    after(async () => {
      try {
        await executeWorkflowSteps(runId, slug, period);
      } catch (err) {
        console.error("Background workflow execution error:", err);
      }
    });

    return NextResponse.json({ id: runId, status: "running" });
  } catch (err) {
    console.error("Workflow init error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start workflow" },
      { status: 500 },
    );
  }
}
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: dispatch guided-evaluation workflows synchronously from run route`

---

## Task 9: Step Respond API Route

**Purpose:** Create the endpoint for user decisions at each evaluation step. POST `/api/workflows/[slug]/runs/[runId]/steps/[stepId]/respond`.

**Files to create:**
- `src/app/api/workflows/[slug]/runs/[runId]/steps/[stepId]/respond/route.ts`

**Code:**

```typescript
// src/app/api/workflows/[slug]/runs/[runId]/steps/[stepId]/respond/route.ts

import { NextResponse } from "next/server";
import { handleStepResponse, retryStep } from "@/lib/workflows/evaluation-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RespondParams {
  params: Promise<{ slug: string; runId: string; stepId: string }>;
}

export async function POST(request: Request, { params }: RespondParams) {
  try {
    const { slug, runId, stepId } = await params;
    const body = await request.json();
    const { decision, overrideReason, actionItems, period, retry } = body;

    // Retry mode: re-prepare a failed step
    if (retry === true) {
      if (!period || typeof period.year !== "number" || typeof period.month !== "number") {
        return NextResponse.json(
          { error: "Period required for retry" },
          { status: 400 },
        );
      }

      const step = await retryStep(runId, stepId, slug, period);
      return NextResponse.json({ step });
    }

    // Normal response mode
    if (!decision || (decision !== "agree" && decision !== "override")) {
      return NextResponse.json(
        { error: "decision must be 'agree' or 'override'" },
        { status: 400 },
      );
    }

    if (decision === "override" && !overrideReason) {
      return NextResponse.json(
        { error: "overrideReason required when decision is 'override'" },
        { status: 400 },
      );
    }

    if (!period || typeof period.year !== "number" || typeof period.month !== "number") {
      return NextResponse.json(
        { error: "period is required" },
        { status: 400 },
      );
    }

    const result = await handleStepResponse(
      runId,
      stepId,
      slug,
      period,
      decision,
      overrideReason,
      Array.isArray(actionItems) ? actionItems : [],
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("Step respond error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to process step response",
      },
      { status: 500 },
    );
  }
}
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add step respond API endpoint for evaluation user decisions`

---

## Task 10: Evaluation Wizard UI

**Purpose:** Main container component that manages wizard state: progress bar, current step display, navigation between steps, loading states, and API calls. This is the top-level orchestrator for the evaluation UI.

**Files to create:**
- `src/components/workflows/evaluation-wizard.tsx`

**Code:**

```typescript
// src/components/workflows/evaluation-wizard.tsx

"use client";

import { useState, useCallback } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PeriodSelector } from "@/components/workflows/period-selector";
import { EvaluationStep } from "@/components/workflows/evaluation-step";
import { ActionSummaryView } from "@/components/workflows/steps/action-summary";
import type { Workflow } from "@/lib/workflows";
import type {
  PreparedStep,
  EvaluationActionItem,
  UserDecision,
  EvaluationSummary,
} from "@/lib/workflows/evaluations/types";
import { formatCadence, getCurrentDuePeriod } from "@/lib/workflows/cadence";
import {
  getMainSpineSteps,
  getDiagnosticSteps,
} from "@/lib/workflows/evaluations/meta-ads-monthly";

type WizardState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "step"; runId: string; currentStep: PreparedStep }
  | { phase: "summary"; runId: string; summary: EvaluationSummary }
  | { phase: "error"; message: string };

interface EvaluationWizardProps {
  workflow: Workflow;
}

export function EvaluationWizard({ workflow }: EvaluationWizardProps) {
  const duePeriod = getCurrentDuePeriod(workflow);
  const now = new Date();
  const [year, setYear] = useState(duePeriod?.year ?? now.getFullYear());
  const [month, setMonth] = useState(duePeriod?.month ?? now.getMonth() + 1);
  const [state, setState] = useState<WizardState>({ phase: "idle" });

  const period = { year, month };

  const startEvaluation = useCallback(async () => {
    setState({ phase: "loading" });

    try {
      const res = await fetch(`/api/workflows/${workflow.slug}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });

      if (!res.ok) {
        const data = await res.json();
        setState({ phase: "error", message: data.error ?? "Failed to start evaluation" });
        return;
      }

      const data = await res.json();

      if (data.currentStep) {
        setState({
          phase: "step",
          runId: data.runId,
          currentStep: data.currentStep,
        });
      } else {
        setState({ phase: "error", message: "Unexpected response from server" });
      }
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [workflow.slug, period]);

  const handleRespond = useCallback(
    async (
      stepId: string,
      decision: UserDecision,
      overrideReason: string | undefined,
      actionItemsList: EvaluationActionItem[],
    ) => {
      if (state.phase !== "step") return;

      setState({ phase: "loading" });

      try {
        const res = await fetch(
          `/api/workflows/${workflow.slug}/runs/${state.runId}/steps/${stepId}/respond`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              decision,
              overrideReason,
              actionItems: actionItemsList,
              period,
            }),
          },
        );

        if (!res.ok) {
          const data = await res.json();
          setState({ phase: "error", message: data.error ?? "Failed to submit response" });
          return;
        }

        const data = await res.json();

        if (data.done) {
          setState({
            phase: "summary",
            runId: state.runId,
            summary: data.summary,
          });
        } else if (data.nextStep) {
          setState({
            phase: "step",
            runId: state.runId,
            currentStep: data.nextStep,
          });
        }
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Network error",
        });
      }
    },
    [state, workflow.slug, period],
  );

  const handleRetry = useCallback(async () => {
    if (state.phase !== "step") return;

    const stepId = state.currentStep.stepId;
    setState({ phase: "loading" });

    try {
      const res = await fetch(
        `/api/workflows/${workflow.slug}/runs/${state.runId}/steps/${stepId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retry: true, period }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        setState({ phase: "error", message: data.error ?? "Retry failed" });
        return;
      }

      const data = await res.json();
      setState({
        phase: "step",
        runId: state.runId,
        currentStep: data.step,
      });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [state, workflow.slug, period]);

  const mainSpineSteps = getMainSpineSteps();
  const diagnosticSteps = getDiagnosticSteps();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {workflow.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {workflow.description}
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-gold/20 text-xs text-gold"
          >
            {formatCadence(workflow.cadence)}
          </Badge>
        </div>
      </div>

      {/* Controls */}
      {state.phase === "idle" && (
        <div className="flex items-center gap-4">
          <PeriodSelector
            year={year}
            month={month}
            onChange={(y, m) => {
              setYear(y);
              setMonth(m);
            }}
            disabled={false}
          />
          <button
            onClick={startEvaluation}
            className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold/90"
          >
            <Play className="h-4 w-4" />
            Start Monthly Evaluation
          </button>
        </div>
      )}

      {/* Loading */}
      {state.phase === "loading" && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="mt-4 text-sm text-muted-foreground">
            Fetching data and preparing evaluation...
          </p>
        </div>
      )}

      {/* Error */}
      {state.phase === "error" && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{state.message}</p>
          <button
            onClick={() => setState({ phase: "idle" })}
            className="mt-4 flex items-center gap-2 mx-auto rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {(state.phase === "step" || state.phase === "summary") && (
        <EvaluationProgressBar
          mainSpineSteps={mainSpineSteps}
          diagnosticSteps={diagnosticSteps}
          currentStepId={
            state.phase === "step" ? state.currentStep.stepId : null
          }
          allStepIds={
            state.phase === "step"
              ? state.currentStep.allStepIds
              : state.summary.completedSteps.map((s) => s.stepId)
          }
          completedStepIds={
            state.phase === "step"
              ? state.currentStep.completedSteps.map((s) => s.stepId)
              : state.summary.completedSteps.map((s) => s.stepId)
          }
        />
      )}

      {/* Current Step */}
      {state.phase === "step" &&
        state.currentStep.stepId !== "step6-action-summary" && (
          <EvaluationStep
            step={state.currentStep}
            onRespond={handleRespond}
            onRetry={handleRetry}
          />
        )}

      {/* Step 6: Action Summary (special rendering) */}
      {state.phase === "step" &&
        state.currentStep.stepId === "step6-action-summary" && (
          <ActionSummaryView
            step={state.currentStep}
            period={period}
            onFinish={async (finalItems) => {
              await handleRespond(
                "step6-action-summary",
                "agree",
                undefined,
                finalItems,
              );
            }}
          />
        )}

      {/* Completed Summary */}
      {state.phase === "summary" && (
        <div className="space-y-6">
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
            <p className="text-sm font-medium text-emerald-400">
              Evaluation Complete
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {state.summary.allActionItems.length} action items saved
            </p>
          </div>
          <button
            onClick={() => setState({ phase: "idle" })}
            className="flex items-center gap-2 mx-auto rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Start New Evaluation
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function EvaluationProgressBar({
  mainSpineSteps,
  diagnosticSteps,
  currentStepId,
  allStepIds,
  completedStepIds,
}: {
  mainSpineSteps: { id: string; label: string; spineStep: number | null }[];
  diagnosticSteps: { id: string; label: string }[];
  currentStepId: string | null;
  allStepIds: string[];
  completedStepIds: string[];
}) {
  const hasDiagnostics = diagnosticSteps.some((d) =>
    allStepIds.includes(d.id),
  );
  const isDiagnosticActive =
    currentStepId !== null &&
    diagnosticSteps.some((d) => d.id === currentStepId);

  function stepStatus(
    id: string,
  ): "completed" | "active" | "pending" | "placeholder" {
    if (completedStepIds.includes(id)) return "completed";
    if (id === currentStepId) return "active";
    if (!allStepIds.includes(id)) return "placeholder";
    return "pending";
  }

  const statusColors: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    active: "bg-gold/10 text-gold border-gold/30",
    pending: "bg-muted text-muted-foreground border-border",
    placeholder: "bg-muted/50 text-muted-foreground/40 border-border/50",
  };

  return (
    <div className="space-y-2">
      {/* Main spine */}
      <div className="flex items-center gap-1 flex-wrap">
        {mainSpineSteps.map((step, i) => {
          const status = stepStatus(step.id);
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusColors[status]}`}
              >
                <span className="text-[10px] opacity-60">
                  {step.spineStep}
                </span>
                {step.label}
                {status === "placeholder" && (
                  <span className="text-[9px] opacity-50">Phase 2</span>
                )}
              </div>
              {i < mainSpineSteps.length - 1 && (
                <div
                  className={`mx-1 h-px w-4 ${status === "completed" ? "bg-emerald-500/30" : "bg-border"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* CPA Diagnostic sub-bar */}
      {hasDiagnostics && (
        <div className="ml-8 flex items-center gap-1 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mr-1">
            CPA Diagnostic
          </span>
          {diagnosticSteps.map((step, i) => {
            const status = stepStatus(step.id);
            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[status]}`}
                >
                  {step.label.replace("D", "").split(":")[0]}
                </div>
                {i < diagnosticSteps.length - 1 && (
                  <div
                    className={`mx-0.5 h-px w-3 ${status === "completed" ? "bg-emerald-500/30" : "bg-border"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add evaluation wizard container with progress bar and state management`

---

## Task 11: Step Data Visualizations

**Purpose:** Per-step data visualization components for Step 1 (Decision Metrics cards) and CPA Diagnostic steps (D1-D5). Reuses formatting patterns from `meta-ads-fetch-summary.tsx`.

**Files to create:**
- `src/components/workflows/steps/decision-metrics.tsx`
- `src/components/workflows/steps/cpa-diagnostic.tsx`

**Code for `src/components/workflows/steps/decision-metrics.tsx`:**

```typescript
// src/components/workflows/steps/decision-metrics.tsx

"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

// ─── Formatters ─────────────────────────────────────────────────────────────

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

function cpaColor(cpa: number): string {
  if (cpa <= 0) return "";
  if (cpa < 9) return "text-emerald-400";
  if (cpa < 14) return "text-amber-400";
  return "text-red-400";
}

function roasColor(roas: number): string {
  return roas >= 3.0 ? "text-muted-foreground" : "text-red-400";
}

function cpaStatusBadge(status: string) {
  const colors: Record<string, string> = {
    "on-target": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    elevated: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    high: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const labels: Record<string, string> = {
    "on-target": "On Target",
    elevated: "Elevated",
    high: "High",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colors[status] ?? ""}`}>
      {labels[status] ?? status}
    </Badge>
  );
}

// ─── Metric Card ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  secondary,
  tooltip,
  statusColor,
}: {
  label: string;
  value: string;
  secondary?: string;
  tooltip?: string;
  statusColor?: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-4 py-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="inline-flex items-center gap-1 text-[11px] text-muted-foreground cursor-help">
            {label}
            {tooltip && <Info className="h-3 w-3 text-muted-foreground/50" />}
          </TooltipTrigger>
          {tooltip && (
            <TooltipContent side="top" className="max-w-xs text-xs">
              {tooltip}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <p
        className={`text-lg font-heading font-semibold tabular-nums ${statusColor ?? ""}`}
      >
        {value}
      </p>
      {secondary && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {secondary}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface DecisionMetricsData {
  account_health: {
    total_spend: number;
    total_purchases: number;
    total_attributed_revenue: number;
    cpa: number;
    roas: number;
    cpm: number;
    ctr: number;
    total_impressions: number;
    total_clicks: number;
    total_reach: number;
    avg_frequency: number;
    cpa_status: string;
    roas_status: string;
  };
  prospecting: {
    spend: number;
    purchases: number;
    cpa: number;
    campaign_count: number;
  };
  retargeting: {
    spend: number;
    purchases: number;
    cpa: number;
    campaign_count: number;
  };
  thresholds: {
    cpa_on_target: number;
    cpa_elevated: number;
    roas_floor: number;
  };
}

export function DecisionMetricsViz({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const d = data as unknown as DecisionMetricsData;
  const { account_health: h, prospecting: p, retargeting: r } = d;

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <p className="text-[11px] text-muted-foreground/60">
        We make $35 profit per booking. Meta over-reports conversions by ~30%.
        To maintain a 3:1 return, keep CPA under $9 as reported by Meta.
      </p>

      {/* CPA Status */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">CPA Status:</span>
        {cpaStatusBadge(h.cpa_status)}
      </div>

      {/* Account Health KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Account CPA"
          value={usd2.format(h.cpa)}
          secondary={
            h.cpa_status === "on-target"
              ? `On target (<$${d.thresholds.cpa_on_target})`
              : h.cpa_status === "elevated"
                ? `Elevated ($${d.thresholds.cpa_on_target}-$${d.thresholds.cpa_elevated})`
                : `High (>$${d.thresholds.cpa_elevated})`
          }
          tooltip="Meta-reported CPA. True CPA is ~1.3x higher due to over-attribution."
          statusColor={cpaColor(h.cpa)}
        />
        <MetricCard
          label="ROAS"
          value={`${h.roas.toFixed(2)}x`}
          secondary={
            h.roas_status === "above-target"
              ? `Above ${d.thresholds.roas_floor}x floor`
              : `Below ${d.thresholds.roas_floor}x floor`
          }
          tooltip="Return on Ad Spend. Below 3.0x = losing money after COGS."
          statusColor={roasColor(h.roas)}
        />
        <MetricCard
          label="Purchases"
          value={num.format(h.total_purchases)}
          secondary={`${usd.format(h.total_attributed_revenue)} revenue`}
          tooltip="Meta-attributed purchases (28d click window)"
        />
        <MetricCard
          label="Total Spend"
          value={usd.format(h.total_spend)}
          secondary={`${num.format(h.total_impressions)} impressions`}
        />
      </div>

      {/* Prospecting vs Retargeting */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Funnel Stage Breakdown
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-4 py-3">
            <p className="text-[11px] text-blue-400/80 mb-1">
              Prospecting (TOF) — {p.campaign_count} campaign{p.campaign_count !== 1 ? "s" : ""}
            </p>
            <p className={`text-lg font-heading font-semibold tabular-nums ${cpaColor(p.cpa)}`}>
              {p.purchases > 0 ? usd2.format(p.cpa) : "No purchases"}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {usd.format(p.spend)} spend · {num.format(p.purchases)} purchases
            </p>
          </div>
          <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-4 py-3">
            <p className="text-[11px] text-purple-400/80 mb-1">
              Retargeting — {r.campaign_count} campaign{r.campaign_count !== 1 ? "s" : ""}
            </p>
            <p className={`text-lg font-heading font-semibold tabular-nums ${cpaColor(r.cpa)}`}>
              {r.purchases > 0 ? usd2.format(r.cpa) : "No purchases"}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {usd.format(r.spend)} spend · {num.format(r.purchases)} purchases
            </p>
          </div>
        </div>
        {p.purchases > 0 && r.purchases > 0 && r.cpa > p.cpa && (
          <p className="mt-2 text-xs text-amber-400">
            Warning: Retargeting CPA ({usd2.format(r.cpa)}) is higher than prospecting CPA ({usd2.format(p.cpa)}). Retargeting should be cheaper since it targets warm audiences.
          </p>
        )}
      </div>
    </div>
  );
}
```

**Code for `src/components/workflows/steps/cpa-diagnostic.tsx`:**

```typescript
// src/components/workflows/steps/cpa-diagnostic.tsx

"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── D1: Frequency Check ────────────────────────────────────────────────────

interface FrequencyRow {
  campaign_id: string;
  campaign_name: string;
  frequency: number;
  impressions: number;
  reach: number;
}

export function D1FrequencyViz({ data }: { data: Record<string, unknown> }) {
  const d = data as { weekly_frequency: FrequencyRow[]; threshold: number };
  const flagged = d.weekly_frequency.filter(
    (r) => r.frequency > d.threshold,
  );

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        7-day rolling frequency by campaign. Above {d.threshold.toFixed(1)} = fatigue risk.
      </p>

      {d.weekly_frequency.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campaign data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4">Campaign</th>
                <th className="pb-2 pr-3 text-right">7-Day Freq</th>
                <th className="pb-2 pr-3 text-right">Impressions</th>
                <th className="pb-2 text-right">Reach</th>
              </tr>
            </thead>
            <tbody>
              {d.weekly_frequency.map((row) => (
                <tr
                  key={row.campaign_id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-2 pr-4 max-w-[200px] truncate" title={row.campaign_name}>
                    {row.campaign_name}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${row.frequency > d.threshold ? "text-red-400 font-medium" : ""}`}
                  >
                    {row.frequency.toFixed(1)}
                    {row.frequency > d.threshold && (
                      <AlertTriangle className="inline-block ml-1 h-3 w-3 text-red-400" />
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {num.format(row.impressions)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {num.format(row.reach)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {flagged.length === 0 && d.weekly_frequency.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          All campaigns below frequency threshold.
        </div>
      )}
    </div>
  );
}

// ─── D2: CPM Trend ──────────────────────────────────────────────────────────

interface CpmComparison {
  campaign_id: string;
  campaign_name: string;
  current_cpm: number;
  prior_cpm: number | null;
  change_pct: number | null;
  flagged: boolean;
}

export function D2CpmTrendViz({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    cpm_comparisons: CpmComparison[];
    threshold_pct: number;
  };
  const flaggedCount = d.cpm_comparisons.filter((c) => c.flagged).length;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        CPM comparison: current month vs prior month. Flag if &gt;{d.threshold_pct}% increase.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-4">Campaign</th>
              <th className="pb-2 pr-3 text-right">Current CPM</th>
              <th className="pb-2 pr-3 text-right">Prior CPM</th>
              <th className="pb-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {d.cpm_comparisons.map((row) => (
              <tr
                key={row.campaign_id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 pr-4 max-w-[200px] truncate" title={row.campaign_name}>
                  {row.campaign_name}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {usd2.format(row.current_cpm)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                  {row.prior_cpm !== null ? usd2.format(row.prior_cpm) : "—"}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${row.flagged ? "text-red-400 font-medium" : ""}`}
                >
                  {row.change_pct !== null ? (
                    <>
                      {row.change_pct > 0 ? "+" : ""}
                      {pct(row.change_pct)}
                      {row.flagged && (
                        <AlertTriangle className="inline-block ml-1 h-3 w-3 text-red-400" />
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {flaggedCount === 0 && d.cpm_comparisons.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          No significant CPM increases detected.
        </div>
      )}
    </div>
  );
}

// ─── D3: CTR Trend ──────────────────────────────────────────────────────────

interface CtrComparison {
  campaign_id: string;
  campaign_name: string;
  current_ctr: number;
  prior_ctr: number | null;
  change_pct: number | null;
  flagged: boolean;
}

export function D3CtrTrendViz({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    ctr_comparisons: CtrComparison[];
    threshold_pct: number;
  };
  const flaggedCount = d.ctr_comparisons.filter((c) => c.flagged).length;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        CTR comparison: current month vs prior month. Flag if &gt;{d.threshold_pct}% decrease.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-4">Campaign</th>
              <th className="pb-2 pr-3 text-right">Current CTR</th>
              <th className="pb-2 pr-3 text-right">Prior CTR</th>
              <th className="pb-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {d.ctr_comparisons.map((row) => (
              <tr
                key={row.campaign_id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 pr-4 max-w-[200px] truncate" title={row.campaign_name}>
                  {row.campaign_name}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {row.current_ctr.toFixed(2)}%
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                  {row.prior_ctr !== null ? `${row.prior_ctr.toFixed(2)}%` : "—"}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${row.flagged ? "text-red-400 font-medium" : ""}`}
                >
                  {row.change_pct !== null ? (
                    <>
                      {row.change_pct > 0 ? "+" : ""}
                      {pct(row.change_pct)}
                      {row.flagged && (
                        <AlertTriangle className="inline-block ml-1 h-3 w-3 text-red-400" />
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {flaggedCount === 0 && d.ctr_comparisons.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          No significant CTR declines detected.
        </div>
      )}
    </div>
  );
}

// ─── D4: Conversion Rate ────────────────────────────────────────────────────

interface ConversionCampaign {
  campaign_name: string;
  clicks: number;
  purchases: number;
  conversion_rate: number;
}

export function D4ConversionRateViz({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const d = data as {
    account_clicks: number;
    account_purchases: number;
    conversion_rate: number;
    campaigns: ConversionCampaign[];
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        Click volume vs purchase volume. If clicks are stable but purchases drop, the problem is downstream (landing page, booking flow), not the ads.
      </p>

      {/* Account-level summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md bg-muted/50 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Total Clicks</p>
          <p className="text-lg font-heading font-semibold tabular-nums">
            {num.format(d.account_clicks)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Total Purchases</p>
          <p className="text-lg font-heading font-semibold tabular-nums">
            {num.format(d.account_purchases)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Conversion Rate</p>
          <p className="text-lg font-heading font-semibold tabular-nums">
            {pct(d.conversion_rate)}
          </p>
        </div>
      </div>

      {/* Per-campaign breakdown */}
      {d.campaigns.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4">Campaign</th>
                <th className="pb-2 pr-3 text-right">Clicks</th>
                <th className="pb-2 pr-3 text-right">Purchases</th>
                <th className="pb-2 text-right">CVR</th>
              </tr>
            </thead>
            <tbody>
              {d.campaigns.map((row, i) => (
                <tr
                  key={`${row.campaign_name}-${i}`}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-2 pr-4 max-w-[200px] truncate" title={row.campaign_name}>
                    {row.campaign_name}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {num.format(row.clicks)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {num.format(row.purchases)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {row.clicks > 0 ? pct(row.conversion_rate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── D5: Pattern Match ──────────────────────────────────────────────────────

interface PatternSignals {
  frequency_7d: number;
  frequency_flagged: boolean;
  cpm_current: number;
  cpm_prior: number;
  cpm_change_pct: number | null;
  cpm_flagged: boolean;
  ctr_current: number;
  ctr_prior: number;
  ctr_change_pct: number | null;
  ctr_flagged: boolean;
  conversion_rate: number;
  prospecting_cpa: number;
  retargeting_cpa: number;
}

export function D5PatternMatchViz({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const d = data as { signals: PatternSignals };
  const s = d.signals;

  const signals = [
    {
      label: "7-Day Frequency",
      value: s.frequency_7d.toFixed(1),
      flagged: s.frequency_flagged,
      direction: s.frequency_flagged ? "high" : "normal",
    },
    {
      label: "CPM Change",
      value:
        s.cpm_change_pct !== null
          ? `${(s.cpm_change_pct * 100).toFixed(1)}%`
          : "N/A",
      flagged: s.cpm_flagged,
      direction: s.cpm_flagged ? "up" : "stable",
    },
    {
      label: "CTR Change",
      value:
        s.ctr_change_pct !== null
          ? `${(s.ctr_change_pct * 100).toFixed(1)}%`
          : "N/A",
      flagged: s.ctr_flagged,
      direction: s.ctr_flagged ? "down" : "stable",
    },
    {
      label: "Conversion Rate",
      value: pct(s.conversion_rate),
      flagged: false,
      direction: "info",
    },
    {
      label: "Prospecting CPA",
      value: s.prospecting_cpa > 0 ? usd2.format(s.prospecting_cpa) : "N/A",
      flagged: s.prospecting_cpa > 9,
      direction: s.prospecting_cpa > 9 ? "high" : "normal",
    },
    {
      label: "Retargeting CPA",
      value: s.retargeting_cpa > 0 ? usd2.format(s.retargeting_cpa) : "N/A",
      flagged: s.retargeting_cpa > s.prospecting_cpa && s.retargeting_cpa > 0,
      direction:
        s.retargeting_cpa > s.prospecting_cpa ? "high" : "normal",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        Combined signals from D1-D4. The AI will match these against known
        patterns to diagnose the root cause of elevated CPA.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {signals.map((sig) => (
          <div
            key={sig.label}
            className={`rounded-md border px-3 py-2 ${sig.flagged ? "border-red-500/20 bg-red-500/5" : "border-border bg-muted/30"}`}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {sig.label}
            </p>
            <p
              className={`text-sm font-semibold tabular-nums ${sig.flagged ? "text-red-400" : ""}`}
            >
              {sig.value}
              {sig.flagged && (
                <AlertTriangle className="inline-block ml-1 h-3 w-3" />
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add data visualization components for decision metrics and CPA diagnostics`

---

## Task 12: Action Items Editor + Evaluation Step Component

**Purpose:** Per-step action item editor with owner tags (Agency/Director/Joint) and the single evaluation step renderer that combines data visualization, AI evaluation, agree/override buttons, and action items.

**Files to create:**
- `src/components/workflows/evaluation-actions.tsx`
- `src/components/workflows/evaluation-step.tsx`

**Code for `src/components/workflows/evaluation-actions.tsx`:**

```typescript
// src/components/workflows/evaluation-actions.tsx

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvaluationActionItem } from "@/lib/workflows/evaluations/types";

const priorityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const ownerColors: Record<string, string> = {
  agency: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  director: "bg-gold/10 text-gold border-gold/20",
  joint: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const ownerLabels: Record<string, string> = {
  agency: "Agency",
  director: "Director",
  joint: "Joint",
};

interface EvaluationActionsProps {
  items: EvaluationActionItem[];
  onChange: (items: EvaluationActionItem[]) => void;
  stepId: string;
}

export function EvaluationActions({
  items,
  onChange,
  stepId,
}: EvaluationActionsProps) {
  const [newText, setNewText] = useState("");

  function handleAdd() {
    if (!newText.trim()) return;
    onChange([
      ...items,
      {
        text: newText.trim(),
        priority: "medium",
        owner: "agency",
        stepId,
      },
    ]);
    setNewText("");
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleTextChange(index: number, text: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], text };
    onChange(updated);
  }

  function handlePriorityChange(
    index: number,
    priority: EvaluationActionItem["priority"],
  ) {
    const updated = [...items];
    updated[index] = { ...updated[index], priority };
    onChange(updated);
  }

  function handleOwnerChange(
    index: number,
    owner: EvaluationActionItem["owner"],
  ) {
    const updated = [...items];
    updated[index] = { ...updated[index], owner };
    onChange(updated);
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={`${item.stepId}-${i}`}
          className="rounded-md border border-border p-3 space-y-2"
        >
          <div className="flex items-start gap-2">
            <textarea
              value={item.text}
              onChange={(e) => handleTextChange(i, e.target.value)}
              rows={2}
              className="flex-1 resize-none rounded-md bg-muted/50 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
            <button
              onClick={() => handleRemove(i)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Priority selector */}
            <div className="flex gap-1">
              {(["critical", "high", "medium"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePriorityChange(i, p)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] uppercase transition-colors",
                    item.priority === p
                      ? priorityColors[p]
                      : "border-border text-muted-foreground/50 hover:text-muted-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="h-3 w-px bg-border" />
            {/* Owner selector */}
            <div className="flex gap-1">
              {(["agency", "director", "joint"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => handleOwnerChange(i, o)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                    item.owner === o
                      ? ownerColors[o]
                      : "border-border text-muted-foreground/50 hover:text-muted-foreground",
                  )}
                >
                  {ownerLabels[o]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Add new item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="Add action item..."
          className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-gold/50"
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim()}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Read-only display for summary view ─────────────────────────────────────

export function EvaluationActionsReadonly({
  items,
}: {
  items: EvaluationActionItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={`${item.stepId}-${i}`}
          className="flex items-start gap-3 rounded-md border border-border p-3"
        >
          <div className="flex-1">
            <p className="text-sm">{item.text}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn("text-[10px] uppercase", priorityColors[item.priority])}
              >
                {item.priority}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-[10px]", ownerColors[item.owner])}
              >
                {ownerLabels[item.owner]}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Code for `src/components/workflows/evaluation-step.tsx`:**

```typescript
// src/components/workflows/evaluation-step.tsx

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EvaluationActions } from "./evaluation-actions";
import { DecisionMetricsViz } from "./steps/decision-metrics";
import {
  D1FrequencyViz,
  D2CpmTrendViz,
  D3CtrTrendViz,
  D4ConversionRateViz,
  D5PatternMatchViz,
} from "./steps/cpa-diagnostic";
import type {
  PreparedStep,
  EvaluationActionItem,
  UserDecision,
} from "@/lib/workflows/evaluations/types";

interface EvaluationStepProps {
  step: PreparedStep;
  onRespond: (
    stepId: string,
    decision: UserDecision,
    overrideReason: string | undefined,
    actionItems: EvaluationActionItem[],
  ) => Promise<void>;
  onRetry: () => Promise<void>;
}

function StepDataViz({
  stepId,
  data,
}: {
  stepId: string;
  data: Record<string, unknown>;
}) {
  switch (stepId) {
    case "step1-decision-metrics":
      return <DecisionMetricsViz data={data} />;
    case "d1-frequency":
      return <D1FrequencyViz data={data} />;
    case "d2-cpm-trend":
      return <D2CpmTrendViz data={data} />;
    case "d3-ctr-trend":
      return <D3CtrTrendViz data={data} />;
    case "d4-conversion-rate":
      return <D4ConversionRateViz data={data} />;
    case "d5-pattern-match":
      return <D5PatternMatchViz data={data} />;
    default:
      return null;
  }
}

export function EvaluationStep({
  step,
  onRespond,
  onRetry,
}: EvaluationStepProps) {
  const [decision, setDecision] = useState<UserDecision | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [actionItems, setActionItems] = useState<EvaluationActionItem[]>(
    step.suggestedActions,
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!decision) return;
    if (decision === "override" && !overrideReason.trim()) return;

    setSubmitting(true);
    await onRespond(
      step.stepId,
      decision,
      decision === "override" ? overrideReason.trim() : undefined,
      actionItems,
    );
    setSubmitting(false);
  }

  return (
    <div className="space-y-4">
      {/* Step Header */}
      <div>
        <h2 className="font-heading text-lg font-semibold">{step.label}</h2>
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </div>

      {/* Data Visualization */}
      <Card>
        <CardContent className="pt-6">
          <StepDataViz stepId={step.stepId} data={step.data} />
        </CardContent>
      </Card>

      {/* AI Evaluation */}
      {step.aiEvaluation && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              AI Evaluation
            </p>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {step.aiEvaluation}
              </ReactMarkdown>
            </div>

            {/* Agree / Override buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDecision("agree")}
                disabled={submitting}
                className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  decision === "agree"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/20"
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Agree
              </button>
              <button
                onClick={() => setDecision("override")}
                disabled={submitting}
                className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  decision === "override"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-amber-500/20"
                }`}
              >
                <XCircle className="h-4 w-4" />
                Override
              </button>
            </div>

            {/* Override reason */}
            {decision === "override" && (
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why you disagree with the AI assessment..."
                rows={3}
                className="w-full rounded-md border border-amber-500/20 bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Action Items
          </p>
          <EvaluationActions
            items={actionItems}
            onChange={setActionItems}
            stepId={step.stepId}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleSubmit}
          disabled={
            !decision ||
            submitting ||
            (decision === "override" && !overrideReason.trim())
          }
          className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold/90 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Next Step"}
        </button>
      </div>
    </div>
  );
}
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add evaluation step renderer and action items editor with owner tags`

---

## Task 13: Action Summary View

**Purpose:** Step 6 UI component showing all accumulated action items from the evaluation with final edit capability and owner tags.

**Files to create:**
- `src/components/workflows/steps/action-summary.tsx`

**Code:**

```typescript
// src/components/workflows/steps/action-summary.tsx

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { EvaluationActions } from "@/components/workflows/evaluation-actions";
import { cn } from "@/lib/utils";
import type {
  PreparedStep,
  EvaluationActionItem,
} from "@/lib/workflows/evaluations/types";
import type { MonthPeriod } from "@/lib/schemas/types";
import { getStepDef } from "@/lib/workflows/evaluations/meta-ads-monthly";

const ownerColors: Record<string, string> = {
  agency: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  director: "bg-gold/10 text-gold border-gold/20",
  joint: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const ownerLabels: Record<string, string> = {
  agency: "Agency",
  director: "Director",
  joint: "Joint",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

interface ActionSummaryViewProps {
  step: PreparedStep;
  period: MonthPeriod;
  onFinish: (finalItems: EvaluationActionItem[]) => Promise<void>;
}

export function ActionSummaryView({
  step,
  period,
  onFinish,
}: ActionSummaryViewProps) {
  // Collect all action items from completed steps
  const allPriorItems = step.completedSteps.flatMap((s) => s.actionItems);
  const [items, setItems] = useState<EvaluationActionItem[]>(allPriorItems);
  const [submitting, setSubmitting] = useState(false);

  // Group items by owner for summary stats
  const byOwner = items.reduce(
    (acc, item) => {
      acc[item.owner] = (acc[item.owner] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const byPriority = items.reduce(
    (acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Group items by source step
  const byStep = items.reduce(
    (acc, item) => {
      if (!acc[item.stepId]) acc[item.stepId] = [];
      acc[item.stepId].push(item);
      return acc;
    },
    {} as Record<string, EvaluationActionItem[]>,
  );

  async function handleFinish() {
    setSubmitting(true);
    await onFinish(items);
    setSubmitting(false);
  }

  const monthNames = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-heading text-lg font-semibold">
          Action Items Summary
        </h2>
        <p className="text-sm text-muted-foreground">
          Review and finalize all action items from your{" "}
          {monthNames[period.month]} {period.year} evaluation. Edit text,
          priority, and owner before saving.
        </p>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""} total
        </span>
        <div className="h-4 w-px bg-border" />
        {Object.entries(byPriority).map(([p, count]) => (
          <Badge
            key={p}
            variant="outline"
            className={cn("text-[10px] uppercase", priorityColors[p])}
          >
            {count} {p}
          </Badge>
        ))}
        <div className="h-4 w-px bg-border" />
        {Object.entries(byOwner).map(([o, count]) => (
          <Badge
            key={o}
            variant="outline"
            className={cn("text-[10px]", ownerColors[o])}
          >
            {count} {ownerLabels[o]}
          </Badge>
        ))}
      </div>

      {/* Completed steps review */}
      {step.completedSteps.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
              Evaluation Decisions
            </p>
            {step.completedSteps.map((cs) => (
              <div
                key={cs.stepId}
                className="flex items-center gap-2 text-sm"
              >
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${cs.decision === "agree" ? "text-emerald-400" : "text-amber-400"}`}
                />
                <span className="font-medium">{cs.label}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${cs.decision === "agree" ? "text-emerald-400 border-emerald-500/20" : "text-amber-400 border-amber-500/20"}`}
                >
                  {cs.decision}
                </Badge>
                {cs.overrideReason && (
                  <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                    — {cs.overrideReason}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Editable action items */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            All Action Items — Final Edit
          </p>
          <EvaluationActions
            items={items}
            onChange={setItems}
            stepId="step6-action-summary"
          />
        </CardContent>
      </Card>

      {/* Finish */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleFinish}
          disabled={submitting}
          className="flex items-center gap-2 rounded-md bg-gold px-6 py-2 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold/90 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Complete Evaluation"}
        </button>
      </div>
    </div>
  );
}
```

**Build verification:** `npm run build && npm run lint`

**Commit message:** `feat: add action items summary view for Step 6 with final edit`

---

## Task 14: Integration — Wire Wizard into Workflow Detail

**Purpose:** Connect the evaluation wizard to the existing workflow routing. When the workflow-detail page loads a `guided-evaluation` workflow, render the `EvaluationWizard` instead of the linear `WorkflowDetail`. Also update the page.tsx to handle both types.

**Files to modify:**
- `src/app/workflows/[slug]/workflow-detail.tsx`
- `src/app/workflows/[slug]/page.tsx`

**Changes to `src/app/workflows/[slug]/page.tsx`:**

Add an import for `EvaluationWizard` and dispatch based on `workflowType`:

```typescript
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getWorkflowBySlug, formatSlugToTitle } from "@/lib/workflows";
import { WorkflowDetail } from "./workflow-detail";
import { EvaluationWizard } from "@/components/workflows/evaluation-wizard";

interface WorkflowPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const { slug } = await params;
  const workflow = getWorkflowBySlug(slug);
  const title = workflow?.title ?? formatSlugToTitle(slug);

  return (
    <div>
      <Link
        href="/workflows"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Workflows
      </Link>

      {workflow?.status === "active" ? (
        workflow.workflowType === "guided-evaluation" ? (
          <EvaluationWizard workflow={workflow} />
        ) : (
          <WorkflowDetail workflow={workflow} />
        )
      ) : (
        <>
          <div className="mb-8">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            {workflow && (
              <p className="mt-1 text-sm text-muted-foreground">
                {workflow.description}
              </p>
            )}
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-muted-foreground">
                This workflow is under construction. Data integrations and
                visualizations will be added in a future spec.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

No changes needed to `workflow-detail.tsx` itself. The existing `WorkflowDetail` component continues to work for linear workflows. The routing happens at the page level.

**Build verification:** `npm run build && npm run lint`

**Visual verification in browser:**
1. Navigate to `/workflows` and confirm `meta-ads-evaluation` appears in the list
2. Navigate to `/workflows/meta-ads-evaluation`
3. Confirm the EvaluationWizard renders with period selector and "Start Monthly Evaluation" button
4. Start an evaluation for a recent month
5. Verify Step 1 shows decision metrics cards with CPA/ROAS/purchases
6. Click Agree or Override, verify CPA diagnostic sub-flow activates when CPA is off-target
7. Walk through D1-D5 steps verifying data visualizations render
8. Verify Step 6 shows accumulated action items
9. Complete evaluation, verify items saved to DB
10. Confirm `/workflows/meta-ads-analysis` still renders the linear WorkflowDetail

**Commit message:** `feat: wire evaluation wizard into workflow page routing`

---

## Dependency Order

```
Task 1 (types) ─────────────────────┐
                                     ├── Task 5 (engine) ──── Task 8 (run route) ──── Task 14 (integration)
Task 2 (schema) ────────────────────┤                         Task 9 (respond route) ──┘
                                     │
Task 3 (step defs) ─────────────────┤
                                     │
Task 4 (meta-ads service) ──────────┤
                                     │
Task 6 (prompts) ───────────────────┘
                                     
Task 7 (workflow registration) ──── Task 14 (integration)

Task 10 (wizard UI) ────────────────┐
Task 11 (step visualizations) ──────┤── Task 14 (integration)
Task 12 (actions editor + step) ────┤
Task 13 (action summary) ──────────┘
```

Tasks 1-4, 6, 7 can be implemented in any order (all foundational). Task 5 depends on 1, 3, 4, 6. Tasks 8-9 depend on 5. Tasks 10-13 depend on 1, 3. Task 14 depends on everything.

---

### Critical Files for Implementation
- `/Users/brady/workspace/sle/marketing-director-dashboard/src/lib/workflows/evaluation-engine.ts`
- `/Users/brady/workspace/sle/marketing-director-dashboard/src/lib/workflows/evaluations/types.ts`
- `/Users/brady/workspace/sle/marketing-director-dashboard/src/lib/workflows/evaluations/meta-ads-monthly.ts`
- `/Users/brady/workspace/sle/marketing-director-dashboard/src/components/workflows/evaluation-wizard.tsx`
- `/Users/brady/workspace/sle/marketing-director-dashboard/src/app/api/workflows/[slug]/runs/[runId]/steps/[stepId]/respond/route.ts`