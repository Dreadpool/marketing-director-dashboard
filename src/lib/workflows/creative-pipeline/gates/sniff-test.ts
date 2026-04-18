import type { GateResult } from '../types';
import { callXai } from '@/lib/workflows/xai-client';

const SNIFF_TEST_SYSTEM = `You evaluate Meta static ad BRIEFS against an 11-point sniff test. You return JSON only, no commentary.`;

const SNIFF_TEST_PROMPT = `For each brief, check these 11 red flags and count how many fire:

1. Visual aesthetic could run as a magazine ad (too polished / studio-like)
2. Obvious Midjourney / AI-generated perfection
3. Brand logo is the first thing the eye lands on
4. Copy uses banned words (discover, experience, journey, elevate, unlock, unleash)
5. Headline is clever wordplay instead of specific (should be specific)
6. Hook starts with a verb phrase instead of a specific noun phrase with dollar amount
7. Multiple angles stacked (price AND comfort AND convenience all in one brief)
8. Composition is centered (should be F-pattern top-left)
9. Proof is generic stars without a specific outcome quote
10. Visual has no native-document cues (no screenshot chrome, paper texture, handwriting, receipt)
11. Primary text tries to sell in first 125 chars instead of creating curiosity

Return JSON in this exact shape:
{
  "briefs": [
    {"briefId": "2026-05-c01", "redFlagCount": 0, "redFlags": [], "passed": true}
  ]
}

2+ red flags means passed=false.

Briefs to evaluate:
{briefs_json}`;

interface SniffBrief {
  briefId: string;
  conceptName: string;
  visualDirection: string;
  primaryText: string;
  headline: string;
  description: string | null;
  layoutArchetype: string;
}

export async function runSniffTestGate(briefs: SniffBrief[]): Promise<GateResult> {
  const briefsJson = JSON.stringify(
    briefs.map(b => ({
      briefId: b.briefId,
      conceptName: b.conceptName,
      visualDirection: b.visualDirection,
      primaryText: b.primaryText,
      headline: b.headline,
      description: b.description,
      layoutArchetype: b.layoutArchetype,
    })),
    null,
    2
  );
  const userMessage = SNIFF_TEST_PROMPT.replace('{briefs_json}', briefsJson);

  const text = await callXai(SNIFF_TEST_SYSTEM, userMessage, 4096);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      name: 'sniff-test',
      passed: false,
      failures: ['rubric response did not contain JSON'],
    };
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    briefs: Array<{ briefId: string; redFlagCount: number; redFlags: string[]; passed: boolean }>;
  };
  const failures: string[] = parsed.briefs
    .filter(b => !b.passed)
    .map(b => `${b.briefId}: ${b.redFlags.join('; ')}`);
  return {
    name: 'sniff-test',
    passed: failures.length === 0,
    failures,
    details: parsed as unknown as Record<string, unknown>,
  };
}
