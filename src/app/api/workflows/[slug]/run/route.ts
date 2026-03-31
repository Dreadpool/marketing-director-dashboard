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
