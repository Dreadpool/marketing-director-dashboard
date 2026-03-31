// src/lib/workflows/evaluation-engine.ts

import { db } from "@/db";
import {
  workflowRuns,
  workflowStepRuns,
  actionItems,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import type { MonthPeriod } from "@/lib/schemas/types";
import type {
  PreparedStep,
  UserDecision,
  EvaluationActionItem,
  StepDecisionSummary,
  UserResponse,
  RespondResponse,
  ResumeEvaluationResponse,
} from "./evaluations/types";
import {
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
    .set({
      status: "running",
      startedAt: new Date(),
      outputData: currentStep.data as Record<string, unknown>,
      aiOutput: currentStep.aiEvaluation,
    })
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
          priority:
            (item.priority as EvaluationActionItem["priority"]) ?? "medium",
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
    .set({
      status: "running",
      startedAt: new Date(),
      outputData: nextStep.data as Record<string, unknown>,
      aiOutput: nextStep.aiEvaluation,
    })
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
          priority:
            (item.priority as EvaluationActionItem["priority"]) ?? "medium",
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
          priority:
            (item.priority as EvaluationActionItem["priority"]) ?? "medium",
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
  _slug: string,
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
    .set({
      outputData: step.data as Record<string, unknown>,
      aiOutput: step.aiEvaluation,
    })
    .where(
      and(
        eq(workflowStepRuns.runId, runId),
        eq(workflowStepRuns.stepId, stepId),
      ),
    );

  return step;
}
