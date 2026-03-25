import { NextResponse } from "next/server";
import { db } from "@/db";
import { workflowStepPrompts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getDefaultPrompt } from "@/lib/workflows/prompts";

export const dynamic = "force-dynamic";

interface PromptParams {
  params: Promise<{ slug: string; stepId: string }>;
}

export async function GET(_request: Request, { params }: PromptParams) {
  try {
    const { slug, stepId } = await params;

    const rows = await db
      .select()
      .from(workflowStepPrompts)
      .where(
        and(
          eq(workflowStepPrompts.workflowSlug, slug),
          eq(workflowStepPrompts.stepId, stepId),
        ),
      )
      .limit(1);

    const customPrompt = rows[0]?.frameworkPrompt ?? null;
    const defaultPrompt = getDefaultPrompt(slug, stepId);

    return NextResponse.json({
      prompt: customPrompt ?? defaultPrompt,
      isCustom: !!customPrompt,
      defaultPrompt,
    });
  } catch (err) {
    console.error("Failed to fetch prompt:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch prompt" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: PromptParams) {
  try {
    const { slug, stepId } = await params;
    const { frameworkPrompt } = await request.json();

    if (!frameworkPrompt || typeof frameworkPrompt !== "string") {
      return NextResponse.json(
        { error: "frameworkPrompt is required" },
        { status: 400 },
      );
    }

    // Delete existing then insert (upsert)
    await db
      .delete(workflowStepPrompts)
      .where(
        and(
          eq(workflowStepPrompts.workflowSlug, slug),
          eq(workflowStepPrompts.stepId, stepId),
        ),
      );

    const [row] = await db
      .insert(workflowStepPrompts)
      .values({
        workflowSlug: slug,
        stepId,
        frameworkPrompt,
      })
      .returning();

    return NextResponse.json(row);
  } catch (err) {
    console.error("Failed to update prompt:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update prompt" },
      { status: 500 },
    );
  }
}
