import { NextResponse, after } from "next/server";
import { initWorkflowRun, executeWorkflowSteps } from "@/lib/workflows/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RunParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: RunParams) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { period, params: workflowParams, forceRefresh } = body;

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

    const { runId } = await initWorkflowRun(slug, period, workflowParams);

    after(async () => {
      try {
        await executeWorkflowSteps(runId, slug, period, {
          forceRefresh: !!forceRefresh,
        });
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
