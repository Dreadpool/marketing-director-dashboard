import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { interviewCampaigns } from "@/db/schema";
import { desc } from "drizzle-orm";
import { checkInterviewApiAuth } from "@/lib/auth/interview-api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authError = checkInterviewApiAuth(req);
  if (authError) return authError;
  return NextResponse.json({ error: "New interviews are closed." }, { status: 410 });
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
