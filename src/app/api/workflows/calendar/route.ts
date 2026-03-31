import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { workflowRuns } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { workflows } from "@/lib/workflows";
import {
  getCurrentDuePeriod,
  getDueDateForPeriod,
  isPeriodSatisfied,
  formatCadence,
} from "@/lib/workflows/cadence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const viewYear = searchParams.get("year")
      ? parseInt(searchParams.get("year")!, 10)
      : null;
    const viewMonth = searchParams.get("month")
      ? parseInt(searchParams.get("month")!, 10)
      : null;

    const results = await Promise.all(
      workflows.map(async (workflow) => {
        const duePeriod = getCurrentDuePeriod(workflow);

        // Query completed runs for this workflow
        const completedRuns = await db
          .select({
            periodYear: workflowRuns.periodYear,
            periodMonth: workflowRuns.periodMonth,
          })
          .from(workflowRuns)
          .where(
            and(
              eq(workflowRuns.workflowSlug, workflow.slug),
              eq(workflowRuns.status, "completed"),
            ),
          );

        // Determine status
        let status: "due" | "completed" | "coming-soon" | "on-demand";
        if (workflow.status !== "active") {
          status = "coming-soon";
        } else if (!duePeriod) {
          status = "on-demand";
        } else if (isPeriodSatisfied(completedRuns, duePeriod)) {
          status = "completed";
        } else {
          status = "due";
        }

        // Compute due date for the current period (for calendar placement)
        const dueDate = duePeriod
          ? getDueDateForPeriod(workflow, duePeriod)
          : null;

        // If viewing a specific month, compute due date for that month's period
        let viewDueDate: string | null = null;
        if (viewYear && viewMonth) {
          // The viewed month shows due dates that fall in it.
          // A due date in April means the period is March (previous month).
          const viewPeriod = viewMonth === 1
            ? { year: viewYear - 1, month: 12 }
            : { year: viewYear, month: viewMonth - 1 };

          const periodDueDate = getDueDateForPeriod(workflow, viewPeriod);
          if (
            periodDueDate &&
            periodDueDate.getFullYear() === viewYear &&
            periodDueDate.getMonth() + 1 === viewMonth
          ) {
            viewDueDate = periodDueDate.toISOString();
          }

          // Check if this viewed period is satisfied
          const viewSatisfied = isPeriodSatisfied(completedRuns, viewPeriod);

          return {
            slug: workflow.slug,
            title: workflow.title,
            cadence: formatCadence(workflow.cadence),
            status,
            duePeriod,
            dueDate: dueDate?.toISOString() ?? null,
            viewDueDate,
            viewPeriod,
            viewSatisfied,
          };
        }

        return {
          slug: workflow.slug,
          title: workflow.title,
          cadence: formatCadence(workflow.cadence),
          status,
          duePeriod,
          dueDate: dueDate?.toISOString() ?? null,
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
