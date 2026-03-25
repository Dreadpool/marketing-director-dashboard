# Marketing Director Dashboard

Workflow orchestration dashboard for marketing directors.
Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui.

## Commands

- `npm run dev` -- Start dev server (Turbopack)
- `npm run build` -- Production build
- `npm run lint` -- Run ESLint
- `npx drizzle-kit generate` -- Generate DB migrations
- `npx drizzle-kit push` -- Push schema to database

## Environment Variables

- `GOOGLE_APPLICATION_CREDENTIALS` -- Path to BigQuery service account JSON (local: `~/credentials/bigquery-service-account.json`)
- `BIGQUERY_PROJECT_ID` -- GCP project ID (default: `jovial-root-443516-a7`)
- `BIGQUERY_DATASET` -- BigQuery dataset (default: `tds_sales`)
- `META_ACCESS_TOKEN` -- Meta Ads system user token (never expires, `ads_read` scope)
- `META_AD_ACCOUNT_ID` -- Meta Ad Account ID (default: `act_1599255740369627`)
- `GOOGLE_ADS_DEVELOPER_TOKEN` -- Google Ads API developer token
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` -- Google Ads manager account ID (default: `4381990003`)
- `GOOGLE_ADS_CUSTOMER_ID` -- Google Ads client account ID (default: `7716669181`)
- `POSTGRES_URL` -- Neon Postgres connection string (for workflow state, action items, prompts)
- AI steps use `claude --print` CLI with local subscription auth. Requires Claude Code to be installed and authenticated (`claude login`). No API key needed. App runs locally (`npm run dev`), not deployed for AI features.

## Structure

- `src/app/` -- App Router pages and layouts
- `src/components/layout/` -- Shell layout (sidebar, chat panel, top bar)
- `src/components/ui/` -- shadcn/ui components
- `src/components/workflows/` -- Workflow UI components (step progress, prompt editor, etc.)
- `src/components/motion/` -- Animation wrappers (framer-motion)
- `src/db/` -- Drizzle ORM schema and client (Neon Postgres)
- `src/lib/` -- Utilities, types, workflow data, chat mock
- `src/lib/schemas/` -- Shared metric schema (types, transformers, normalized interfaces)
- `src/lib/services/` -- Data services (BigQuery, Meta Ads, Google Ads clients)
- `src/lib/workflows/` -- Workflow engine (executors, prompts, cadence logic)
- `agent-os/` -- Product docs, specs, standards
- `drizzle/` -- Generated SQL migrations

## Conventions

- Tailwind CSS only (no vanilla CSS files beyond globals.css)
- shadcn/ui for all base components
- Dark theme is default (class="dark" on html)
- Space Grotesk for headings (font-heading), IBM Plex Sans for body (font-sans)
- Framer Motion for animations
- oklch color system via CSS custom properties
- Gold accent color: `text-gold`, `bg-gold`, `bg-gold/10`

## Data Architecture

- BigQuery is the single source of truth for sales/customer data.
- Neon Postgres stores app state: workflow runs, step results, action items, editable prompts, period metrics snapshots.
- `@google-cloud/bigquery` queries run server-side in API routes.
- Next.js revalidation caches responses (4 hours for dashboard).
- `/settings/data-sources` shows connection status for the next marketing director.

## Workflow Engine

- Workflows have 4 step types: `fetch` → `analyze` → `explore` → `recommend`
- Fetch steps call data services (BigQuery, Meta, Google) via `Promise.allSettled`
- Analysis steps call Claude via `claude --print` CLI subprocess with editable framework prompts
- Each step's output chains into the next step's context
- Historical metrics from `period_metrics` table provide MoM/YoY comparison data
- Action items are parsed from the recommend step and stored with links back to source analysis

## Routes

- `/` -- Dashboard (KPI cards, fetches from BigQuery + Meta Ads + Google Ads)
- `/workflows` -- Workflow list with cadence badges and due status
- `/workflows/[slug]` -- Workflow detail (run analysis, view results, edit prompts)
- `/action-items` -- Centralized action items across all workflows
- `/calendar` -- Calendar view of upcoming/due workflows
- `/settings/data-sources` -- Data source connection status
- `/api/dashboard` -- Dashboard metrics API (BigQuery + platform ads)
- `/api/data-sources` -- Connection health check API
- `/api/workflows/[slug]/run` -- POST: execute a workflow
- `/api/workflows/[slug]/runs` -- GET: run history
- `/api/workflows/[slug]/runs/[runId]` -- GET: single run with step details
- `/api/workflows/[slug]/steps/[stepId]/prompt` -- GET/PUT: editable framework prompt
- `/api/workflows/calendar` -- GET: upcoming/due workflows
- `/api/action-items` -- GET: all action items, PATCH: toggle completion
