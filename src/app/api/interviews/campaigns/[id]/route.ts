import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { interviewCampaigns, interviewResponses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkInterviewApiAuth } from "@/lib/auth/interview-api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = checkInterviewApiAuth(req);
  if (authError) return authError;

  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(interviewCampaigns)
    .where(eq(interviewCampaigns.id, id));

  if (!campaign) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const responses = await db
    .select({
      id: interviewResponses.id,
      customerId: interviewResponses.customerId,
      customerEmail: interviewResponses.customerEmail,
      customerName: interviewResponses.customerName,
      customerProfile: interviewResponses.customerProfile,
      status: interviewResponses.status,
      transcript: interviewResponses.transcript,
      invitedAt: interviewResponses.invitedAt,
      startedAt: interviewResponses.startedAt,
      completedAt: interviewResponses.completedAt,
    })
    .from(interviewResponses)
    .where(eq(interviewResponses.campaignId, id));

  return NextResponse.json({ ...campaign, responses });
}
