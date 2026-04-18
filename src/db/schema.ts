import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  jsonb,
  boolean,
  timestamp,
  numeric,
  unique,
} from "drizzle-orm/pg-core";

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowSlug: varchar("workflow_slug", { length: 100 }).notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  inputParams: jsonb("input_params"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workflowStepRuns = pgTable("workflow_step_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => workflowRuns.id),
  stepId: varchar("step_id", { length: 50 }).notNull(),
  stepOrder: integer("step_order").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  aiOutput: text("ai_output"),
  error: text("error"),
  userResponse: jsonb("user_response"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const periodMetrics = pgTable(
  "period_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowSlug: varchar("workflow_slug", { length: 100 }).notNull(),
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRuns.id),
    metrics: jsonb("metrics").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.workflowSlug, t.periodYear, t.periodMonth)],
);

export const actionItems = pgTable("action_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => workflowRuns.id),
  stepId: varchar("step_id", { length: 50 }).notNull(),
  workflowSlug: varchar("workflow_slug", { length: 100 }).notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  text: text("text").notNull(),
  priority: varchar("priority", { length: 10 }),
  category: varchar("category", { length: 50 }),
  owner: varchar("owner", { length: 20 }),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const workflowStepPrompts = pgTable(
  "workflow_step_prompts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workflowSlug: varchar("workflow_slug", { length: 100 }).notNull(),
    stepId: varchar("step_id", { length: 50 }).notNull(),
    frameworkPrompt: text("framework_prompt").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.workflowSlug, t.stepId)],
);

// Creative Pipeline Autoresearch
// Brief-level records (one row per concept per cycle).

export const creativeBriefs = pgTable("creative_briefs", {
  briefId: text("brief_id").primaryKey(),
  cycleId: text("cycle_id").notNull(),
  conceptName: text("concept_name").notNull(),
  angle: text("angle").notNull(),
  funnelStage: text("funnel_stage").notNull(),
  matrixCell: text("matrix_cell").notNull(),
  layoutArchetype: text("layout_archetype").notNull(),
  visualDirection: text("visual_direction").notNull(),
  primaryText: text("primary_text").notNull(),
  headline: text("headline").notNull(),
  description: text("description"),
  cta: text("cta").notNull().default("BOOK_TRAVEL"),
  linkUrl: text("link_url").notNull(),
  hypothesis: text("hypothesis"),
  status: text("status").notNull().default("proposed"),
  metaAdId: text("meta_ad_id"),
  pushedAt: timestamp("pushed_at"),
  launchedAt: timestamp("launched_at"),
  resolvedAt: timestamp("resolved_at"),
  spend: numeric("spend"),
  cpa: numeric("cpa"),
  ctr: numeric("ctr"),
  frequency: numeric("frequency"),
  impressions: integer("impressions"),
  purchases: integer("purchases"),
  decision: text("decision"),
  killReason: text("kill_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Cycle-level aggregate metrics.
export const creativeCycleMetrics = pgTable("creative_cycle_metrics", {
  cycleId: text("cycle_id").primaryKey(),
  briefsTotal: integer("briefs_total").notNull(),
  briefsResolved: integer("briefs_resolved").notNull(),
  winners: integer("winners").notNull(),
  average: integer("average").notNull(),
  killed: integer("killed").notNull(),
  avgWinnerCpa: numeric("avg_winner_cpa"),
  score: numeric("score"),
  totalSpend: numeric("total_spend"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Agent run observability (what the agent read, produced, gated on).
export const creativePipelineRuns = pgTable("creative_pipeline_runs", {
  runId: text("run_id").primaryKey(),
  cycleId: text("cycle_id").notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  agentVersion: text("agent_version"),
  inputsLoaded: jsonb("inputs_loaded"),
  briefsGenerated: integer("briefs_generated"),
  gateResults: jsonb("gate_results"),
  metrics: jsonb("metrics"),
  status: text("status").notNull(),
});
