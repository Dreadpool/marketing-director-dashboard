# CardPointe Historical Data Ingestion

## Goal
Enable real YoY comparisons in the Monthly Analytics Review workflow by loading 2025 CardPointe authorization data into BigQuery.

## Context
- `cardpointe_settlements` table only has Jan-Mar 2026 data (from API backfill)
- 10 Excel authorization reports (March-December 2025) downloaded from CardPointe portal
- Authorization data (card swipes) differs from settlement data (money movement), but serves as a reasonable proxy for YoY comparison when settlement data doesn't exist
- No overlapping months exist between auth files and settlement data, so direct comparison is not possible

## Approach
1. Parse Excel files, filter to PROCESSED SALEs and PROCESSED/REFUNDED REFUNDs
2. Create `cardpointe_authorizations` table in BigQuery with transaction-level data
3. Update `getCardPointeSettlements()` to fall back to authorization aggregates for months without settlement data
4. Wire up YoY comparison logic in the fetch-monthly-analytics executor

## Data Flow
```
Excel files → Python script → BigQuery `cardpointe_authorizations`
                                        ↓
getCardPointeSettlements() checks settlements first → falls back to auth aggregates
                                        ↓
fetchMonthlyAnalytics() fetches prior-year data → computes YoY deltas
```

## Decision: Auth as Settlement Proxy
Since there are no overlapping months to compare, we accept authorization totals as a proxy for CC revenue in months where settlement data doesn't exist. The key filters:
- Include: PROCESSED SALEs (positive) and PROCESSED/REFUNDED REFUNDs (negative)
- Exclude: VOIDED, DECLINED, VERIFIED transactions (never settle)

## Status
- [x] Audit BigQuery settlement coverage (Jan-Mar 2026 only, no 2025 overlap)
- [x] Parse and load authorization data (89,920 rows, March-December 2025)
- [x] Update hybrid query (settlement first, auth fallback)
- [x] Wire YoY comparisons (prior-year fetch with Promise.allSettled)
