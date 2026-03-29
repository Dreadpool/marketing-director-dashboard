# References

## Source Files
- `~/Downloads/cardpointe reports-1 year of revenue and refunds/` - 10 xlsx authorization files (March-December 2025)
- `~/Downloads/cardpointe reports-1 year of revenue and refunds/MMC4062_Corporate_Account_Settlement (9).xlsx` - Corporate billing (separate concern)
- `~/Downloads/cardpointe reports-1 year of revenue and refunds/MMC4062_Corporate_Account_Settlement (10).xlsx` - Corporate billing (separate concern)

## Existing Code
- `~/workspace/sle/Monthly Analytics Review/scripts/backfill_cardpointe.py` - Existing API-based backfill (uses MERGE pattern)
- `src/lib/services/bigquery-sales.ts` - BigQuery sales service with `getCardPointeSettlements()`
- `src/lib/workflows/executors/fetch-monthly-analytics.ts` - Monthly analytics executor (hardcodes YoY to 0)
- `src/lib/schemas/sources/monthly-analytics.ts` - `MasterMetricsComparison` type (already has YoY fields)

## BigQuery Coverage
- `cardpointe_settlements`: Jan 2026, Feb 2026, Mar 2026 only
- Authorization files: March 2025 through December 2025
- No overlapping months between the two sources
