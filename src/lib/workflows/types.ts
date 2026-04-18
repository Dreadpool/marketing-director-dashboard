import type { DataSource } from "@/lib/schemas/types";

export type StepType = "fetch" | "analyze" | "recommend" | "view" | "action";

export type DueRule =
  | { type: "day-of-month"; day: number }
  | { type: "nth-weekday"; n: number; weekday: number }
  | { type: "on-demand" };

export type WorkflowCadence = {
  frequency: "monthly" | "quarterly" | "yearly" | "on-demand";
  dueRule: DueRule;
};

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
