# Promo Code Analysis — Design Spec

## Context

SLE runs offline marketing campaigns (flyers at fairs, events, printed materials) with unique promo codes. The marketing director needs to evaluate whether each campaign was worth the investment: how many orders it drove, how many new customers it acquired, and whether the revenue justified the cost of printing and distribution. Today this requires running standalone scripts manually. This workflow brings that analysis into the dashboard with AI-powered interpretation.

Phase 1 (this spec): On-demand, user-triggered analysis for a single promo code.
Phase 2 (future): Automated analysis triggered by promo expiration dates.

## Workflow Definition

- **Slug:** `promo-code-analysis`
- **Status:** `active` (change from `coming-soon`)
- **Cadence:** `on-demand`
- **Data sources:** `bigquery`
- **Steps:** 2 steps (not the standard 3)
  - `fetch` — pull all orders with this promo code from BigQuery
  - `analyze` — Claude Haiku evaluates campaign effectiveness

No `recommend` step. The AI analysis provides the verdict directly.

## Input

The workflow accepts custom parameters instead of just a period:

- **promoCode** (required, string) — the promo code to analyze (e.g., "FAIR2026")
- **campaignCost** (optional, number) — cost of flyers, printing, distribution in dollars

Date range is auto-detected from the first and last order using the promo code in BigQuery. No user date input needed.

The period field (required by the engine for history storage) is derived from the last order date in the dataset. For example, if the last order using "FAIR2026" was on March 12, 2026, the period is `{ year: 2026, month: 3 }`. This means the run is stored under March 2026 in the history and period_metrics table.

## Engine Extension

The workflow engine needs a small extension to pass custom parameters to executors.

### Changes to existing code

**`FetchExecutor` type** (`src/lib/workflows/executors/index.ts`):
```
Before: (period: MonthPeriod) => Promise<Record<string, unknown>>
After:  (period: MonthPeriod, params?: Record<string, unknown>) => Promise<Record<string, unknown>>
```

**`workflowRuns` table** (`src/db/schema.ts`):
Add `inputParams: jsonb("input_params")` column to store the promo code and campaign cost with the run record.

**`initWorkflowRun()`** (`src/lib/workflows/engine.ts`):
Accept optional `params` argument, store in `inputParams` column.

**`executeWorkflowSteps()`** (`src/lib/workflows/engine.ts`):
Read `inputParams` from the run record, pass to executor as second argument.

**`POST /api/workflows/[slug]/run`** (`src/app/api/workflows/[slug]/run/route.ts`):
Accept optional `params` in request body, pass through to `initWorkflowRun()`.

These changes are backward-compatible. Existing workflows ignore the params argument.

## Fetch Executor

**File:** `src/lib/workflows/executors/fetch-promo-code.ts`

Accepts `MonthPeriod` (for engine compatibility) and `params: { promoCode: string, campaignCost?: number }`.

### BigQuery Queries (all parallel via Promise.allSettled)

1. **Promo orders** — all orders with `promotion_code = @promoCode` where `selling_company = 'Salt Lake Express'` and `activity_type IS NULL OR activity_type = 'Sale'`. Returns: order_id, purchaser_email, purchase_date, total_sale, amount_discounted, outbound_dep_city, outbound_arr_city, selling_agency, selling_agent.

2. **Customer first purchases** — for each email in the promo orders, look up `customer_first_order` to determine if this was their first purchase. Classifies each order as new or returning customer.

3. **Baseline AOV** — average order value for all SLE orders in the same date range WITHOUT a promo code. For comparison.

### Computed Metrics (PromoCodeMetrics type)

```typescript
interface PromoCodeMetrics {
  promoCode: string;
  dateRange: { start: string; end: string; days: number };

  // Headline KPIs
  totalOrders: number;
  grossRevenue: number;
  avgOrderValue: number;
  uniqueCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  newCustomerPct: number;
  ordersPerCustomer: number;

  // Discount impact
  totalDiscounted: number;
  avgDiscountPerOrder: number;
  baselineAov: number;  // AOV without promo in same period

  // Route distribution
  topRoutes: Array<{ route: string; orders: number; revenue: number }>;

  // Weekly usage (for bar chart)
  weeklyUsage: Array<{ weekLabel: string; weekStart: string; orders: number }>;

  // Channel breakdown
  channelBreakdown: {
    web: number;    // no selling_agent
    agent: number;  // has selling_agent
  };

  // ROI (only when campaignCost provided)
  campaignCost?: number;
  roi?: {
    revenueReturn: number;       // grossRevenue / campaignCost
    grossProfitReturn: number;   // (grossRevenue * 0.43) / campaignCost
    costPerAcquisition: number;  // campaignCost / newCustomers
    netProfit: number;           // (grossRevenue * 0.43) - campaignCost
  };

  // Metadata
  metadata: {
    generatedAt: string;
    provenanceNote: string;
  };
}
```

The 0.43 gross margin constant comes from the existing SLE unit economics (43% regular route margin).

## AI Analysis Prompt

**File:** `src/lib/workflows/prompts/promo-code-analysis.ts`

Single prompt for the `analyze` step. The system prompt instructs Claude Haiku to:

1. Open with a clear verdict: profitable, break-even, or unprofitable (based on gross profit return vs 1.0x threshold, or revenue data alone if no campaign cost)
2. Evaluate customer acquisition quality: new customer %, CPA vs SLE benchmarks ($9 on-target, $14 elevated)
3. Assess route/geographic concentration and what it implies about distribution
4. Analyze the usage timeline: ramp-up speed, peak, decay pattern
5. Note the discount impact: is the promo attracting higher or lower AOV than baseline?
6. Compare web vs agent channel usage

The prompt references SLE's unit economics (43% margin, $35.23 GP/order, $82 median order) for context.

Output format: structured prose paragraphs with bold lead-ins (Verdict, Customer acquisition, Route concentration, Usage pattern, Discount impact). No action item markers since there's no recommend step.

## UI Components

### Promo Code Input (in workflow-detail.tsx)

When `workflow.slug === "promo-code-analysis"`, replace the standard PeriodSelector with a custom input form:

- Text input for promo code (required, uppercased on submit)
- Dollar input for campaign cost with helper text "(flyers, printing, distribution)"
- "Run Analysis" button (gold accent)
- Subtext: "Date range auto-detected from usage data"

The input values are passed as `params` in the POST body to `/api/workflows/[slug]/run`.

### Fetch Summary Component

**File:** `src/components/workflows/promo-code-fetch-summary.tsx`

Custom visualization for `PromoCodeMetrics`, rendered when `stepType === "fetch"` and `workflowSlug === "promo-code-analysis"`.

Layout (top to bottom):
1. **Code badge + date range** — gold pill with code name, gray text with active dates and duration
2. **Headline KPI cards** — 4-column grid: Total Orders, Gross Revenue (with avg/order), New Customers (green, with new/returning %), Unique Customers (with orders/customer)
3. **Campaign ROI section** (conditional, gold border) — only renders when campaignCost is present. 4-column grid: Revenue Return (Nx), Gross Profit Return (Nx), Cost per Acquisition, Net Profit
4. **Two-column detail cards** — Discount Impact (total discounted, avg/order, AOV with promo, AOV baseline) and Top Routes (route name + order count, top 5)
5. **Weekly Usage bar chart** — Recharts BarChart with gold bars, week labels on x-axis

### Step Result Routing

In `step-result.tsx` (or `fetch-step-summary.tsx`), add a condition to render `PromoCodeFetchSummary` when the workflow slug is `promo-code-analysis`.

## Run History Display

Each past run in RunHistory shows the promo code from `inputParams` instead of just the period, so the director can see which codes they've analyzed before.

## File Changes Summary

| File | Change |
|------|--------|
| `src/db/schema.ts` | Add `inputParams` JSONB column to `workflowRuns` |
| `src/lib/workflows/executors/index.ts` | Update `FetchExecutor` type, register new executor |
| `src/lib/workflows/executors/fetch-promo-code.ts` | New file: promo code fetch executor |
| `src/lib/workflows/prompts/promo-code-analysis.ts` | New file: analyze prompt |
| `src/lib/workflows/prompts/index.ts` | Register promo code prompts |
| `src/lib/workflows/engine.ts` | Pass params to executor, store/read inputParams |
| `src/lib/workflows.ts` | Change status to "active", update to 2 steps (fetch + analyze) |
| `src/app/api/workflows/[slug]/run/route.ts` | Accept params in request body |
| `src/app/workflows/[slug]/workflow-detail.tsx` | Promo code input form (conditional) |
| `src/components/workflows/promo-code-fetch-summary.tsx` | New file: fetch results visualization |
| `src/components/workflows/fetch-step-summary.tsx` | Route to promo summary component |
| `drizzle/` | Generated migration for inputParams column |

## Verification

1. `npm run build` passes
2. `npx drizzle-kit push` applies the new column
3. Navigate to `/workflows/promo-code-analysis` — input form renders
4. Enter a known promo code, run analysis — fetch step completes with metrics
5. AI analysis step renders below fetch results
6. Enter a code with campaign cost — ROI section appears in fetch results
7. Enter a code with no orders in BigQuery — graceful empty state
8. Run history shows promo code label per run
9. Existing workflows (monthly-analytics, meta-ads) still work unchanged
