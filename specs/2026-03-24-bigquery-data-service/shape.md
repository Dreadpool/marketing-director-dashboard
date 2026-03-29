# BigQuery Data Service — Shaping Notes

## Scope

Connect the dashboard to BigQuery as the single source of truth. No intermediate database. Server-side queries via `@google-cloud/bigquery`, cached with Next.js ISR. Includes a data source status page so the next marketing director can diagnose connection issues.

## Problem

The dashboard has normalized types and transformers but no actual data flowing through them. The 4 KPI cards show "--". BigQuery holds all the ground truth data (revenue, orders, customers) via `vw_sle_active_orders` and `customer_first_order` views.

## Decisions

- **BigQuery direct, no Vercel Postgres.** Adding a cache DB creates a sync problem. BigQuery is already the source of truth. Next.js ISR handles caching.
- **Service account auth.** BigQuery credentials via `GOOGLE_APPLICATION_CREDENTIALS` env var pointing to a service account JSON. Standard GCP pattern.
- **Server components only.** BigQuery client runs server-side. No client-side API keys exposed.
- **ISR revalidation.** Dashboard data revalidates every 4 hours. Marketing metrics don't change minute-to-minute.
- **Graceful degradation.** If BigQuery is unreachable, dashboard shows last cached data with a stale-data warning. No blank screen.
- **Data source status page.** `/settings/data-sources` shows connection status, last successful fetch, and error messages. The next marketing director clicks here when things break.

## What's NOT in scope

- Meta Ads, Google Ads, GA4 direct connections (future specs)
- Google Sheets ad spend integration (future spec)
- Workflow data fetching (separate from dashboard KPIs)
- Auth/user management

## Architecture

```
Browser → Next.js Server Component (ISR cached)
           ↓
         src/lib/services/bigquery.ts (query + transform)
           ↓
         @google-cloud/bigquery → BigQuery API
           ↓
         vw_sle_active_orders, customer_first_order
```

## Queries Needed

1. **Monthly revenue summary** — total_sale, count orders, count unique customers from vw_sle_active_orders for a given month
2. **New vs returning customers** — JOIN with customer_first_order to segment by first_order_date within the period
3. **Connection test** — Simple `SELECT 1` to verify credentials work

## Key Risks

- BigQuery cold start latency (1-3s first query). ISR mitigates this for repeat visits.
- Service account key management on Vercel. Use Vercel environment variables, not committed files.
- The `vw_sle_active_orders` view must exist in the BigQuery dataset. If someone drops it, the dashboard breaks. The status page should surface this clearly.
