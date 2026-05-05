import { NextRequest, NextResponse } from "next/server";
import {
  exploreSegment,
  type SegmentCriteria,
} from "@/lib/services/bigquery-interview-segment";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { criteria?: SegmentCriteria };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.criteria || typeof body.criteria !== "object") {
    return NextResponse.json({ error: "criteria required" }, { status: 400 });
  }

  try {
    const result = await exploreSegment(body.criteria);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "preview failed" },
      { status: 500 },
    );
  }
}
