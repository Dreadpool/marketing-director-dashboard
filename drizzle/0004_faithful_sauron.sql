CREATE TABLE "interview_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"brief_markdown" text NOT NULL,
	"artifact_html" text NOT NULL,
	"reliability_notes" jsonb,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_description" text NOT NULL,
	"segment_criteria" jsonb NOT NULL,
	"questions_guide" jsonb NOT NULL,
	"reward_loyalty_points" integer NOT NULL,
	"response_threshold" integer NOT NULL,
	"state" varchar(20) DEFAULT 'draft' NOT NULL,
	"invites_sent" integer DEFAULT 0 NOT NULL,
	"responses_completed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"ready_at" timestamp,
	"analyzed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "interview_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"token" varchar(40) NOT NULL,
	"customer_id" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_name" text,
	"customer_profile" jsonb,
	"status" varchar(20) DEFAULT 'invited' NOT NULL,
	"transcript" jsonb,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	CONSTRAINT "interview_responses_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "interview_artifacts" ADD CONSTRAINT "interview_artifacts_campaign_id_interview_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."interview_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_responses" ADD CONSTRAINT "interview_responses_campaign_id_interview_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."interview_campaigns"("id") ON DELETE no action ON UPDATE no action;