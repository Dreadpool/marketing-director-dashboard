# Marketing Director Dashboard

## Product Vision

A workflow orchestration dashboard that surfaces the right marketing tasks at the right time, pre-loaded with the right data and AI context. Not a BI tool. The product knows what analysis needs to happen when, pulls data automatically, and provides Claude-powered AI pre-loaded with workflow-specific frameworks.

Built first for Salt Lake Express (SLE) marketing operations. Designed to support other organizations as a SaaS product in the future.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Base Nova)
- **Backend**: Next.js API Routes + Server Actions (no separate backend)
- **Database**: Neon Postgres via Drizzle ORM (app state only)
- **Data Source of Truth**: BigQuery (sales, customers, revenue)
- **AI**: Grok 4.1 Fast Reasoning via xAI API (workflow analysis steps)
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

- `GOOGLE_APPLICATION_CREDENTIALS` -- Path to BigQuery service account JSON (local dev)
- `GOOGLE_CREDENTIALS_JSON` -- Inline service account JSON string (deployment, e.g. Vercel)
- `BIGQUERY_PROJECT_ID` -- GCP project ID (default: `jovial-root-443516-a7`)
- `BIGQUERY_DATASET` -- BigQuery dataset (default: `tds_sales`)
- `META_ACCESS_TOKEN` -- Meta Ads system user token (never expires, `ads_read` scope)
- `META_AD_ACCOUNT_ID` -- Meta Ad Account ID (default: `act_1599255740369627`)
- `GOOGLE_ADS_DEVELOPER_TOKEN` -- Google Ads API developer token
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` -- Google Ads manager account ID (default: `4381990003`)
- `GOOGLE_ADS_CUSTOMER_ID` -- Google Ads client account ID (default: `7716669181`)
- `POSTGRES_URL` -- Neon Postgres connection string
- `XAI_API_KEY` -- xAI API key (Grok 4.1 Fast Reasoning for workflow steps)

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
- [x] Revenue Metric Overhaul: Gross Bookings as primary KPI in Monthly Analytics workflow
- [x] QuickBooks GL ad spend integration (replaced Google Sheets with BigQuery `quickbooks_gl.gl_transactions`)
- [x] Progressive workflow rendering (fetch results show immediately, AI steps fill in via polling)
- [x] Avg Customer Value rework (CardPointe actuals + TDS cash / unique customers, not new-customer-only)
- [x] YoY comparison badges on all 9 headline metric cards (color-coded: green=good, red=bad, muted=neutral)
- [x] QB GL pipeline: deduplicated table (587K→387K rows), fixed Cloud Function (batch loads), deployed rev 00005
- [x] Shared BigQuery client (`bigquery-client.ts`) with portable credentials (GOOGLE_CREDENTIALS_JSON for deployment)
- [x] Headline metrics restructured: Revenue row, Acquisition row, Efficiency row (CAC / Avg Customer Value / CAC:Value)
- [x] Removed Revenue Breakdown section (hidden pending TDS call) and Marketing Efficiency section (redundant)
- [x] Workflow cadence system: period-matched scheduling with per-workflow due dates (replaces timestamp-based isDue)
- [x] Calendar page: grid with dots on actual due dates + agenda timeline view
- [x] Workflow roster: 8 workflows (added Email Marketing, Creative/Content, Flyer/Event, Promo Code; removed BigQuery Sales)
- [x] AI chat panel closed by default
- [x] Meta Ads Analysis workflow: fetch executor (SDK-based, campaign + ad + audience breakdowns), CTC framework prompts, custom visualization (KPI cards, campaign table, creative/audience sections)
- [x] Apply 43% gross margin to CAC:Value ratio (regular routes, excludes grant-funded). Max CAC for 3:1 = $11.74.
- [x] Meta Ads CPA thresholds aligned with unit economics: $9/$14 (was $50/$75), ROAS floor 3.0x (was 2.0x), 1.3x over-attribution. Evaluation guide embedded.
- [x] Meta Ads Guided Evaluation Phase 1: Interactive step-by-step evaluation workflow (`meta-ads-evaluation`). New `guided-evaluation` workflow type with evaluation engine, wizard UI, per-step AI evaluation (Haiku 4.5), agree/override user decisions, editable action items with owner tags (Agency/Director/Joint). Phase 1 covers Step 1 (Decision Metrics + prospecting/retargeting CPA split) + CPA Diagnostic sub-flow (D1-D5: frequency, CPM trend, CTR trend, conversion rate, pattern match) + Step 6 (Action Items Summary). Steps 2-5 are Phase 2 placeholders. Design spec at `docs/superpowers/specs/2026-03-30-meta-ads-guided-evaluation-design.md`.
- [x] Meta Ads Dashboard: 3-level expandable hierarchy (Campaign → Ad Set → Ad). CampaignTable is the single tree table component. Ad set data fetched via `getAdSetInsights()` (4th parallel API call in executor). Ad rows use `colSpan={7}` flex layout with creative thumbnail placeholder, hook/hold rates, and inline fatigue signal badges. CTC composite pattern detection: `declining_ctr + campaign high_frequency = Creative Fatigue`, `rising_cpm + no high_frequency = Audience Saturation`. Backward compat via `?? []` fallback for historical runs without ad set/ad ID data.
- [x] Promo Code Analysis Phase 1: On-demand campaign ROI analysis (2026-04-01). User enters promo code + optional campaign cost (flyers, printing, distribution). Fetch executor queries BigQuery for all orders with code, classifies new/returning customers, computes route distribution, weekly usage, baseline AOV comparison, and ROI when cost provided. AI analysis via Haiku 4.5 with SLE benchmarks. Custom visualization with KPI cards, gold-bordered ROI section, route/discount detail cards, Recharts weekly usage chart. Engine extended with `inputParams` JSONB column for custom workflow parameters (backward-compatible). Design spec at `docs/superpowers/specs/2026-03-31-promo-code-analysis-design.md`.
- [x] MMC ridership data integration: Dashboard homepage pulls monthly route revenue/passenger KPIs from mmc-ridership-summaries API via `/api/mmc-report` proxy routes. KPI cards (total revenue, SLE revenue, interline revenue, passengers) with YoY deltas, per-route table with channel breakdown, YoY decomposition bars, manual refresh button, month selector.
- [x] Fix action_items insert: `parseActionItems` now normalizes priority to one of {critical, high, medium, low} (fallback truncates to varchar(10)) and clamps category to varchar(50) before insert, so long or unexpected AI output no longer crashes the recommend step (2026-04-09).
- [x] Ad Health Classification System (2026-04-09): encodes ad management expertise so a non-expert can evaluate the agency. Phase 1: per-ad and per-ad-set health verdicts (healthy/learning/watch/underperforming/kill) with prescribed actions, computed in pure classifier module `src/lib/workflows/classifiers/meta-ads-health.ts` using monthly aggregates. Thresholds from AdManage.ai Poisson kill framework (3x target CPA = $27 statistical floor), Meta creative fatigue research, and SLE unit economics. Colored badges render in CampaignTable at both ad and ad set levels with tooltips showing reason + prescribed action. Phase 2: on-demand daily trend fetching via new `/api/workflows/meta-ads-analysis/adset-daily` route and `getAdSetDailyInsights()` service function (time_increment=1, still 1 API call). New classifier `meta-ads-trends.ts` distinguishes "born bad" (never had a 3+ day performing period) from "dying" (was performing, now fatiguing). Analyze button on expanded ad set rows loads trends, shows rising/falling/flat arrows on CPA and CTR, upgrades HealthBadge with revised_health. Phase 3: step4-creative-health activated in guided evaluation with aggregated ad health summary feeding AI prompt for targeted action items. D1 frequency check reframed as data collection only (frequency alone is not a verdict, requires compound signal via D5). 100 tests, 8 commits.
- [x] Campaign table MoM inline deltas (2026-04-09): Stage column removed (Brady already knows funnel stages). Health badges moved to name cells. Prior month campaigns + ad sets fetched in parallel (+2 API calls). Percent change computed for spend (neutral/muted), CPA (inverse: rising=red), ROAS (default: rising=green), purchases (default). Changes < 5% shown as flat. No frequency delta. No ad-level deltas. MomDelta type on MetaAdsCampaignRow and MetaAdsAdSetRow.
- [x] Creative thumbnails + lightbox (2026-04-14): `getAdCreatives()` fetches ad creative image URLs via AdAccount.getAds() filtered by insight ad IDs (not currently active ads, which differ from historical). Prefers `image_url` (full res) over `thumbnail_url` (64x64). 40x40 thumbnail in ad name cell, click opens Dialog lightbox with full-size image + "View in Ads Manager" link. Shared `extractPurchases`/`extractRevenue` consolidated to `src/lib/schemas/transformers/meta-ads-actions.ts`. Build hash shown in sidebar via VERCEL_GIT_COMMIT_SHA forwarded through next.config.ts.

### In Progress

### Up Next
- [ ] Tune analysis + recommendations prompts (currently too opinionated, missing business context. Feed a user prompt before generating. Reform action item parsing.)
- [ ] Historical analysis archive (snapshot completed runs for instant historical access)
- [ ] AI chat panel with real Claude integration (replace mock chat)
- [ ] Google Ads Analysis workflow: Decision framework spec at `docs/superpowers/specs/2026-03-31-google-ads-decision-framework.md`. Phase 1 (Decision Metrics): brand/non-brand segmentation, CPA/ROAS thresholds, ground truth comparison. Phase 2 (Growth & Allocation): Impression Share, campaign categorization (Stars/Zombies/Bleeders). Phases 3-4 deferred. Framework: Vallaeys (Optmyzr) + Geddes (QS formula) + 3Q Digital (L/R Ratio).
- [x] SEO Ranking Analysis workflow: fetch executor (Google Sheets keyword data), visibility scoring, tier distribution, rank changes, biggest movers (2026-04-01)
- [ ] SEO Quick Wins workflow: GSC striking distance analysis (ranks 5-20, sorted by impressions) + CTR optimization (actual vs benchmark CTR by position). Data source: Google Search Console API. Framework: First Page Sage CTR benchmarks + universal practitioner consensus on striking distance methodology.
- [ ] Route Page Coverage Audit: Compare SLE route inventory against sitemap/page inventory. Identify city pairs with no dedicated landing page. Framework: Transit App case study (300→21,578 pages, +1,134% organic traffic), Eli Schwartz Product-Led SEO.
- [ ] SEO Content Gap Analysis: Keywords competitors (Wanderu, BusBud, Rome2Rio) rank for that SLE does not. Categorize by intent type. Data source: Ahrefs/Semrush API or CSV export. Framework: Ahrefs Content Gap tool, Kevin Indig competitive strategy.
- [ ] Local SEO Scorecard: GBP audit per SLE stop location (completeness, reviews, photos, NAP consistency). Framework: BrightLocal Local Search Ranking Factors 2025.
- [ ] Email Marketing Review workflow: fetch executor (email platform API TBD), open/click rates, list health, segmentation analysis
- [ ] Creative/Content Planning workflow: fetch executor (prior month performance + content calendar), theme identification, content calendar and creative briefs. **Context wiring:** Analyze and recommend steps should reference `~/workspace/sle/context/` -- brand voice from `brand-voice/sle-brandscript.md` (copy rules, always/never words, tone) and winning ad patterns from `ad-copy/`. The recommend step generates briefs in the SLE brand voice, not generic marketing copy.
- [ ] Flyer/Event Planning workflow: Fetch executor pulls from "Community Events & Relationship Opportunities" Google Calendar (calendarId: c_4839c82d86cf7237a72dbaaadaeeb753a3ec8732e8b055386e2bb7f025ff1eba@group.calendar.google.com) via domain-wide delegation on the BigQuery service account (bigquery-analysis-sa@jovial-root-443516-a7.iam.gserviceaccount.com). Admin prerequisite: Admin Console → Security → API Controls → Domain-wide Delegation → add service account with scope https://www.googleapis.com/auth/calendar.readonly, impersonating an SLE domain user. Shows upcoming events for the next 60-90 days, plus same-season events from the prior year with any linked post-event notes and promo results. AI analysis generates flyer briefs and event promotion plan. Context wiring: reference brand voice and ad copy patterns from ~/workspace/sle/context/.
- [ ] Post-Event Review loop: After an event date passes (or its promo code expires), surface a review prompt on the dashboard. User adds post-event notes and optionally links a promo code to trigger Promo Code Analysis for that event. Notes and promo run link stored on the calendar event via extendedProperties. Next year's Event Planning workflow reads this history to show "Last year's Spring Fling: 45 orders from SPRING25, notes: BYU flyers worked, skip USU." Calendar is the source of truth for events, no separate events table needed.
- [ ] Budget Spend Analysis workflow: Pull previous month's spend from QuickBooks GL data in BigQuery (`quickbooks_gl.gl_transactions`), break down by channel/category, compare against budget targets, flag overspend/underspend. Monthly cadence.
- [ ] Fix QuickBooks GL ad spend pipeline (currently broken, needs debugging)
- [ ] Customer Interview workflow: structured interview process, question templates, note capture, theme extraction across interviews, actionable insights summary
- [ ] Promo Code Analysis Phase 2: Automated analysis triggered by promo expiration dates, FTP fetch, route results to james.glass@saltlakeexpress.com
- [x] Meta Ads Dashboard: Expandable campaigns → ad sets (2026-03-31)
- [x] Meta Ads Dashboard: Expandable ad sets → ads with fatigue signals (2026-03-31)
 Ad set rows expand to show individual ads with creative preview, inline fatigue signals per CTC framework (freq↑ + CTR↓ + CPA↑ = creative fatigue, CPM↑ + freq stable + CPA↑ = audience saturation), hook/hold rates. Build the UI framework and fatigue signal logic even if ad-level data isn't fully wired yet.
- [ ] Meta Ads Dashboard: CPA and CTR trend sparklines per ad. Fetch daily insights per ad over the month (or ad lifetime within period). Show 7-day or 14-day trend direction (up/down/flat) for both CPA and CTR so rising CPA or declining engagement is visible at a glance. Same daily-insights infrastructure serves both metrics.
- [ ] Meta Ads Dashboard: Pull AOV (average order value) at campaign level. Show alongside CPA to contextualize efficiency.
- [ ] Meta Ads Dashboard: Tooltips for hook rate and hold rate. Hook rate = 3-second video views / impressions. Hold rate = thruplay / 3-second views. Explain what good/bad looks like.
- [ ] Meta Ads Dashboard: Creative preview thumbnails. Pull ad creative image/video thumbnail from Meta API and display inline in creative performance section.
- [ ] Meta Ads Dashboard: Show top 15 ads by spend (remove "highest CPA ads" section). Fatigue signals move from standalone section to inline per-ad in the expandable hierarchy.
- [ ] Meta Ads Guided Evaluation Phase 2: Add Steps 2-5 (Backend Verification, Campaign Structure, Creative Health, Audience Check) to the guided evaluation. Step 2 needs BigQuery cross-reference (Meta purchases vs actual bookings, blended CAC, MER). Steps 3-5 use existing fetched data with new evaluation logic. Design spec at `docs/superpowers/specs/2026-03-30-meta-ads-guided-evaluation-design.md`.
- [ ] Meta Ads Weekly Evaluation workflow: Lighter 6-check weekly workflow from CTC training guide "Weekly Agency Call Prep" section (CPA trends, prospecting vs retargeting, spend pacing, zombie campaigns, frequency + CPA correlation, prepare agency questions).
- [ ] Cohort LTV tracking: group customers by acquisition year, track cumulative revenue + repeat purchase rate at 12/24/36 months after first booking. Replaces guesswork in CPA targeting with real data. Instead of "assume customers book 3 times," you get "2022 cohort booked 2.4 times in 36 months at $58 avg ticket with 40% margin, so LTV = $55.68 and max CAC = $18.56." Reveals whether newer cohorts are rebooking at the same rate as older cohorts at the same lifecycle point, and whether scaling ads is degrading customer quality. Feeds directly into Meta Ads CPA targets and marketing budget decisions. Data: BigQuery sales_orders + customer_first_order. Baseline (2026-03-29): median LTV $92, avg $180, 42% repeat rate, 346K customers with 1+ year history.

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
- 2026-03-30: Period-matched scheduling replaces timestamp-based isDue. A run satisfies the period it was run FOR, not when it was run. Per-workflow due dates (1st, 3rd, 10th, 1st Monday). Cadence config in code, not DB. Full spec in `docs/superpowers/specs/2026-03-30-workflow-cadence-scheduling-design.md`.
- 2026-04-14: **GOTCHA: `periodMetrics` cache.** The workflow engine caches fetch step output in the `period_metrics` DB table (`engine.ts` line ~271). When `fetch-meta-ads.ts` (or any executor) changes, the cache serves STALE data. You must clear the cache after executor changes: `DELETE FROM period_metrics WHERE workflow_slug = 'meta-ads-analysis';`. A future fix: add a cache version key, or a "Force Refresh" checkbox on the Run Analysis button.

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
- AI steps call Grok 4.1 Fast Reasoning (xAI) with editable framework prompts (stored in Postgres, fallback in `src/lib/workflows/prompts/`)
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
| QuickBooks GL | @google-cloud/bigquery | Ad spend, operating expenses (quickbooks_gl dataset) | Yes |

## TDS Data Model (sales_orders)

Understanding of the `tds_sales.sales_orders` table, confirmed by querying BigQuery (2026-04-02). Pending TDS support ticket for open questions.

### Activity Types

Each `order_id` can have multiple rows with different `activity_type` values:
- **Sale** -- booking record with payment info (`payment_type_1..4`, `payment_amount_1..4`, `total_sale`)
- **Cancel** -- cancellation record with cancel fields (`canceled_outbound_fare`, `canceled_return_fare`, `canceled_baggage_fee`)
- **Void** -- marks order as void (payment never went through)
- **NULL** -- unknown meaning, treated as Sale in current code. Needs TDS confirmation.

### System Cutover (~Nov 2025)

TDS changed how records are stored. Three distinct eras in the data:

**Era 1: Pre-March 2025** -- `activity_type` field is NULL for all records (911K rows). No way to distinguish Sale/Cancel/Void. Treat as legacy.

**Era 2: Apr 2025 - Nov 4, 2025** -- Old system. `activity_type` populated (Sale, Cancel, Void). Voids create 3 records (Sale + Cancel + Void) all with positive `total_sale`.

**Era 3: Jan 29, 2026 - Present** -- New system. Voids create 1 record with negative `total_sale`. Cancels also have negative `total_sale` (sign convention changed).

**Gap: Nov 5, 2025 - Jan 28, 2026** -- ~3 months with zero Void records in either format. Voids during this period are unrecorded or handled differently.

| Month | Old Voids (3-record) | New Voids (1-record) | Cancel-only | Sales |
|-------|---------------------|---------------------|-------------|-------|
| Sep 2025 | 1,241 | 0 | 1,418 | 11,364 |
| Oct 2025 | 1,317 | 0 | 2,121 | 13,281 |
| Nov 2025 | 130 (Nov 1-4 only) | 0 | -- | -- |
| Dec 2025 | 0 | 0 | 2,993 | 13,854 |
| Jan 2026 | 0 | 530 | -- | -- |
| Feb 2026 | 0 | 4,309 | 1,830 | 8,929 |
| Mar 2026 | 0 | 5,313 | 1,710 | 10,830 |

### Key Findings from Data (2026-04-02)

1. **Sign convention changed.** Old system: Cancel and Void records have positive `total_sale`. New system: both have negative `total_sale`. Current code assumes positive values and subtracts. Needs review for new-system data.
2. **Void volume increased ~4x.** Old system: ~1,000-1,300 voids/month. New system: 4,300-5,300/month. Either genuinely more voids, or the new system records events as Void that the old system handled differently.
3. **Cancel amount fields are incomplete.** E.g., order 6750929: `total_sale = $99.95` but `canceled_outbound_fare = $97`. The ~$2.95 gap is likely fees/taxes not captured.
4. **Voided orders in old system** have `payment_type_1 = "Other"` (not a real payment method).
5. **`activity_type = NULL`** is historical only. 911K rows, all pre-March 2025. Zero NULLs from April 2025 onward.

### Open Questions (Pending TDS Ticket)

**Blockers:**
1. When a customer reschedules, does TDS create a Cancel on the old order + a new Sale? How do we distinguish true cancels from reschedule cancels?
2. Do `canceled_outbound_fare + canceled_return_fare + canceled_baggage_fee` capture the FULL cancel amount? What components are missing?
3. What is the difference between Void and Cancel? When is each used?
4. What triggers `previous_order`? Only reschedules? Date changes? Route changes?
5. Does `total_sale` always equal `SUM(payment_amount_1..4)`?
6. What does `activity_type = NULL` mean?

**Accuracy improvements:**
7. Can one leg of a round-trip be canceled independently (partial cancel)?
8. Are cancel amount fields stored as positive or negative numbers?
9. When a split-payment order is canceled, how is the refund allocated across payment methods?
10. What are "Customer Account Credit" and "Corporate Account" payment types? Does corporate cash eventually arrive via invoice?

### Known Code Issues (from 2026-04-02 audit)

1. `metrics-calculator.ts:233` -- Customer segmentation uses `row.total_sale` instead of `row.revenue_after_cancellations`. New/returning revenue ignores cancels.
2. `getCancelsByPaymentCategory` uses `ABS()` on cancel fields but `getCancelAmounts` does not. If cancel amounts are negative, `revenue_after_cancellations` is inflated.
3. Unique customers count includes rebook rows but gross bookings excludes them. Denominator mismatch for `revenue_per_customer` and `orders_per_customer`.
4. `revenue_variance` data quality check compares payment slot sums to `revenue_after_cancellations` (net) instead of `total_sale` (gross). Will always show variance equal to total cancels.

### Ad Hoc BigQuery Queries

To run ad hoc queries against BigQuery from this project:
```bash
GOOGLE_APPLICATION_CREDENTIALS="/Users/brady/credentials/bigquery-service-account.json" npx tsx -e "
const { BigQuery } = require('@google-cloud/bigquery');
const bq = new BigQuery({ projectId: 'jovial-root-443516-a7' });
async function main() {
  const [rows] = await bq.query({ query: \`SELECT ... FROM \\\`jovial-root-443516-a7.tds_sales.sales_orders\\\` LIMIT 10\` });
  for (const r of rows) console.log(JSON.stringify(r));
}
main().catch(console.error);
"
```

## Superpowers Development Workflow

Any feature or non-trivial change follows this sequence. No skipping steps.

### Workflow Sequence

1. **Brainstorm** → invoke `superpowers:brainstorming`
2. **Write spec** → brainstorming skill handles this (saves to `docs/superpowers/specs/`)
3. **Write plan** → invoke `superpowers:writing-plans`
4. **Implement** → invoke `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`
5. **Verify** → invoke `superpowers:verification-before-completion` (see project verification table below)
6. **Finish** → invoke `superpowers:finishing-a-development-branch`

For bugs, use `superpowers:systematic-debugging` instead of brainstorming.

### Project Verification Table

Build passing is NOT sufficient. Before claiming work is done:

| Change Type | Required Verification |
|-------------|----------------------|
| Any code change | `npm run build` + `npm test` |
| API route | `curl` the endpoint, check response |
| UI component | Load the page in browser, check for runtime errors |
| DB schema | `set -a && source .env.local && set +a && npx drizzle-kit push` against actual database |
| Subagent work | Independently verify changes, don't trust agent reports |

### On Session Start
- If a feature is "In Progress" on the Roadmap: brief what's done, what remains.
- If nothing is in progress: present the next "Up Next" item from the Roadmap.

### After Completing Any Feature
- Update the Roadmap (move to "Completed" with date).
- Log architecture decisions.
- Commit the updated CLAUDE.md.
