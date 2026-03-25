# Workflow Engine

## Context

The dashboard shell exists and data services are built (BigQuery, Meta Ads, Google Ads). The 5 workflow cards all say "Coming Soon." The next step is a workflow engine that turns days-to-weeks analysis into minutes-to-hours by combining structured frameworks with AI execution.

## The Three Layers

**Software Layer** — The framework that organizes multi-step workflows. Manages step sequencing, data flow between steps, state tracking, run history. Each step's output becomes the next step's input context.

**Context Layer** — The best possible context for each analysis step. Codified frameworks (e.g., "if CAC > $100, decompose by channel"), industry benchmarks, company-specific thresholds, historical comparisons, domain knowledge. Stored as editable prompts per step so users can refine the analysis process over time.

**AI Layer** — Claude uses the context + data to do the manual labor. Calculates metrics, detects patterns, follows decision trees, digs deeper into anomalies, generates prioritized action items. Not "summarize this data" but "follow this framework to analyze this data."

## How a Workflow Step Works

Each step in a workflow has:
- **Type**: `fetch` | `analyze` | `explore` | `recommend`
- **Framework prompt**: Structured instructions that guide Claude (editable, stored in DB)
- **Input**: Data from previous steps + fetched data
- **Output**: Structured results that feed into the next step

Example flow for Monthly Analytics Review:
1. **Fetch** — Pull BigQuery + Meta + Google data for the month
2. **Analyze** — Initial pass: revenue, customers, CAC, ROAS, promo codes. Follow the calculation framework. Flag anomalies.
3. **Explore** — Based on Step 2 findings, dig deeper. If CAC spiked, break down by channel. If revenue dropped, decompose into customer count vs AOV. Follow conditional exploration frameworks.
4. **Recommend** — Synthesize findings into prioritized action items with specific next steps. Compare to previous months. Surface questions the marketing director should investigate.

Each step can be re-run independently. The user can edit the framework prompt for any step if the analysis has gaps or they want different focus areas.

## Key Decisions

- **Vercel Postgres + Drizzle ORM** for persistence
- **Step-based execution** with per-step framework prompts (not a single monolithic prompt)
- **First workflow**: Monthly Analytics Review (4 steps: fetch → analyze → explore → recommend)
- **Don't touch the dashboard page** yet
- **Editable framework prompts** stored in DB per workflow step, seeded from Monthly Analytics Review project frameworks
- **Step output chains**: each step's output is injected as context into the next step
- **Historical metrics storage**: `period_metrics` table stores a snapshot after each run so future analyses get MoM/YoY comparisons automatically
- **Action items hub**: centralized view across all workflows, each item links back to the analysis step that produced it
- **Calendar planning**: upcoming/due workflows shown on a calendar view based on cadence + last run date

## Database Schema (Drizzle)

**`src/db/schema.ts`**

```
workflow_runs
├── id (uuid, PK)
├── workflow_slug (varchar, indexed)
├── period_year (integer)
├── period_month (integer)
├── status (varchar: pending | running | completed | failed)
├── started_at (timestamp)
├── completed_at (timestamp, nullable)
├── created_at (timestamp, default now)

workflow_step_runs
├── id (uuid, PK)
├── run_id (uuid, FK → workflow_runs.id)
├── step_id (varchar) — matches the step definition id
├── step_order (integer)
├── status (varchar: pending | running | completed | failed | skipped)
├── input_data (jsonb, nullable) — data fed into this step
├── output_data (jsonb, nullable) — structured results from this step
├── ai_output (text, nullable) — Claude's narrative output for this step
├── error (text, nullable)
├── started_at (timestamp, nullable)
├── completed_at (timestamp, nullable)

period_metrics
├── id (uuid, PK)
├── workflow_slug (varchar)
├── period_year (integer)
├── period_month (integer)
├── run_id (uuid, FK → workflow_runs.id) — which run produced these
├── metrics (jsonb) — normalized metrics snapshot (revenue, customers, ad spend, CAC, etc.)
├── created_at (timestamp, default now)
├── UNIQUE(workflow_slug, period_year, period_month)
  Stores a metrics snapshot per period so future analyses can compare MoM/YoY
  and detect trends without re-fetching historical data.

action_items
├── id (uuid, PK)
├── run_id (uuid, FK → workflow_runs.id)
├── step_id (varchar) — which step generated this
├── workflow_slug (varchar, indexed) — for cross-workflow action items view
├── period_year (integer) — for context when viewing action items
├── period_month (integer)
├── text (text)
├── priority (varchar: high | medium | low, nullable)
├── category (varchar, nullable) — e.g. "creative", "budget", "audience"
├── completed (boolean, default false)
├── created_at (timestamp, default now)
├── completed_at (timestamp, nullable)
  Action items link back to run_id + step_id so the user can jump
  directly to the analysis that generated the action item.

workflow_step_prompts
├── id (uuid, PK)
├── workflow_slug (varchar)
├── step_id (varchar)
├── framework_prompt (text) — the editable analysis framework
├── updated_at (timestamp, default now)
├── UNIQUE(workflow_slug, step_id)
```

## Critical Files

**Existing (read/modify):**
- `src/lib/workflows.ts` → expand Workflow type with steps, cadence, dataSources
- `src/app/workflows/[slug]/page.tsx` → replace placeholder with real workflow UI
- `src/app/workflows/page.tsx` → add last-run status, due indicators
- `package.json` → add drizzle-orm, @vercel/postgres, drizzle-kit

**New files:**
- `src/db/schema.ts` — Drizzle table definitions
- `src/db/index.ts` — Database client
- `drizzle.config.ts` — Drizzle Kit config
- `src/lib/workflows/types.ts` — WorkflowStep, StepType, RunStatus types
- `src/lib/workflows/engine.ts` — Step executor: runs steps sequentially, chains outputs
- `src/lib/workflows/cadence.ts` — Due date calculation from cadence + last run
- `src/lib/workflows/executors/fetch-monthly-analytics.ts` — Fetch step for Monthly Analytics
- `src/lib/workflows/prompts/monthly-analytics.ts` — Default framework prompts for each step
- `src/app/api/workflows/[slug]/run/route.ts` — POST: execute workflow
- `src/app/api/workflows/[slug]/runs/route.ts` — GET: run history
- `src/app/api/workflows/[slug]/steps/[stepId]/prompt/route.ts` — GET/PUT: editable step prompt
- `src/app/api/action-items/route.ts` — GET: all action items across workflows, PATCH: toggle complete
- `src/app/api/workflows/calendar/route.ts` — GET: upcoming/due workflows
- `src/app/workflows/[slug]/workflow-detail.tsx` — Client component
- `src/app/action-items/page.tsx` — Action items hub page
- `src/app/calendar/page.tsx` — Calendar/planning view

**Reference (read-only):**
- `~/workspace/sle/Monthly Analytics Review/CLAUDE.md` — Calculation instructions, frameworks
- `~/workspace/sle/Monthly Analytics Review/scripts/` — Calculation patterns

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-03-24-workflow-engine/` with:
- `plan.md` — This plan
- `shape.md` — Three-layer architecture, step-based execution model, framework prompt strategy
- `references.md` — Monthly Analytics Review structure, calculation frameworks

---

## Task 2: Set Up Vercel Postgres + Drizzle

1. `npm install drizzle-orm @vercel/postgres` and `npm install -D drizzle-kit`
2. Create `drizzle.config.ts` — dialect: postgresql, schema: `src/db/schema.ts`, dbCredentials: `POSTGRES_URL`
3. Create `src/db/index.ts` — Drizzle client using `@vercel/postgres`
4. Create `src/db/schema.ts` — Tables: `workflow_runs`, `workflow_step_runs`, `action_items`, `workflow_step_prompts`
5. Update CLAUDE.md with `POSTGRES_URL` env var
6. `npx drizzle-kit generate` to create initial migration

---

## Task 3: Workflow Types and Definitions

Create `src/lib/workflows/types.ts`:
- `StepType`: "fetch" | "analyze" | "explore" | "recommend"
- `WorkflowStepDef`: { id, label, description, type, dataSources? }
- `WorkflowCadence`: "monthly" | "quarterly" | "yearly" | "on-demand"

Update `src/lib/workflows.ts`:
- Add `cadence`, `dataSources`, `steps: WorkflowStepDef[]` to Workflow interface
- Define Monthly Analytics Review with 4 steps:
  1. `fetch` — "Fetch Data" — Pull from BigQuery, Meta, Google
  2. `analyze` — "Initial Analysis" — Revenue, customers, CAC, ROAS calculations and pattern detection
  3. `explore` — "Deep Exploration" — Dig into anomalies and drivers based on initial findings
  4. `recommend` — "Recommendations" — Prioritized action items with reasoning
- Set Monthly Analytics Review status to "active", others stay "coming-soon"

---

## Task 4: Workflow Engine (Step Executor)

Create `src/lib/workflows/engine.ts`:
- `executeWorkflow(slug, period)` — Main entry point
  1. Creates a `workflow_runs` row
  2. Creates `workflow_step_runs` rows for each step (all "pending")
  3. Loads historical metrics from `period_metrics` for previous month and same month last year (for MoM/YoY context)
  4. Executes steps sequentially:
     - Updates step status to "running"
     - For `fetch` steps: calls the data executor, stores result as `output_data`
     - For `analyze`/`explore`/`recommend` steps: loads framework prompt from DB (or default), injects previous step outputs + historical metrics as context, calls Claude API, stores `ai_output` and `output_data`
     - Updates step status to "completed" (or "failed" with error)
  5. After the `recommend` step, parses action items from Claude's output and stores them in `action_items` with `workflow_slug`, `period_year`, `period_month` for cross-workflow querying
  6. After successful completion, upserts a `period_metrics` row with the key metrics snapshot from the fetch step
  7. Updates run status to "completed"
- Each step wraps in try/catch so a failed step doesn't crash the whole run

Create `src/lib/workflows/executors/fetch-monthly-analytics.ts`:
- Same `Promise.allSettled` pattern as current `/api/dashboard/route.ts`
- Returns normalized metrics object

---

## Task 5: Default Framework Prompts

Create `src/lib/workflows/prompts/monthly-analytics.ts` with default prompts seeded from the existing Monthly Analytics Review project:

**Step: analyze**
- Role and context (SLE marketing analyst)
- Metric calculation instructions (revenue breakdown, customer segmentation, CAC formula)
- Thresholds: CAC ≤$50 excellent, ≤$100 good, >$100 high
- Benchmarks: Payback ratio ≥3.0x positive, LTV:CAC ≥5:1 excellent
- Pattern detection: flag significant MoM changes (>10%), unusual promo activity
- Output format: structured sections with metrics and flags

**Step: explore**
- Conditional exploration frameworks:
  - If CAC increased >15%: break down spend by channel, identify inefficient campaigns
  - If revenue dropped: decompose into customer count change vs AOV change
  - If promo usage spiked: check for suspicious activity (>6 uses per customer)
  - If new customer ratio changed: investigate channel mix shift
- Dig into the "why" behind every flagged pattern from the analyze step

**Step: recommend**
- Prioritization framework (impact vs effort)
- Action item format: specific, measurable, with owner and timeline
- Categories: creative, budget, audience, channel, pricing
- Compare to previous month's action items if available
- Surface open questions the marketing director should investigate manually

Each prompt is seeded into `workflow_step_prompts` on first access if no row exists.

---

## Task 6: Workflow API Routes

**`POST /api/workflows/[slug]/run`**
- Body: `{ period: { year, month } }`
- Calls `executeWorkflow(slug, period)` from the engine
- Returns the run with all step results

**`GET /api/workflows/[slug]/runs`**
- Returns runs for this workflow (newest first) with step results and action items

**`GET /api/workflows/[slug]/runs/[runId]`**
- Returns a single run with full step details

**`GET /api/workflows/[slug]/steps/[stepId]/prompt`**
- Returns the current framework prompt for this step (from DB or default)

**`PUT /api/workflows/[slug]/steps/[stepId]/prompt`**
- Body: `{ frameworkPrompt: string }`
- Upserts the prompt in `workflow_step_prompts`

---

## Task 7: Workflow Detail Page UI

Replace `src/app/workflows/[slug]/page.tsx` placeholder.

**Layout:**

```
┌──────────────────────────────────────────────────────┐
│ ← Back to Workflows                                 │
│                                                      │
│ Monthly Analytics Review                  Monthly    │
│ Unified monthly report combining all sources...      │
│                                                      │
│ ┌──────────────┐  ┌──────────────────────────┐      │
│ │ Feb 2026  ▼  │  │  ▶ Run Analysis          │      │
│ └──────────────┘  └──────────────────────────┘      │
│                                                      │
│ ┌─ Progress ───────────────────────────────────┐    │
│ │ ✓ Fetch  →  ● Analyze  →  ○ Explore  →  ○   │    │
│ └──────────────────────────────────────────────┘    │
│                                                      │
│ ┌─ Step: Initial Analysis ─────────────────────┐    │
│ │                                               │    │
│ │  Revenue     Customers    Ad Spend     ROAS   │    │
│ │  $XX,XXX     XXX new      $X,XXX      X.Xx   │    │
│ │                                               │    │
│ │  ── Analysis ──────────────────────────────── │    │
│ │  [Claude's structured analysis for this step] │    │
│ │                                               │    │
│ │  ▸ Framework Prompt  [Edit]                   │    │
│ │                                               │    │
│ └───────────────────────────────────────────────┘    │
│                                                      │
│ ┌─ Step: Exploration ──────────────────────────┐    │
│ │  [Deeper analysis based on findings above]    │    │
│ │  ▸ Framework Prompt  [Edit]                   │    │
│ └───────────────────────────────────────────────┘    │
│                                                      │
│ ┌─ Step: Recommendations ──────────────────────┐    │
│ │  Action Items:                                │    │
│ │  ☐ High: Reduce Meta CPC by pausing...       │    │
│ │  ☐ Medium: Test new creative for...           │    │
│ │  ☐ Low: Review promo code usage...            │    │
│ │  ▸ Framework Prompt  [Edit]                   │    │
│ └───────────────────────────────────────────────┘    │
│                                                      │
│ ┌─ Run History ────────────────────────────────┐    │
│ │ Feb 2026  ✓ Completed  4 steps  2m 15s       │    │
│ │ Jan 2026  ✓ Completed  4 steps  1m 52s       │    │
│ └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

Key UI elements:
- Period selector (month/year)
- Run button with loading state
- Step progress bar (shows which step is currently executing)
- Per-step result cards that expand as each step completes
- Each step has a collapsible "Framework Prompt" editor
- Action items checklist from the recommend step
- Run history with expandable past results

Components:
- `src/app/workflows/[slug]/workflow-detail.tsx` — Main client component
- `src/components/workflows/step-progress.tsx` — Step progress indicator
- `src/components/workflows/step-result.tsx` — Individual step result display
- `src/components/workflows/prompt-editor.tsx` — Collapsible prompt editor
- `src/components/workflows/action-items.tsx` — Checklist with priority badges
- `src/components/workflows/period-selector.tsx` — Month/year picker
- `src/components/workflows/run-history.tsx` — Past runs list

---

## Task 8: Update Workflows List Page

Update `src/app/workflows/page.tsx`:
- Fetch latest run for each active workflow
- Show cadence badge ("Monthly")
- Show status: "Due", "Completed Feb 2026", "Coming Soon"
- Active workflows link to detail page, coming-soon stay inert

---

## Task 9: Action Items Hub

Create `src/app/action-items/page.tsx`:
- Shows all action items across all workflows, grouped by workflow or period
- Each item shows: text, priority badge, category, source workflow, period
- Click an item to navigate to the specific run + step that generated it (`/workflows/[slug]?run=[runId]&step=[stepId]`)
- Filter by: workflow, priority, completed/open, period
- Toggle completion inline

Create `GET /api/action-items` route:
- Query `action_items` table with optional filters (workflow_slug, completed, priority)
- Join with `workflow_runs` for period context
- Returns items newest first

Create `PATCH /api/action-items` route:
- Body: `{ id, completed }` — toggle action item completion

Add "Action Items" link to the sidebar (`src/components/layout/icon-sidebar.tsx`)

---

## Task 10: Calendar / Planning View

Create `src/app/calendar/page.tsx`:
- Monthly calendar view showing when workflows are due
- Based on cadence definitions + last completed run date
- Uses `src/lib/workflows/cadence.ts` for due date calculation:
  - Monthly workflows: due on the 1st of each month
  - Quarterly: due on the 1st of each quarter
  - Yearly: due Jan 1st
  - Shows as "overdue" if past due date without a completed run

Display:
- Calendar grid (current month, navigable)
- Workflow badges on due dates
- Color coding: overdue (red), due soon (gold), completed (green)
- Click a workflow badge to go to that workflow's detail page

Create `GET /api/workflows/calendar` route:
- Returns upcoming/due workflows for a date range
- Calculates due dates from cadence + latest completed run per workflow

Add "Calendar" link to the sidebar

---

## Task 11: Update Project Docs

- Update `agent-os/product/roadmap.md` — Mark steps 4 and 6 complete
- Update `CLAUDE.md` — Add `POSTGRES_URL`, new routes, updated structure, new pages

---

## Verification

- `npm run build` passes
- `npm run lint` passes
- `npx drizzle-kit generate` creates migration files
- Monthly Analytics Review workflow:
  1. Select a month, click "Run Analysis"
  2. Step 1 (fetch): pulls data from BigQuery + Meta + Google
  3. Step 2 (analyze): Claude follows the framework prompt to calculate and flag patterns
  4. Step 3 (explore): Claude digs deeper into flagged anomalies
  5. Step 4 (recommend): Claude generates prioritized action items
  6. All step results stored in Postgres
  7. Results visible in the step-by-step UI
- Edit a framework prompt → re-run → different analysis output
- Run a second month → analyze step receives previous month's metrics for MoM comparison
- Action items hub shows items across all workflows with links back to source analysis
- Calendar view shows upcoming/due workflows based on cadence
- Workflows list shows "Completed" status and cadence badges
- Sidebar has links to Action Items and Calendar pages
