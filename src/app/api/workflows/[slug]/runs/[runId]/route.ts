import { NextResponse } from "next/server";
import { getRunDetails } from "@/lib/workflows/engine";

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
