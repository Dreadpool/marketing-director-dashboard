import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { interviewCampaigns, interviewResponses } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildInterviewerSystemPrompt,
  COMPLETION_SENTINEL,
} from "@/lib/interviewer/system-prompt";
import { sendInterviewThanks, sendCsrLoyaltyPoints } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Turn = { role: "user" | "assistant"; content: string };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function asTurns(transcript: unknown): Turn[] {
  if (!Array.isArray(transcript)) return [];
  return transcript.filter(
    (t): t is Turn =>
      t != null &&
      typeof t === "object" &&
      "role" in t &&
      "content" in t &&
      (t.role === "user" || t.role === "assistant"),
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const userMessage = (body.message ?? "").trim();

  const [response] = await db
    .select()
    .from(interviewResponses)
    .where(eq(interviewResponses.token, token));

  if (!response) {
    return NextResponse.json({ error: "interview not found" }, { status: 404 });
  }

  if (response.status === "completed") {
    return NextResponse.json(
      { error: "interview already completed" },
      { status: 410 },
    );
  }

  const [campaign] = await db
    .select()
    .from(interviewCampaigns)
    .where(eq(interviewCampaigns.id, response.campaignId));

  if (!campaign) {
    return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  }

  const existingTurns = asTurns(response.transcript);
  const turns: Turn[] = [...existingTurns];

  const isFirstTurn = existingTurns.length === 0;

  if (!isFirstTurn) {
    if (!userMessage) {
      return NextResponse.json(
        { error: "message required" },
        { status: 400 },
      );
    }
    turns.push({ role: "user", content: userMessage });
  }

  const systemPrompt = buildInterviewerSystemPrompt({
    guide: (campaign.questionsGuide as Parameters<typeof buildInterviewerSystemPrompt>[0]["guide"]) ?? {},
    customerName: response.customerName,
    segmentDescription: campaign.segmentDescription,
  });

  // Anthropic message list. If first turn, seed a synthetic user "begin" cue.
  const apiMessages: Turn[] =
    turns.length === 0
      ? [{ role: "user", content: "(Begin the interview now.)" }]
      : turns;

  let assistantText = "";
  try {
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: systemPrompt,
      messages: apiMessages,
    });
    for (const block of completion.content) {
      if (block.type === "text") assistantText += block.text;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "model call failed" },
      { status: 502 },
    );
  }

  const isComplete = assistantText.includes(COMPLETION_SENTINEL);
  const visibleText = assistantText.replace(COMPLETION_SENTINEL, "").trim();

  turns.push({ role: "assistant", content: visibleText });

  const updates: Partial<typeof interviewResponses.$inferInsert> = {
    transcript: turns,
  };
  if (isFirstTurn && existingTurns.length === 0) {
    updates.status = "in_progress";
    updates.startedAt = new Date();
  }
  if (isComplete) {
    updates.status = "completed";
    updates.completedAt = new Date();
  }

  await db
    .update(interviewResponses)
    .set(updates)
    .where(eq(interviewResponses.id, response.id));

  if (isComplete) {
    // Increment campaign counter, possibly transition to ready, fire emails.
    const [updatedCampaign] = await db
      .update(interviewCampaigns)
      .set({
        responsesCompleted: sql`${interviewCampaigns.responsesCompleted} + 1`,
      })
      .where(eq(interviewCampaigns.id, campaign.id))
      .returning();

    if (
      updatedCampaign.state === "collecting" &&
      updatedCampaign.responsesCompleted >= updatedCampaign.responseThreshold
    ) {
      await db
        .update(interviewCampaigns)
        .set({ state: "ready", readyAt: new Date() })
        .where(eq(interviewCampaigns.id, campaign.id));
    }

    // Best-effort email sends. Failures don't fail the request.
    try {
      await sendInterviewThanks({
        to: response.customerEmail,
        customerName: response.customerName,
        rewardPoints: campaign.rewardLoyaltyPoints,
      });
    } catch {
      /* swallow */
    }
    try {
      await sendCsrLoyaltyPoints({
        customerName: response.customerName,
        customerEmail: response.customerEmail,
        customerId: response.customerId,
        rewardPoints: campaign.rewardLoyaltyPoints,
        campaignId: campaign.id,
      });
    } catch {
      /* swallow */
    }
  }

  return NextResponse.json({
    assistant_message: visibleText,
    is_complete: isComplete,
    transcript_length: turns.length,
  });
}
