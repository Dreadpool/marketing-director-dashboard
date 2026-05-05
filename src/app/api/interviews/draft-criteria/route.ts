import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You convert a plain-English description of a Salt Lake Express customer segment into BigQuery filter criteria for the customer-interview workflow.

OUTPUT
Return ONLY a JSON object with this exact shape (no markdown, no commentary):
{
  "criteria": {
    "trip_count_last_n_days"?: { "days": number, "op": ">=" | "<=" | "=", "value": number },
    "days_since_last_trip"?: { "op": ">" | "<" | ">=" | "<=", "value": number },
    "first_trip_before"?: "YYYY-MM-DD",
    "total_spend"?: { "op": ">=" | "<=" | ">" | "<", "value": number },
    "customer_segment"?: "churned" | "active" | "first_timer" | "superconsumer"
  },
  "reasoning": "one short sentence explaining the translation"
}

PRESET SEGMENTS (prefer these when applicable)
- "churned": last trip 180+ days ago AND 5+ lifetime trips. Use for "lapsed riders," "former customers," "haven't ridden in a while."
- "active": last trip within 60 days. Use for "current riders," "recent customers."
- "first_timer": exactly 1 lifetime trip in the last 90 days. Use for "new riders," "first-time customers."
- "superconsumer": 30+ trips in the last 365 days. Use for "frequent riders," "power users," "best customers."

EXAMPLES
"churned frequent riders"          → { "customer_segment": "churned" }
"customers who haven't ridden in 6+ months and have spent over $200" →
   { "days_since_last_trip": { "op": ">=", "value": 180 }, "total_spend": { "op": ">=", "value": 200 } }
"superconsumers"                   → { "customer_segment": "superconsumer" }
"first time riders this quarter"   → { "customer_segment": "first_timer" }

If the description is too vague to translate confidently, return:
{ "criteria": {}, "reasoning": "Description is too vague — please clarify (e.g. trip count, recency, spend)." }`;

export async function POST(req: NextRequest) {
  let body: { description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.description || body.description.trim().length < 4) {
    return NextResponse.json(
      { error: "description required (at least 4 chars)" },
      { status: 400 },
    );
  }

  let raw = "";
  try {
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: body.description.trim() }],
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

  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "model did not return valid JSON", raw: cleaned.slice(0, 500) },
      { status: 502 },
    );
  }
}
