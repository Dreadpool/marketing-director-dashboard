import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { interviewCampaigns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendAnalystHandoff } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { sender_name?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const [campaign] = await db
    .select()
    .from(interviewCampaigns)
    .where(eq(interviewCampaigns.id, id));

  if (!campaign) {
    return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  const campaignUrl = `${baseUrl}/workflows/customer-interviews/${id}`;

  const analystEmail =
    process.env.ANALYST_EMAIL ?? "brady.price@saltlakeexpress.com";

  try {
    await sendAnalystHandoff({
      to: analystEmail,
      campaignId: campaign.id,
      segmentDescription: campaign.segmentDescription,
      responseCount: campaign.responsesCompleted,
      threshold: campaign.responseThreshold,
      campaignUrl,
      senderName: body.sender_name ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "send failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sent_to: analystEmail });
}
