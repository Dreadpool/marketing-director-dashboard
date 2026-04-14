# References

## BigQuery Schema
- Full schema docs: `~/workspace/sle/analytics/bigquery-data-analysis/CLAUDE.md`
- Key views: `vw_sle_active_orders` (net revenue after voids/cancels), `customer_first_order` (first order date per customer)
- Dataset: `tds_sales`

## Existing Transformers
- `src/lib/schemas/transformers/bigquery.ts` — `normalizeBigQueryData()` converts BigQueryPeriodSummary to normalized types
- `src/lib/schemas/transformers/monthly-analytics.ts` — `normalizeMonthlyAnalytics()` maps master_metrics.json to DashboardMetrics

## GCP Auth
- Service account JSON via `GOOGLE_APPLICATION_CREDENTIALS` env var
- BigQuery API: `@google-cloud/bigquery` npm package

## Shared Metric Schema
- Spec: `agent-os/specs/2026-03-24-shared-metric-schema/`
- Types: `src/lib/schemas/`
