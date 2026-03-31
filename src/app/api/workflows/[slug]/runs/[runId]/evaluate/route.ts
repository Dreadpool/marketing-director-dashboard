import { NextResponse } from "next/server";
import { initEvaluationFromRun } from "@/lib/workflows/evaluation-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface EvaluateParams {
  params: Promise<{ slug: string; runId: string }>;
}

export async function POST(request: Request, { params }: EvaluateParams) {
  try {
    const { slug, runId } = await params;
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

    const result = await initEvaluationFromRun(runId, slug, period);

    return NextResponse.json({
      runId: result.runId,
      currentStep: result.currentStep,
    });
  } catch (err) {
    console.error("Evaluation init error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to start evaluation",
      },
      { status: 500 },
    );
  }
}
