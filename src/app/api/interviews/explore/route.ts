import { NextRequest, NextResponse } from "next/server";
import { checkInterviewApiAuth } from "@/lib/auth/interview-api-auth";
import {
  exploreSegment,
  type SegmentCriteria,
} from "@/lib/services/bigquery-interview-segment";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = checkInterviewApiAuth(req);
  if (authError) return authError;

  let body: { criteria?: SegmentCriteria };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.criteria || typeof body.criteria !== "object") {
    return NextResponse.json(
      { error: "criteria object required" },
      { status: 400 },
    );
  }

  try {
    const result = await exploreSegment(body.criteria);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "explore failed" },
      { status: 500 },
    );
  }
}
