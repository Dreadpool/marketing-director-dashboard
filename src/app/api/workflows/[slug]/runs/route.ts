import { isRetiredTdsReport, MMC_REPORT_URL } from "@/lib/workflows/tds-reporting";
import { NextResponse } from "next/server";
import { getWorkflowRuns } from "@/lib/workflows/engine";

export const dynamic = "force-dynamic";

interface RunsParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RunsParams) {
  try {
    const { slug } = await params;
    if (isRetiredTdsReport(slug)) return NextResponse.json(
      { error: "Company reporting is available in MMC Ridership Summaries.", url: MMC_REPORT_URL }, { status: 410 });
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
