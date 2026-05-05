import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { interviewArtifacts, interviewCampaigns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkInterviewApiAuth } from "@/lib/auth/interview-api-auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = checkInterviewApiAuth(req);
  if (authError) return authError;

  const { id } = await params;

  let body: {
    title?: string;
    brief_markdown?: string;
    artifact_html?: string;
    reliability_notes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.title || !body.brief_markdown || !body.artifact_html) {
    return NextResponse.json(
      { error: "title, brief_markdown, artifact_html required" },
      { status: 400 },
    );
  }

  const [campaign] = await db
    .select()
    .from(interviewCampaigns)
    .where(eq(interviewCampaigns.id, id));

  if (!campaign) {
    return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  }

  const [artifact] = await db
    .insert(interviewArtifacts)
    .values({
      campaignId: id,
      title: body.title,
      briefMarkdown: body.brief_markdown,
      artifactHtml: body.artifact_html,
      reliabilityNotes: (body.reliability_notes as object) ?? null,
    })
    .returning();

  await db
    .update(interviewCampaigns)
    .set({ state: "analyzed", analyzedAt: new Date() })
    .where(eq(interviewCampaigns.id, id));

  return NextResponse.json({ artifact_id: artifact.id, state: "analyzed" });
}
