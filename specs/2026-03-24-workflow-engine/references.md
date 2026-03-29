# Workflow Engine - References

## Monthly Analytics Review (existing workflow)
- **Location**: `~/workspace/sle/Monthly Analytics Review/`
- **CLAUDE.md**: Complete workflow orchestration with 12 Python scripts
- **Calculation frameworks**: Revenue breakdown (CC + cash + credits), customer segmentation (new vs returning), CAC formula, payback ratio
- **Thresholds**: CAC <= $50 excellent, <= $100 good, > $100 high. Payback >= 3.0x positive, LTV:CAC >= 5:1 excellent.
- **Output**: `master_metrics.json` with period, revenue, customers, marketing, payments, promos, comparisons

## Key Calculation Patterns
- **Revenue**: CC + Cash + Other + Account Credits (from BigQuery)
- **New Customers**: First purchase in target month (historical validation)
- **CAC**: Total Ad Spend / New Customers
- **Payback Ratio**: Avg New Customer Value / CAC
- **Revenue Components**: Customer count impact + spending change impact (MoM decomposition)
- **Suspicious promo activity**: > 6 uses per customer

## Data Services (already built)
- `src/lib/services/bigquery.ts` - Revenue, customers, segmentation
- `src/lib/services/meta-ads.ts` - Campaign insights (spend, clicks, impressions, purchases)
- `src/lib/services/google-ads.ts` - Campaign metrics (spend, clicks, conversions)
- `src/lib/schemas/transformers/` - Normalizers for each data source

## Obsidian Report Template
- **Location**: `~/Library/CloudStorage/GoogleDrive-brady.price91@gmail.com/My Drive/Obsidian/My Vault/salt lake express/Monthly Analytics review/`
- **Template v2**: Executive Summary, Revenue & Orders, Channel Performance, Customer Acquisition, CAC Analysis, Promo Analysis, Top Customers, Data Quality, Action Items
