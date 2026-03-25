import { NextResponse } from "next/server";
import { executeWorkflow } from "@/lib/workflows/engine";

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

    const result = await executeWorkflow(slug, period);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Workflow execution error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Workflow execution failed" },
      { status: 500 },
    );
  }
}
