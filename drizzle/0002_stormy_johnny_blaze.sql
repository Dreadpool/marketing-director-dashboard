CREATE TABLE "creative_briefs" (
	"brief_id" text PRIMARY KEY NOT NULL,
	"cycle_id" text NOT NULL,
	"concept_name" text NOT NULL,
	"angle" text NOT NULL,
	"funnel_stage" text NOT NULL,
	"matrix_cell" text NOT NULL,
	"layout_archetype" text NOT NULL,
	"visual_direction" text NOT NULL,
	"primary_text" text NOT NULL,
	"headline" text NOT NULL,
	"description" text,
	"cta" text DEFAULT 'BOOK_TRAVEL' NOT NULL,
	"link_url" text NOT NULL,
	"hypothesis" text,
	"status" text DEFAULT 'proposed' NOT NULL,
	"meta_ad_id" text,
	"pushed_at" timestamp,
	"launched_at" timestamp,
	"resolved_at" timestamp,
	"spend" numeric,
	"cpa" numeric,
	"ctr" numeric,
	"frequency" numeric,
	"impressions" integer,
	"purchases" integer,
	"decision" text,
	"kill_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creative_cycle_metrics" (
	"cycle_id" text PRIMARY KEY NOT NULL,
	"briefs_total" integer NOT NULL,
	"briefs_resolved" integer NOT NULL,
	"winners" integer NOT NULL,
	"average" integer NOT NULL,
	"killed" integer NOT NULL,
	"avg_winner_cpa" numeric,
	"score" numeric,
	"total_spend" numeric,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creative_pipeline_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"cycle_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"agent_version" text,
	"inputs_loaded" jsonb,
	"briefs_generated" integer,
	"gate_results" jsonb,
	"metrics" jsonb,
	"status" text NOT NULL
);
