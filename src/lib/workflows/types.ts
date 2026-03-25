import type { DataSource } from "@/lib/schemas/types";

export type StepType = "fetch" | "analyze" | "explore" | "recommend";

export type WorkflowCadence =
  | "monthly"
  | "quarterly"
  | "yearly"
  | "on-demand";

export type WorkflowStepDef = {
  id: string;
  label: string;
  description: string;
  type: StepType;
  dataSources?: DataSource[];
};

export type RunStatus = "pending" | "running" | "completed" | "failed";

export type StepRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";
