import { NextResponse } from "next/server";
import { db } from "@/db";
import { workflowRuns } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { workflows } from "@/lib/workflows";
import { isDue, getNextDueDate, formatCadence } from "@/lib/workflows/cadence";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = await Promise.all(
      workflows
        .filter((w) => w.status === "active")
        .map(async (workflow) => {
          const latestRuns = await db
            .select()
            .from(workflowRuns)
            .where(
              and(
                eq(workflowRuns.workflowSlug, workflow.slug),
                eq(workflowRuns.status, "completed"),
              ),
            )
            .orderBy(desc(workflowRuns.createdAt))
            .limit(1);

          const lastRun = latestRuns[0];
          const runInfo = lastRun
            ? {
                completedAt: lastRun.completedAt,
                periodYear: lastRun.periodYear,
                periodMonth: lastRun.periodMonth,
              }
            : undefined;

          return {
            slug: workflow.slug,
            title: workflow.title,
            cadence: formatCadence(workflow.cadence),
            isDue: isDue(workflow, runInfo),
            nextDueDate: getNextDueDate(workflow, runInfo)?.toISOString() ?? null,
            lastCompletedAt: lastRun?.completedAt?.toISOString() ?? null,
            lastPeriod: lastRun
              ? {
                  year: lastRun.periodYear,
                  month: lastRun.periodMonth,
                }
              : null,
          };
        }),
    );

    return NextResponse.json({ workflows: results });
  } catch (err) {
    console.error("Failed to fetch calendar data:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch calendar data",
      },
      { status: 500 },
    );
  }
}
