import { db } from "@/db";
import {
  workflowRuns,
  workflowStepRuns,
  periodMetrics,
  actionItems,
  workflowStepPrompts,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getWorkflowBySlug } from "@/lib/workflows";
import { callXai } from "./xai-client";
import { getExecutor } from "./executors";
import { getDefaultPrompt } from "./prompts";
import type { MonthPeriod } from "@/lib/schemas/types";

export type WorkflowRunResult = {
  id: string;
  workflowSlug: string;
  period: MonthPeriod;
  status: string;
  steps: StepRunResult[];
  startedAt: Date;
  completedAt: Date | null;
};

export type StepRunResult = {
  id: string;
  stepId: string;
  stepOrder: number;
  status: string;
  outputData: unknown;
  aiOutput: string | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

/** Load the framework prompt for a step from DB, falling back to defaults */
async function loadPrompt(
  workflowSlug: string,
  stepId: string,
): Promise<string | null> {
  const rows = await db
    .select()
    .from(workflowStepPrompts)
    .where(
      and(
        eq(workflowStepPrompts.workflowSlug, workflowSlug),
        eq(workflowStepPrompts.stepId, stepId),
      ),
    )
    .limit(1);

  if (rows.length > 0) {
    return rows[0].frameworkPrompt;
  }

  return getDefaultPrompt(workflowSlug, stepId);
}

/** Load historical metrics for MoM and YoY context */
async function loadHistoricalMetrics(
  workflowSlug: string,
  period: MonthPeriod,
): Promise<{ previousMonth?: unknown; previousYear?: unknown }> {
  const prevMonth =
    period.month === 1
      ? { year: period.year - 1, month: 12 }
      : { year: period.year, month: period.month - 1 };

  const prevYear = { year: period.year - 1, month: period.month };

  const [momRows, yoyRows] = await Promise.all([
    db
      .select()
      .from(periodMetrics)
      .where(
        and(
          eq(periodMetrics.workflowSlug, workflowSlug),
          eq(periodMetrics.periodYear, prevMonth.year),
          eq(periodMetrics.periodMonth, prevMonth.month),
        ),
      )
      .limit(1),
    db
      .select()
      .from(periodMetrics)
      .where(
        and(
          eq(periodMetrics.workflowSlug, workflowSlug),
          eq(periodMetrics.periodYear, prevYear.year),
          eq(periodMetrics.periodMonth, prevYear.month),
        ),
      )
      .limit(1),
  ]);

  return {
    previousMonth: momRows[0]?.metrics ?? undefined,
    previousYear: yoyRows[0]?.metrics ?? undefined,
  };
}

/** Schema constraints for action_items varchar columns */
const PRIORITY_MAX_LENGTH = 10;
const CATEGORY_MAX_LENGTH = 50;
const ALLOWED_PRIORITIES = ["critical", "high", "medium", "low"] as const;

/** Normalize a raw priority string to one of the allowed values, or null. */
function normalizePriority(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const p of ALLOWED_PRIORITIES) {
    if (lower.includes(p)) return p;
  }
  // Fallback: truncate to column width so a novel value does not crash insert
  return lower.slice(0, PRIORITY_MAX_LENGTH);
}

/** Normalize a raw category string to fit the varchar column. */
function normalizeCategory(raw: string | null): string | null {
  if (!raw) return null;
  return raw.slice(0, CATEGORY_MAX_LENGTH);
}

/** Parse action items from the recommend step's AI output */
function parseActionItems(
  aiOutput: string,
): { text: string; priority: string | null; category: string | null }[] {
  const items: {
    text: string;
    priority: string | null;
    category: string | null;
  }[] = [];

  const lines = aiOutput.split("\n");
  let currentAction: string | null = null;
  let currentPriority: string | null = null;
  let currentCategory: string | null = null;

  const stripMd = (s: string) => s.replace(/\*+/g, "").replace(/_+/g, "").trim();

  const flush = () => {
    if (!currentAction) return;
    items.push({
      text: currentAction,
      priority: normalizePriority(currentPriority),
      category: normalizeCategory(currentCategory),
    });
  };

  for (const line of lines) {
    const trimmed = stripMd(line);

    if (trimmed.startsWith("ACTION:")) {
      flush();
      currentAction = trimmed.slice(7).trim();
      currentPriority = null;
      currentCategory = null;
    } else if (trimmed.startsWith("PRIORITY:") && currentAction) {
      currentPriority = trimmed.slice(9).trim().toLowerCase();
    } else if (trimmed.startsWith("CATEGORY:") && currentAction) {
      currentCategory = trimmed.slice(9).trim().toLowerCase();
    }
  }

  flush();

  return items;
}

/** Create the run and step records. Returns the run ID for polling. */
export async function initWorkflowRun(
  slug: string,
  period: MonthPeriod,
  params?: Record<string, unknown>,
): Promise<{ runId: string }> {
  const workflow = getWorkflowBySlug(slug);
  if (!workflow) throw new Error(`Workflow not found: ${slug}`);
  if (workflow.status !== "active")
    throw new Error(`Workflow not active: ${slug}`);

  const executor = getExecutor(slug);
  if (!executor) throw new Error(`No executor for workflow: ${slug}`);

  const [run] = await db
    .insert(workflowRuns)
    .values({
      workflowSlug: slug,
      periodYear: period.year,
      periodMonth: period.month,
      status: "running",
      ...(params ? { inputParams: params } : {}),
    })
    .returning();

  const stepInserts = workflow.steps.map((step, i) => ({
    runId: run.id,
    stepId: step.id,
    stepOrder: i,
    status: "pending" as const,
  }));

  await db.insert(workflowStepRuns).values(stepInserts);

  return { runId: run.id };
}

/** Execute all steps for an existing run. Updates DB progressively. */
export async function executeWorkflowSteps(
  runId: string,
  slug: string,
  initialPeriod: MonthPeriod,
  options?: { forceRefresh?: boolean },
): Promise<void> {
  let period = initialPeriod;
  const workflow = getWorkflowBySlug(slug)!;
  const executor = getExecutor(slug)!;

  // Load inputParams from the run record
  const [runRecord] = await db
    .select({ inputParams: workflowRuns.inputParams })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId));
  const params = (runRecord?.inputParams as Record<string, unknown>) ?? undefined;

  const stepRows = await db
    .select()
    .from(workflowStepRuns)
    .where(eq(workflowStepRuns.runId, runId))
    .orderBy(workflowStepRuns.stepOrder);

  // Load historical data for comparisons
  const historical = await loadHistoricalMetrics(slug, period);

  const previousStepOutputs: Record<string, unknown> = {};

  for (const stepDef of workflow.steps) {
    const stepRow = stepRows.find((s) => s.stepId === stepDef.id)!;

    // Mark step as running
    await db
      .update(workflowStepRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(workflowStepRuns.id, stepRow.id));

    try {
      let outputData: unknown = null;
      let aiOutput: string | null = null;

      if (stepDef.type === "fetch") {
        // Check period cache before calling the API
        // Skip cache for workflows with inputParams (e.g., promo-code-analysis)
        // since the same period can produce different results for different inputs.
        // Also skip when forceRefresh is set (after executor code changes).
        const useCache = !params && !options?.forceRefresh;
        let cached: Array<{ metrics: unknown }> = [];

        if (useCache) {
          cached = await db
            .select({ metrics: periodMetrics.metrics })
            .from(periodMetrics)
            .where(
              and(
                eq(periodMetrics.workflowSlug, slug),
                eq(periodMetrics.periodYear, period.year),
                eq(periodMetrics.periodMonth, period.month),
              ),
            )
            .limit(1);
        }

        if (useCache && cached.length > 0 && cached[0].metrics) {
          console.log(
            `[engine] Using cached fetch data for ${slug} ${period.year}-${period.month}`,
          );
          outputData = cached[0].metrics;
        } else {
          outputData = await executor(period, params);
        }
      } else {
        // AI-powered step
        const prompt = await loadPrompt(slug, stepDef.id);
        if (!prompt) {
          throw new Error(`No prompt found for step: ${stepDef.id}`);
        }

        // Build context from previous steps + historical data
        const contextParts: string[] = [];

        if (Object.keys(previousStepOutputs).length > 0) {
          contextParts.push(
            "## Previous Step Results\n\n" +
              JSON.stringify(previousStepOutputs, null, 2),
          );
        }

        if (historical.previousMonth) {
          contextParts.push(
            "## Previous Month Metrics (for MoM comparison)\n\n" +
              JSON.stringify(historical.previousMonth, null, 2),
          );
        }

        if (historical.previousYear) {
          contextParts.push(
            "## Same Month Last Year (for YoY comparison)\n\n" +
              JSON.stringify(historical.previousYear, null, 2),
          );
        }

        const userMessage = `Analyze the data for ${period.year}-${String(period.month).padStart(2, "0")}.\n\n${contextParts.join("\n\n")}`;

        const text = await callXai(prompt, userMessage, 4096);

        aiOutput = text;
        outputData = { analysis: text };
      }

      // Mark step completed
      const completedAt = new Date();
      await db
        .update(workflowStepRuns)
        .set({
          status: "completed",
          outputData: outputData as Record<string, unknown>,
          aiOutput,
          completedAt,
        })
        .where(eq(workflowStepRuns.id, stepRow.id));

      // Chain output to next step
      previousStepOutputs[stepDef.id] = outputData;

      // If the fetch step returned a derivedPeriod, update the run record
      // (used by promo-code-analysis where the period comes from the data, not user input)
      if (
        stepDef.type === "fetch" &&
        outputData &&
        typeof outputData === "object" &&
        "derivedPeriod" in outputData
      ) {
        const dp = (outputData as Record<string, unknown>).derivedPeriod as {
          year: number;
          month: number;
        };
        if (dp?.year && dp?.month) {
          period = { year: dp.year, month: dp.month };
          await db
            .update(workflowRuns)
            .set({ periodYear: dp.year, periodMonth: dp.month })
            .where(eq(workflowRuns.id, runId));
        }
      }

      // Parse action items from recommend step
      if (stepDef.type === "recommend" && aiOutput) {
        const parsed = parseActionItems(aiOutput);
        if (parsed.length > 0) {
          await db.insert(actionItems).values(
            parsed.map((item) => ({
              runId,
              stepId: stepDef.id,
              workflowSlug: slug,
              periodYear: period.year,
              periodMonth: period.month,
              text: item.text,
              priority: item.priority,
              category: item.category,
            })),
          );
        }
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      await db
        .update(workflowStepRuns)
        .set({ status: "failed", error: errorMsg, completedAt: new Date() })
        .where(eq(workflowStepRuns.id, stepRow.id));

      // Continue to next step instead of aborting the whole run
    }
  }

  // Store period metrics snapshot from the fetch step (only if all sources loaded)
  const fetchOutput = previousStepOutputs["fetch"] as
    | { metadata?: { missing_sources?: string[] } }
    | undefined;
  const hasCompleteFetch =
    fetchOutput &&
    (!fetchOutput.metadata?.missing_sources ||
      fetchOutput.metadata.missing_sources.length === 0);
  if (hasCompleteFetch) {
    // Upsert: delete existing then insert
    await db
      .delete(periodMetrics)
      .where(
        and(
          eq(periodMetrics.workflowSlug, slug),
          eq(periodMetrics.periodYear, period.year),
          eq(periodMetrics.periodMonth, period.month),
        ),
      );
    await db.insert(periodMetrics).values({
      workflowSlug: slug,
      periodYear: period.year,
      periodMonth: period.month,
      runId,
      metrics: fetchOutput as Record<string, unknown>,
    });
  }

  // Update run status based on actual step statuses in DB
  const finalSteps = await db
    .select({ status: workflowStepRuns.status })
    .from(workflowStepRuns)
    .where(eq(workflowStepRuns.runId, runId));
  const allCompleted = finalSteps.every((s) => s.status === "completed");
  const completedAt = new Date();

  await db
    .update(workflowRuns)
    .set({
      status: allCompleted ? "completed" : "failed",
      completedAt,
    })
    .where(eq(workflowRuns.id, runId));
}

/** Get all runs for a workflow */
export async function getWorkflowRuns(slug: string) {
  return db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowSlug, slug))
    .orderBy(desc(workflowRuns.createdAt));
}

/** Get a single run with all step details and action items */
export async function getRunDetails(runId: string) {
  const [run] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId))
    .limit(1);

  if (!run) return null;

  const [steps, items] = await Promise.all([
    db
      .select()
      .from(workflowStepRuns)
      .where(eq(workflowStepRuns.runId, runId))
      .orderBy(workflowStepRuns.stepOrder),
    db
      .select()
      .from(actionItems)
      .where(eq(actionItems.runId, runId)),
  ]);

  return { ...run, steps, actionItems: items };
}

/** Get the latest completed run for a workflow */
export async function getLatestRun(slug: string) {
  const rows = await db
    .select()
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.workflowSlug, slug),
        eq(workflowRuns.status, "completed"),
      ),
    )
    .orderBy(desc(workflowRuns.createdAt))
    .limit(1);

  return rows[0] ?? null;
}
