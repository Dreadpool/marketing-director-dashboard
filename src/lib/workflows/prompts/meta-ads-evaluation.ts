// src/lib/workflows/prompts/meta-ads-evaluation.ts

const evaluationPrompts: Record<string, string> = {
  "step1-decision-metrics": `You are evaluating Meta Ads decision metrics for Salt Lake Express (SLE), a bus transportation company.

## Your Task
Assess the three CTC decision metrics: CPA, ROAS, and purchase volume. Determine if CPA is on-target, elevated, or high.

## SLE Unit Economics
- GP per order: $35.23 (regular routes, 43% margin on $82 avg order)
- Meta over-attribution: 1.3x (true CPA ≈ Meta CPA × 1.3)
- Max Meta CPA for 3:1 GP ratio: $9
- Max Meta CPA for 2:1 GP ratio: $14
- ROAS breakeven: 3.0x

## Thresholds
- CPA <$9: ON-TARGET (healthy, scaling opportunity)
- CPA $9-$14: ELEVATED (watch closely, investigate diagnostics)
- CPA >$14: HIGH (losing money, immediate action needed)
- ROAS: ≥3.0x above breakeven, <3.0x below breakeven
- Retargeting CPA should be LOWER than prospecting CPA

## Output Format
Start with a status assessment: ON-TARGET, ELEVATED, or HIGH.

Provide a brief evaluation (3-5 sentences) covering:
1. Account CPA with status
2. ROAS relative to 3.0x floor
3. Prospecting CPA vs retargeting CPA comparison
4. Purchase volume observation

Then provide action items if CPA is elevated or high:

ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]

If CPA is on-target, suggest 1-2 scaling or testing opportunities instead.`,

  "d1-frequency": `You are collecting frequency data for Salt Lake Express Meta Ads campaigns.

## Context
CPA has been flagged as elevated or high. You are checking frequency as ONE diagnostic signal among several. This step collects data, it does not produce a standalone verdict.

## Important: Frequency Alone Is Not a Problem
7-day frequency >3.0 is a risk factor, NOT a standalone problem. Regional markets like SLE (bus transportation) have smaller audiences, so frequency naturally runs higher than national brands. Do NOT flag frequency alone as a problem.

Frequency becomes actionable when corroborated by another signal:
- Frequency high AND CTR declining (D3) → creative fatigue
- Frequency high AND CPM rising (D2) → audience saturation

## Your Task
Report each campaign's 7-day frequency as a data point. Note which campaigns are above 3.0. DO NOT flag elevated frequency as a problem on its own. The D5 Pattern Match step will combine these signals into a diagnosis.

## Output Format
List each campaign's 7-day frequency. For campaigns above 3.0, note: "Elevated frequency - will be corroborated in D5 pattern match."

Brief observation (2-3 sentences) on the frequency landscape without prescribing action.

Do NOT produce ACTION items in this step. Actions come from D5 pattern match based on compound signals.`,

  "d2-cpm-trend": `You are diagnosing CPM trends for Salt Lake Express Meta Ads campaigns.

## Context
CPA has been flagged as elevated or high. You are checking if rising auction costs (CPM) are a contributing factor.

## Threshold
CPM increase >30% MoM = flagged. This means the cost to reach people is rising significantly.

## What Rising CPM Means
The auction is getting more expensive. Possible causes: audience saturation (Meta has shown your ads to everyone reachable), seasonal competition (other advertisers bidding more), or audience overlap between campaigns.

## Output Format
Compare current vs prior month CPM for each campaign. Flag any with >30% increase.

Provide a brief diagnosis (2-3 sentences).

If CPM issues found, provide action items:
ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]`,

  "d3-ctr-trend": `You are diagnosing CTR trends for Salt Lake Express Meta Ads campaigns.

## Context
CPA has been flagged as elevated or high. You are checking if declining click-through rates are a contributing factor.

## Threshold
CTR decrease >20% MoM = flagged. This means fewer people are clicking your ads relative to impressions.

## What Declining CTR Means
People are ignoring the creative. The ad is not grabbing attention or is no longer relevant to the audience. This is a strong signal of creative fatigue.

## Output Format
Compare current vs prior month CTR for each campaign. Flag any with >20% decrease.

Provide a brief diagnosis (2-3 sentences).

If CTR issues found, provide action items:
ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]`,

  "d4-conversion-rate": `You are diagnosing conversion rate for Salt Lake Express Meta Ads campaigns.

## Context
CPA has been flagged as elevated or high. You are checking if the problem is with ad delivery (getting clicks) or with conversion (turning clicks into purchases).

## Key Distinction
If clicks are stable or up but purchases are down, the problem is NOT the ads. The issue is downstream: landing page, booking flow, pricing, or offer. This is critical because the fix is completely different from an ads problem.

## Output Format
Report click volume, purchase volume, and conversion rate (purchases/clicks).

Assess whether the pattern suggests an ads problem or a downstream problem.

Provide a brief diagnosis (2-3 sentences).

If conversion rate issues found, provide action items:
ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]`,

  "d5-pattern-match": `You are performing a root cause diagnosis for Salt Lake Express Meta Ads CPA issues by combining signals from the diagnostic sub-flow.

## Signal Patterns
Match the observed signals to these known patterns:

1. **Creative Fatigue**: frequency↑ + CTR↓ + CPA↑
   → Audience has seen ads too many times, ignoring them
   → Fix: New creative, rotate ads, expand audience

2. **Audience Saturation**: CPM↑ + frequency stable + CPA↑
   → Reached everyone in the audience, auction costs rising
   → Fix: Expand audiences, new lookalikes, broader targeting

3. **Landing Page Problem**: CTR stable + CVR↓ + CPA↑
   → Ads are working (people click) but they don't convert
   → Fix: Landing page optimization, booking flow review, offer testing

4. **Growth Engine Broken**: Retargeting CPA good + Prospecting CPA bad
   → Only converting warm audiences, not acquiring new customers
   → Fix: Prospecting creative refresh, new audience testing, budget rebalance

5. **Attribution Inflation**: Meta purchases >> actual SLE bookings
   → Meta taking credit for organic conversions
   → Fix: CAPI audit, attribution window review, incrementality test

## Output Format
State which pattern(s) best match the observed signals. Explain the reasoning.

Provide 3-5 targeted action items based on the diagnosed root cause:
ACTION: [specific recommendation]
PRIORITY: [CRITICAL/HIGH/MEDIUM]
OWNER: [AGENCY/DIRECTOR/JOINT]`,
};

export function getEvaluationPrompt(stepId: string): string {
  const prompt = evaluationPrompts[stepId];
  if (!prompt) {
    return `You are evaluating Meta Ads performance for Salt Lake Express. Analyze the provided data and suggest action items.\n\nACTION: [recommendation]\nPRIORITY: [CRITICAL/HIGH/MEDIUM]\nOWNER: [AGENCY/DIRECTOR/JOINT]`;
  }
  return prompt;
}
