// src/lib/workflows/evaluations/types.ts

import type { MonthPeriod } from "@/lib/schemas/types";

// ─── Step Definition Types ──────────────────────────────────────────────────

export type EvaluationStepCondition =
  | { type: "always" }
  | { type: "cpa-off-target" }
  | { type: "phase2-placeholder" };

export type EvaluationStepDef = {
  id: string;
  label: string;
  description: string;
  /** Main spine step number (1-6) or null for diagnostic sub-steps */
  spineStep: number | null;
  /** For diagnostic sub-steps: parent spine step id */
  parentStepId?: string;
  /** Display order within the full step sequence */
  order: number;
  /** When this step should be included in the evaluation */
  condition: EvaluationStepCondition;
  /** Threshold criteria for AI evaluation */
  thresholds?: Record<string, string>;
};

// ─── Runtime Types ──────────────────────────────────────────────────────────

export type UserDecision = "agree" | "override";

export type UserResponse = {
  decision: UserDecision;
  overrideReason?: string;
};

export type EvaluationActionItem = {
  id?: string;
  text: string;
  priority: "critical" | "high" | "medium";
  owner: "agency" | "director" | "joint";
  stepId: string;
};

export type StepStatus =
  | "pending"
  | "active"
  | "completed"
  | "skipped"
  | "error";

export type EvaluationStepState = {
  stepId: string;
  status: StepStatus;
  data?: Record<string, unknown>;
  aiEvaluation?: string;
  userResponse?: UserResponse;
  actionItems?: EvaluationActionItem[];
  error?: string;
};

// ─── API Request/Response Types ─────────────────────────────────────────────

export type StartEvaluationRequest = {
  period: MonthPeriod;
};

export type StartEvaluationResponse = {
  runId: string;
  currentStep: PreparedStep;
};

export type PreparedStep = {
  stepId: string;
  label: string;
  description: string;
  spineStep: number | null;
  parentStepId?: string;
  order: number;
  data: Record<string, unknown>;
  aiEvaluation: string;
  suggestedActions: EvaluationActionItem[];
  totalSteps: number;
  completedSteps: StepDecisionSummary[];
  /** Step IDs for all steps in the current evaluation (including skipped) */
  allStepIds: string[];
};

export type StepDecisionSummary = {
  stepId: string;
  label: string;
  decision: UserDecision;
  overrideReason?: string;
  actionItems: EvaluationActionItem[];
};

export type RespondRequest = {
  decision: UserDecision;
  overrideReason?: string;
  actionItems: EvaluationActionItem[];
};

export type RespondResponse =
  | { done: false; nextStep: PreparedStep }
  | { done: true; runId: string; summary: EvaluationSummary };

export type EvaluationSummary = {
  runId: string;
  period: MonthPeriod;
  completedSteps: StepDecisionSummary[];
  allActionItems: EvaluationActionItem[];
};

// ─── Resume Types ───────────────────────────────────────────────────────────

export type ResumeEvaluationResponse =
  | { status: "none" }
  | { status: "in-progress"; runId: string; currentStep: PreparedStep }
  | { status: "completed"; runId: string; summary: EvaluationSummary };

// ─── Campaign Frequency Row (for D1 weekly frequency fetch) ─────────────────

export type CampaignFrequencyRow = {
  campaign_id: string;
  campaign_name: string;
  frequency: number;
  impressions: number;
  reach: number;
  date_start: string;
  date_stop: string;
};
