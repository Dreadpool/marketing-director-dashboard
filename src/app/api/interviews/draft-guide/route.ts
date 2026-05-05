import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { QUESTION_DRAFTER_SYSTEM } from "@/lib/interviewer/question-drafter-prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  let body: { segment_description?: string; criteria?: object };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.segment_description || body.segment_description.trim().length < 4) {
    return NextResponse.json(
      { error: "segment_description required (at least 4 chars)" },
      { status: 400 },
    );
  }

  const userMessage = `SEGMENT DESCRIPTION
${body.segment_description.trim()}

${body.criteria ? `CRITERIA (for context):\n${JSON.stringify(body.criteria, null, 2)}` : ""}

Draft the interview guide as JSON.`;

  let raw = "";
  try {
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: QUESTION_DRAFTER_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });
    for (const block of completion.content) {
      if (block.type === "text") raw += block.text;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "model call failed" },
      { status: 502 },
    );
  }

  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let guide: unknown;
  try {
    guide = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "model did not return valid JSON", raw: cleaned.slice(0, 500) },
      { status: 502 },
    );
  }

  return NextResponse.json({ guide });
}
