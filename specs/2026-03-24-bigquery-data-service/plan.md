# BigQuery Data Service — Implementation Plan

## Context

The dashboard has normalized types and transformers (from the shared-metric-schema spec) but no actual data. This spec connects BigQuery as the single source of truth and adds a data source status page for maintainability.

---

## Task 1: Install BigQuery Client

```bash
npm install @google-cloud/bigquery
```

Add env vars to `.env.local`:
- `GOOGLE_APPLICATION_CREDENTIALS` — path to service account JSON (local dev)
- `BIGQUERY_PROJECT_ID` — GCP project ID
- `BIGQUERY_DATASET` — dataset name (e.g. `tds_sales`)

---

## Task 2: BigQuery Service (`src/lib/services/bigquery.ts`)

Core service that wraps `@google-cloud/bigquery`:

- `getBigQueryClient()` — singleton client, reads credentials from env
- `testConnection()` — `SELECT 1` health check, returns `{ ok: boolean, error?: string, latencyMs: number }`
- `getMonthlyRevenueSummary(period: MonthPeriod)` — queries `vw_sle_active_orders` for total revenue, orders, unique customers, avg order value
- `getCustomerSegmentation(period: MonthPeriod)` — JOINs with `customer_first_order` to get new vs returning counts and revenue
- `getDashboardMetrics(period: MonthPeriod)` — combines the above two, runs through `normalizeBigQueryData()` transformer, returns partial `DashboardMetrics`

All queries filter `selling_company = 'Salt Lake Express'` and use `LOWER(TRIM())` on emails.

---

## Task 3: Wire Dashboard Page (`src/app/page.tsx`)

Convert to async server component:
- Fetch `getDashboardMetrics()` for the current month
- Pass normalized data to KPI cards
- Use Next.js `revalidate = 14400` (4 hours)
- If fetch fails, show stale indicator

---

## Task 4: Data Source Status Page (`src/app/settings/data-sources/page.tsx`)

Simple page showing:
- BigQuery connection status (calls `testConnection()`)
- Last successful data fetch timestamp
- Error messages if connection fails
- Instructions for the next marketing director on how to fix common issues (expired credentials, missing view)

---

## Task 5: Environment Setup Documentation

Update CLAUDE.md with:
- Required env vars
- How to set up a BigQuery service account
- How to configure on Vercel

---

## Verification

- `npm run build` passes
- Dashboard shows real revenue, customer, and order numbers from BigQuery
- `/settings/data-sources` shows BigQuery connection status
- Removing credentials shows graceful error state, not a crash
