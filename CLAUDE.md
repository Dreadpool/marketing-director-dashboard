# Marketing Director Dashboard

## Product Vision

A workflow orchestration dashboard that surfaces the right marketing tasks at the right time, pre-loaded with the right data and AI context. Not a BI tool. The product knows what analysis needs to happen when, pulls data automatically, and provides Claude-powered AI pre-loaded with workflow-specific frameworks.

Built first for Salt Lake Express (SLE) marketing operations. Designed to support other organizations as a SaaS product in the future.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Base Nova)
- **Backend**: Next.js API Routes + Server Actions (no separate backend)
- **Database**: Neon Postgres via Drizzle ORM (app state only)
- **Data Source of Truth**: BigQuery (sales, customers, revenue)
- **AI**: Claude Haiku 4.5 via Anthropic SDK (workflow analysis steps)
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Fonts**: Space Grotesk (headings), IBM Plex Sans (body)
- **Colors**: oklch color system, dark theme default, gold accent
- **UI**: Premium design using shadcn/ui components. No generic layouts.

## Commands

- `npm run dev` -- Start dev server (Turbopack)
- `npm run build` -- Production build
- `npm run lint` -- Run ESLint
- `npx drizzle-kit generate` -- Generate DB migrations
- `npx drizzle-kit push` -- Push schema to database

## Environment Variables

- `GOOGLE_APPLICATION_CREDENTIALS` -- Path to BigQuery service account JSON
- `BIGQUERY_PROJECT_ID` -- GCP project ID (default: `jovial-root-443516-a7`)
- `BIGQUERY_DATASET` -- BigQuery dataset (default: `tds_sales`)
- `META_ACCESS_TOKEN` -- Meta Ads system user token (never expires, `ads_read` scope)
- `META_AD_ACCOUNT_ID` -- Meta Ad Account ID (default: `act_1599255740369627`)
- `GOOGLE_ADS_DEVELOPER_TOKEN` -- Google Ads API developer token
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` -- Google Ads manager account ID (default: `4381990003`)
- `GOOGLE_ADS_CUSTOMER_ID` -- Google Ads client account ID (default: `7716669181`)
- `POSTGRES_URL` -- Neon Postgres connection string
- `ANTHROPIC_API_KEY` -- Anthropic API key (Haiku 4.5 for workflow steps)

## Roadmap

### Completed
- [x] Shared metric schema (types, transformers, normalized interfaces)
- [x] BigQuery data service + dashboard KPI wiring
- [x] Data source status page (`/settings/data-sources`)
- [x] Platform API services (Meta Ads + Google Ads clients)
- [x] Workflow engine foundation (scheduler, state in Neon Postgres, step-based execution)
- [x] First workflow end-to-end (Monthly Analytics Review)
- [x] Fetch step review experience (rich metric visualization)
- [x] Historical CardPointe data ingestion (2025 auth data loaded to BigQuery, 89,920 rows)

### In Progress

### Up Next
- [ ] Revenue Metric Overhaul: Gross Bookings as primary KPI (spec complete, see `specs/2026-03-27-revenue-metric-overhaul/`)
- [ ] Manual marketing spend entry (non-platform costs for complete CAC)
- [ ] Historical analysis archive (snapshot completed runs for instant historical access)
- [ ] AI chat panel with real Claude integration (replace mock chat)
- [ ] Remaining 4 workflows: Meta Ads Analysis, Google Ads Analysis, BigQuery Sales Analysis, SEO Ranking Analysis

### Ideas
- Context-aware chat for historical runs (inject archived run data into chat context)
- SaaS multi-tenancy
- Corporate account settlement investigation (see roadmap notes in specs/)
- Rebook detection via fuzzy matching (same email + similar route within N days)
- Data visualization component library refresh

## Architecture Decisions

- 2026-03-24: BigQuery is single source of truth. Platform ads are supplementary, not authoritative. BigQuery = `isGroundTruth: true`.
- 2026-03-24: No Kafka/Spark. Data volumes are modest, all sources are pull-based REST APIs. Simple server-side fetch.
- 2026-03-24: Neon Postgres for app state only. Never duplicate source data.
- 2026-03-24: `Promise.allSettled()` for multi-source fetching. BigQuery required, ad platforms optional.
- 2026-03-27: Gross Bookings as primary revenue KPI (not CardPointe net). Aligns with travel industry standard, avoids double-counting reschedules. CardPointe used for cross-validation only. Full rationale in `specs/2026-03-27-revenue-metric-overhaul/`.

## Structure

- `src/app/` -- App Router pages and API routes
- `src/components/layout/` -- Shell (sidebar, chat panel, top bar)
- `src/components/ui/` -- shadcn/ui components
- `src/components/workflows/` -- Workflow UI (step progress, prompt editor, charts, action items)
- `src/components/motion/` -- Animation wrappers (Framer Motion)
- `src/db/` -- Drizzle ORM schema and client (Neon Postgres)
- `src/lib/schemas/` -- Shared metric schema (types per source, transformers, normalized interfaces)
- `src/lib/schemas/sources/` -- Raw row types per API
- `src/lib/schemas/transformers/` -- One transformer per source, normalizes to shared types
- `src/lib/services/` -- Data services (BigQuery, Meta Ads, Google Ads). Each has `testConnection()` + `getMonthlyData(period)`.
- `src/lib/workflows/` -- Workflow engine, executors, prompts, cadence logic
- `specs/` -- Feature specifications (historical reference)
- `drizzle/` -- Generated SQL migrations

## Routes

- `/` -- Dashboard (KPI cards from BigQuery + Meta + Google)
- `/workflows` -- Workflow list with cadence badges and due status
- `/workflows/[slug]` -- Workflow detail (run, view results, edit prompts)
- `/action-items` -- Centralized action items across all workflows
- `/calendar` -- Calendar view of upcoming/due workflows
- `/settings/data-sources` -- Data source connection status
- API: `/api/dashboard`, `/api/data-sources`, `/api/workflows/[slug]/run`, `/api/workflows/[slug]/runs`, `/api/workflows/[slug]/runs/[runId]`, `/api/workflows/[slug]/steps/[stepId]/prompt`, `/api/workflows/calendar`, `/api/action-items`

## Conventions

### Code Patterns
- Tailwind CSS only (no vanilla CSS beyond globals.css)
- shadcn/ui for all base components
- Dark theme default (class="dark" on html)
- Framer Motion for animations
- oklch color system via CSS custom properties
- Gold accent: `text-gold`, `bg-gold`, `bg-gold/10`

### Data Patterns
- Every normalized metric includes `DataProvenance` (source, fetchedAt, dateRange, isGroundTruth)
- Raw source data normalized through transformer functions (`src/lib/schemas/transformers/`)
- Never use raw source types outside the transformer
- Division-by-zero guards on all calculated fields
- BigQuery: parameterized queries (`@start_date`) to prevent injection

### API Route Pattern
- Every handler wrapped in try-catch
- Error responses: `{ error: string }` with status code
- Dynamic params: `params: Promise<{}>` (Next.js 15)
- ISR caching (4hr) for read-heavy routes, `force-dynamic` for writes/long-running

### Workflow Engine
- 3 step types: `fetch` → `analyze` → `recommend`
- Fetch calls data services via `Promise.allSettled` (BigQuery required, platforms optional)
- AI steps call Claude Haiku 4.5 with editable framework prompts (stored in Postgres, fallback in `src/lib/workflows/prompts/`)
- Each step's output chains into next via `previousStepOutputs`
- Step failures don't abort the run (partial results allowed)
- Action items parsed from recommend step: `ACTION:`, `PRIORITY:`, `CATEGORY:` markers

### Adding a New Workflow
1. Add definition to `src/lib/workflows.ts` (slug, title, steps, cadence)
2. Create executor in `src/lib/workflows/executors/` implementing `FetchExecutor`
3. Create default prompts in `src/lib/workflows/prompts/`
4. Register executor in `executors/index.ts`

## Data Sources

| Source | API | Data | Ground Truth |
|--------|-----|------|-------------|
| BigQuery | @google-cloud/bigquery | Sales orders, customers, revenue, CardPointe | Yes |
| Meta Ads | facebook-nodejs-business-sdk | Campaign performance, creative, spend | No |
| Google Ads | google-ads-api (GAQL) | Campaign spend, search terms, geo | No |
| GA4 | googleapis | Sessions, traffic, conversions | No |
| Google Sheets | googleapis | Ad budgets, SEO rankings | No |

## Workflow Instructions

These instructions define how Claude should behave in this project. Follow them every session.

### On Session Start
- Read this CLAUDE.md to understand current project state.
- If a feature is "In Progress", brief the user: what's done, what remains.
- If nothing is in progress, tell the user what's next on the roadmap.

### Before Planning Any Feature
- Review the full Roadmap to understand how this feature fits into the product.
- Read Architecture Decisions for relevant prior choices.
- Scan existing code that this feature will interact with.
- Then proceed with brainstorming and planning, informed by this context.

### After Completing Any Feature
- Update the Roadmap: move the feature to "Completed" with today's date.
- Move the next "Up Next" feature to "In Progress" if the user wants to continue.
- Log any architecture decisions made during development.
- Note any impacts on upcoming features based on what was learned.
- Commit the updated CLAUDE.md.

### UI Verification
For features with UI changes: use the webapp-testing skill to visually verify in a browser before marking the feature complete. Do not rely only on unit tests for UI work.

### Skill Transparency
When activating any skill (Superpowers brainstorming, TDD, code review, webapp-testing, frontend-design, etc.), announce which skill you're using and why. This helps the user verify the full workflow is running.

### When the User Says "What's Next"
- Read the Roadmap.
- Present the next feature from "Up Next" with a brief description.
- Ask if they want to start on it or pick a different feature.
- Begin brainstorming for the chosen feature.
