import { NextResponse } from "next/server";
import { getWorkflowRuns } from "@/lib/workflows/engine";

export const dynamic = "force-dynamic";

interface RunsParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RunsParams) {
  try {
    const { slug } = await params;
    const runs = await getWorkflowRuns(slug);
    return NextResponse.json({ runs });
  } catch (err) {
    console.error("Failed to fetch runs:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch runs" },
      { status: 500 },
    );
  }
}
