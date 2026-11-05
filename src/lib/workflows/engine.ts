import { savedMarketingReport } from "./saved-marketing-report";
import { db } from "@/db";
import {
  workflowRuns,
  workflowStepRuns,
  periodMetrics,
  actionItems,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getWorkflowBySlug } from "@/lib/workflows";
import { getExecutor } from "./executors";
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

  const previousStepOutputs: Record<string, unknown> = {};

  for (const stepDef of workflow.steps) {
    const stepRow = stepRows.find((s) => s.stepId === stepDef.id)!;

    // Mark step as running
    await db
      .update(workflowStepRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(workflowStepRuns.id, stepRow.id));

    try {
      // An explicit run always retrieves source data. Saved runs are opened separately.
      if (stepDef.type !== "fetch") throw new Error("Only data fetch steps can run");
      const fetched = await executor(period, params);
      const outputData = { ...fetched, dataRetrievedAt: new Date().toISOString() };

      // Mark step completed
      const completedAt = new Date();
      await db
        .update(workflowStepRuns)
        .set({
          status: "completed",
          outputData: outputData as Record<string, unknown>,
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

  if (["monthly-analytics-review", "promo-code-analysis"].includes(run.workflowSlug)) {
    const reportSteps = steps.filter(step => step.stepId === "fetch").map(step => ({
      ...step, inputData: null, aiOutput: null, userResponse: null,
      outputData: savedMarketingReport(run.workflowSlug, step.outputData),
    }));
    return { ...run, steps: reportSteps, actionItems: [] };
  }
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
