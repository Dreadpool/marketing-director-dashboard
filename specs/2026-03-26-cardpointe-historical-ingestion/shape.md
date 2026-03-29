# Shape: CardPointe Historical Data Ingestion

## New BigQuery Table

```sql
CREATE TABLE tds_sales.cardpointe_authorizations (
  transaction_id STRING NOT NULL,
  location STRING,
  auth_date TIMESTAMP,
  method STRING,        -- SALE, REFUND, FORCE, VERIFY
  cardholder_name STRING,
  card_brand STRING,    -- Visa, Mastercard, etc.
  last_four STRING,
  amount NUMERIC,       -- Negative for refunds
  auth_code STRING,
  status STRING,        -- PROCESSED, AUTHORIZED, VOIDED, etc.
  source_file STRING,
  loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Files Modified

| File | Change |
|------|--------|
| `scripts/load_cardpointe_authorizations.py` | New: parse Excel, load to BigQuery |
| `scripts/verify_cardpointe_auth_vs_settlement.py` | New: monthly totals from auth files |
| `src/lib/services/bigquery-sales.ts` | Update `getCardPointeSettlements()` with auth fallback |
| `src/lib/workflows/executors/fetch-monthly-analytics.ts` | Add prior-year fetch + YoY computation |

## Excel File Structure
Headers: Transaction #, Location, Date, Method, Name, Brand, Last 4, Amount, Auth Code, Status

Filter logic:
- SALE + PROCESSED → positive charge
- REFUND + (PROCESSED or REFUNDED) → negative amount (already negative in data)
- Skip: VOIDED, DECLINED, VERIFIED, AUTHORIZED-only
