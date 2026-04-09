import type { EvaluationStepDef } from "./types";

export const SLE_THRESHOLDS = {
  cpa_on_target: 9,
  cpa_elevated: 14,
  roas_floor: 3.0,
  frequency_fatigue: 3.0,
  cpm_mom_increase: 0.3,
  ctr_mom_decrease: 0.2,
  blended_cac_ceiling: 22,
  over_attribution: 1.3,
  gp_per_order: 35.23,
  gross_margin: 0.43,
  learning_budget_per_adset: 6000,
  monthly_budget: 6900,
} as const;

export const META_ADS_EVALUATION_STEPS: EvaluationStepDef[] = [
  {
    id: "step1-decision-metrics",
    label: "Decision Metrics",
    description:
      "Check CPA, ROAS, and purchase volume against SLE thresholds. Determines whether to enter the CPA diagnostic sub-flow.",
    spineStep: 1,
    order: 0,
    condition: { type: "always" },
    thresholds: {
      cpa_on_target: `<$${SLE_THRESHOLDS.cpa_on_target} (3:1+ GP ratio after 1.3x over-attribution)`,
      cpa_elevated: `$${SLE_THRESHOLDS.cpa_on_target}-$${SLE_THRESHOLDS.cpa_elevated} (2:1 to 3:1 GP ratio)`,
      cpa_high: `>$${SLE_THRESHOLDS.cpa_elevated} (below 2:1, losing money)`,
      roas_floor: `${SLE_THRESHOLDS.roas_floor}x (GP breakeven after COGS + over-attribution)`,
      retargeting_vs_prospecting:
        "Retargeting CPA should be lower than prospecting CPA",
    },
  },
  {
    id: "d1-frequency",
    label: "D1: Frequency Check",
    description:
      "Check 7-day rolling frequency by campaign. Frequency > 3.0 is a risk factor, not a standalone problem. It becomes actionable when combined with CTR decline or CPM increase (see D5 Pattern Match).",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 1,
    condition: { type: "cpa-off-target" },
    thresholds: {
      frequency_7day: `>${SLE_THRESHOLDS.frequency_fatigue} in 7 days = elevated (risk factor, not verdict)`,
      compound_required:
        "Frequency alone is not a problem. Actionable only when combined with CTR decline (D3) or CPM increase (D2).",
      context:
        "Regional audiences (like SLE's) naturally run higher frequency than national brands.",
    },
  },
  {
    id: "d2-cpm-trend",
    label: "D2: CPM Trend",
    description:
      "Compare current month CPM vs prior month CPM by campaign. >30% increase MoM is a flag.",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 2,
    condition: { type: "cpa-off-target" },
    thresholds: {
      cpm_mom_increase: `>${SLE_THRESHOLDS.cpm_mom_increase * 100}% MoM increase`,
      diagnosis:
        "Auction getting more expensive. Audience saturated or seasonal competition.",
    },
  },
  {
    id: "d3-ctr-trend",
    label: "D3: CTR Trend",
    description:
      "Compare current month CTR vs prior month CTR by campaign. >20% decrease MoM is a flag.",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 3,
    condition: { type: "cpa-off-target" },
    thresholds: {
      ctr_mom_decrease: `>${SLE_THRESHOLDS.ctr_mom_decrease * 100}% MoM decrease`,
      diagnosis:
        "People ignoring the creative. Ad not grabbing attention or not relevant to audience.",
    },
  },
  {
    id: "d4-conversion-rate",
    label: "D4: Conversion Rate",
    description:
      "Check click volume vs purchase volume. Clicks stable or up but purchases down = landing page problem.",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 4,
    condition: { type: "cpa-off-target" },
    thresholds: {
      pattern:
        "Clicks stable or up + purchases down = not an ads problem (landing page, booking flow, pricing, or offer)",
    },
  },
  {
    id: "d5-pattern-match",
    label: "D5: Pattern Match",
    description:
      "Combine signals from D1-D4 into a root cause diagnosis with targeted action items.",
    spineStep: null,
    parentStepId: "step1-decision-metrics",
    order: 5,
    condition: { type: "cpa-off-target" },
    thresholds: {
      creative_fatigue: "freq↑ + CTR↓ + CPA↑",
      audience_saturation: "CPM↑ + freq stable + CPA↑",
      landing_page_problem: "CTR stable + CVR↓ + CPA↑",
      growth_engine_broken:
        "Retargeting CPA good + prospecting CPA bad",
      attribution_inflation: "Meta purchases >> SLE bookings",
    },
  },
  {
    id: "step2-backend-verification",
    label: "Backend Verification",
    description:
      "Cross-reference Meta-reported purchases with actual SLE bookings, blended CAC, and MER.",
    spineStep: 2,
    order: 6,
    condition: { type: "phase2-placeholder" },
  },
  {
    id: "step3-campaign-structure",
    label: "Campaign Structure",
    description:
      "Evaluate active campaigns, budget distribution, spend concentration, and consolidation opportunities.",
    spineStep: 3,
    order: 7,
    condition: { type: "phase2-placeholder" },
  },
  {
    id: "step4-creative-health",
    label: "Creative Health",
    description:
      "Analyze ad-level performance, hook/hold rates, creative fatigue, and refresh needs.",
    spineStep: 4,
    order: 8,
    condition: { type: "phase2-placeholder" },
  },
  {
    id: "step5-audience-check",
    label: "Audience Check",
    description:
      "Review audience segment efficiency, geographic targeting, and demographic performance.",
    spineStep: 5,
    order: 9,
    condition: { type: "phase2-placeholder" },
  },
  {
    id: "step6-action-summary",
    label: "Action Items Summary",
    description:
      "Review and finalize all action items accumulated from the evaluation. Final edit pass before saving.",
    spineStep: 6,
    order: 10,
    condition: { type: "always" },
  },
];

export function resolveActiveSteps(
  cpaIsOffTarget: boolean,
): string[] {
  return META_ADS_EVALUATION_STEPS.filter((step) => {
    if (step.condition.type === "always") return true;
    if (step.condition.type === "cpa-off-target") return cpaIsOffTarget;
    if (step.condition.type === "phase2-placeholder") return false;
    return false;
  }).map((s) => s.id);
}

export function getStepDef(
  stepId: string,
): EvaluationStepDef | undefined {
  return META_ADS_EVALUATION_STEPS.find((s) => s.id === stepId);
}

export function getMainSpineSteps(): EvaluationStepDef[] {
  return META_ADS_EVALUATION_STEPS.filter((s) => s.spineStep !== null);
}

export function getDiagnosticSteps(): EvaluationStepDef[] {
  return META_ADS_EVALUATION_STEPS.filter(
    (s) => s.spineStep === null && s.condition.type === "cpa-off-target",
  );
}
