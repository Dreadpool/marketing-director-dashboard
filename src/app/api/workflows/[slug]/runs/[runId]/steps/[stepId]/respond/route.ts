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
