import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { interviewCampaigns } from "@/db/schema";
import { desc } from "drizzle-orm";
import { checkInterviewApiAuth } from "@/lib/auth/interview-api-auth";
import { createCampaignWithInvites } from "@/lib/services/interview-campaign-service";
import type { SegmentCriteria } from "@/lib/services/bigquery-interview-segment";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authError = checkInterviewApiAuth(req);
  if (authError) return authError;

  let body: {
    segment_description?: string;
    segment_criteria?: SegmentCriteria;
    questions_guide?: object;
    reward_loyalty_points?: number;
    response_threshold?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (
    !body.segment_description ||
    !body.segment_criteria ||
    !body.questions_guide ||
    typeof body.reward_loyalty_points !== "number" ||
    typeof body.response_threshold !== "number"
  ) {
    return NextResponse.json(
      {
        error:
          "required: segment_description, segment_criteria, questions_guide, reward_loyalty_points, response_threshold",
      },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;

  try {
    const result = await createCampaignWithInvites({
      segmentDescription: body.segment_description,
      segmentCriteria: body.segment_criteria,
      questionsGuide: body.questions_guide,
      rewardLoyaltyPoints: body.reward_loyalty_points,
      responseThreshold: body.response_threshold,
      baseUrl,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "create failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const authError = checkInterviewApiAuth(req);
  if (authError) return authError;

  const rows = await db
    .select()
    .from(interviewCampaigns)
    .orderBy(desc(interviewCampaigns.createdAt));

  return NextResponse.json({ campaigns: rows });
}
