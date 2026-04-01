import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  jsonb,
  boolean,
  timestamp,
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
