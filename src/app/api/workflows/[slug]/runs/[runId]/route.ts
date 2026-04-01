import { NextResponse } from "next/server";
import { getRunDetails } from "@/lib/workflows/engine";
import { db } from "@/db";
import {
  workflowRuns,
  workflowStepRuns,
  periodMetrics,
  actionItems,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface RunDetailParams {
  params: Promise<{ slug: string; runId: string }>;
}

export async function GET(_request: Request, { params }: RunDetailParams) {
  try {
    const { runId } = await params;
    const run = await getRunDetails(runId);

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch (err) {
    console.error("Failed to fetch run details:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch run details",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RunDetailParams) {
  try {
    const { runId } = await params;

    // Delete child rows first (FK constraints)
    await db.delete(actionItems).where(eq(actionItems.runId, runId));
    await db.delete(periodMetrics).where(eq(periodMetrics.runId, runId));
    await db.delete(workflowStepRuns).where(eq(workflowStepRuns.runId, runId));
    await db.delete(workflowRuns).where(eq(workflowRuns.id, runId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete run:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete run" },
      { status: 500 },
    );
  }
}
