# Workflow Cadence & Scheduling System

## Problem

The current scheduling system uses `completedAt` timestamps to determine if a workflow is due. This breaks in two ways:

1. Running a backfill (e.g., February's analysis on March 30) marks March as "not due" because `completedAt` is in March.
2. The badge shows the last completed period ("COMPLETED NOV 2025") with no awareness that Dec, Jan, Feb, Mar are all overdue.

The system has no concept of per-workflow due dates within a month. All workflows are treated as due on the 1st.

## Solution

Replace timestamp-based scheduling with **period-matched completion lookups**. A workflow is "due for February 2026" if no completed run exists with `periodYear=2026, periodMonth=2`. When you physically ran it is irrelevant.

Add **per-workflow due dates** so each workflow specifies when in the month its analysis should be completed.

## Workflow Roster

| Workflow | Cadence | Due Rule | Status |
|----------|---------|----------|--------|
| Monthly Analytics Review | Monthly | 10th | Active |
| Meta Ads Analysis | Monthly | 10th | Coming Soon |
| Google Ads Analysis | Monthly | 10th | Coming Soon |
| SEO Ranking Analysis | Monthly | 3rd | Coming Soon |
| Email Marketing Review | Monthly | 3rd | Coming Soon |
| Creative/Content Planning | Monthly | 1st | Coming Soon |
| Flyer/Event Planning | Monthly | 1st Monday | Coming Soon |
| Promo Code Analysis | On-demand | N/A | Coming Soon (future: event-triggered) |

**Removed:** BigQuery Sales Analysis (replaced by Promo Code Analysis).

**Promo Code Analysis future design (roadmap note):** Event-triggered cadence. Runs automatically when a promo code expires. FTP fetch nightly, auto-trigger on expiration. Some results go to marketing director, others to james.glass@saltlakeexpress.com. Separate design needed.

## Cadence Types

### Type Definition

Replace the string union with a structured type:

```typescript
type DueRule =
  | { type: "day-of-month"; day: number }
  | { type: "nth-weekday"; n: number; weekday: number } // 0=Sun, 1=Mon, ...
  | { type: "on-demand" };

type WorkflowCadence = {
  frequency: "monthly" | "quarterly" | "yearly" | "on-demand";
  dueRule: DueRule;
};
```

### Due Period vs Due Date

Two distinct concepts:

- **Due period**: The month being analyzed. For monthly workflows, this is always the previous month. On March 30, the due period is `{ year: 2026, month: 2 }` (February).
- **Due date**: The calendar date by which the analysis should be completed. For February's analysis with `day-of-month: 10`, the due date is March 10, 2026.

## Cadence Logic (cadence.ts rewrite)

Three pure functions replace the existing `isDue()` and `getNextDueDate()`:

### `getCurrentDuePeriod(workflow): { year: number; month: number }`

Returns the period that currently needs analysis.

- Monthly: previous month. March 30 returns `{ year: 2026, month: 2 }`.
- Quarterly: previous quarter's last month.
- Yearly: previous year's December.
- On-demand: returns null.

### `getDueDateForPeriod(workflow, period): Date`

Returns the calendar date when the analysis for a given period should be done.

- Takes the period's *next* month and applies the due rule.
- February period + `day-of-month: 10` = March 10, 2026.
- February period + `nth-weekday: 1st Monday` = first Monday of March 2026.

### `isPeriodSatisfied(completedRuns, period): boolean`

Pure lookup: does a completed `workflowRun` exist with matching `periodYear` and `periodMonth`?

No timestamp comparison. No `completedAt` logic.

### Helper: `getNthWeekday(year, month, n, weekday): Date`

Computes the nth occurrence of a weekday in a given month. Used by `getDueDateForPeriod` for `nth-weekday` rules.

## UI Changes

### Workflow List Badges (`/workflows`)

Badge shows the current obligation only:

- Gold: **"DUE FEB 2026"** — no completed run for the current due period
- Green: **"COMPLETED FEB 2026"** — completed run exists for the due period
- Muted: **"COMING SOON"** — workflow not active
- Muted: **"ON DEMAND"** — no automatic scheduling

The badge always references the period being analyzed, not when you did it or when it's due by.

### Calendar Page (`/calendar`)

Both grid and agenda views:

**Grid (top):**
- Colored dots on actual due dates (1st, 3rd, 10th, 1st Monday) instead of lumping on the 1st
- Gold dot = due for that period, green dot = completed
- Click a date to highlight its workflows in the agenda

**Agenda (below grid):**
- Vertical timeline grouped by date within the viewed month
- Each entry shows workflow name + status indicator
- Entries link to the workflow detail page

**Month navigation:** Already exists. Navigating months computes which workflows are due in the viewed month using `getDueDateForPeriod`.

### Workflow Detail Default Period

Period picker defaults to `getCurrentDuePeriod(workflow)` instead of the current calendar month. User can still select any period.

### Calendar API (`/api/workflows/calendar`)

Rewrite to use new cadence functions:

1. For each active workflow, compute `getCurrentDuePeriod()`
2. Query `workflowRuns` for a completed run matching that period
3. Return: `{ slug, title, status, duePeriod, dueDate, cadence }`

Accept optional `?year=&month=` query params so the calendar page can fetch data for any viewed month (computes which workflows have due dates falling in that month).

## Files to Change

| File | Change |
|------|--------|
| `src/lib/workflows/types.ts` | Replace `WorkflowCadence` string union with structured `DueRule` + `WorkflowCadence` types |
| `src/lib/workflows/cadence.ts` | Full rewrite: `getCurrentDuePeriod`, `getDueDateForPeriod`, `isPeriodSatisfied`, `getNthWeekday` |
| `src/lib/workflows.ts` | Update all workflow cadence configs to structured objects. Remove BigQuery Sales Analysis. Add Promo Code Analysis, Email Marketing Review, Creative/Content Planning, Flyer/Event Planning |
| `src/app/api/workflows/calendar/route.ts` | Use new cadence functions, period-matched DB lookup |
| `src/app/workflows/page.tsx` | Badge shows "DUE FEB 2026" / "COMPLETED FEB 2026" with period |
| `src/app/calendar/page.tsx` | Dots on real due dates, add agenda timeline below grid |
| `src/app/workflows/[slug]/workflow-detail.tsx` | Default period picker to `getCurrentDuePeriod()` |

**No database migrations.** No new tables. Everything computes from existing `workflowRuns.periodYear`/`periodMonth` + static cadence config.

## Verification

1. `npm run build` passes with new types
2. Workflow list page: Monthly Analytics Review shows "DUE FEB 2026" (or whatever the current due period is) instead of "COMPLETED NOV 2025"
3. Run February 2026 analysis. Badge changes to "COMPLETED FEB 2026". March remains the next due period when April arrives.
4. Run a backfill for October 2025. Badge still shows the current due period status, unaffected.
5. Calendar grid shows dots on correct due dates (1st, 3rd, 10th, 1st Monday) not all on the 1st
6. Calendar agenda view lists workflows grouped by due date
7. Opening workflow detail page pre-selects the current due period in the picker
