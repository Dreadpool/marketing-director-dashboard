# Shaping Notes: 6-Source Analysis

## Source-by-Source Analysis

### Meta Ads
- Spend: float USD
- Conversions: `actions` array with `action_type: "purchase"`, count in `value`
- Revenue: `action_values` array with `action_type: "purchase"`, dollar amount in `value`
- Attribution: 1d_click, 7d_click, 28d_click (default), 1d_view
- Budgets in cents (divide by 100)
- ROAS = purchase_value / spend (platform-only, inflated by retargeting)

### Google Ads
- Cost: `cost_micros` (divide by 1,000,000 for USD)
- CPC: also in micros
- Conversions: float, may be GA4 events not actual purchases
- Nested objects: campaign.name, metrics.cost_micros, etc.
- CTR already a percentage 0-100

### BigQuery (Ground Truth)
- Revenue: `total_sale` NUMERIC, direct decimal
- Use `vw_sle_active_orders` view (handles voids/cancels)
- Email normalization critical: LOWER(TRIM())
- activity_type: "Sale" (or NULL for legacy), "Cancel", "Void"
- Filter: selling_company = 'Salt Lake Express'
- Customer first order from `customer_first_order` view

### GA4
- Sessions, users, bounceRate (0-1 scale)
- Transactions, purchaseRevenue for e-commerce
- Dates in YYYYMMDD format
- Tracking unreliable before April 10, 2025
- Channel groups: "Organic Search", "Direct", "Paid Search", etc.

### Google Sheets (SEO)
- Keyword rankings: 1-100
- "OTR" and "0" = cap at rank 100
- Empty = null (not tracked)
- Ad spend by account name and amount

### Monthly Analytics (master_metrics.json)
- Pre-aggregated monthly data
- Contains revenue, customers, marketing, payment_methods, promotions, comparisons
- CAC = ad_spend / new_customers
- Ad spend data only available 2025+

## Overlapping Metrics

| Metric | Meta | Google | BigQuery | GA4 | Sheets | Monthly |
|--------|------|--------|----------|-----|--------|---------|
| Revenue | attributed | attributed | actual (truth) | attributed | - | actual |
| Conversions | pixel purchases | GA4 events | real orders | events | - | real orders |
| Spend | float USD | micros | - | - | float USD | float USD |
| Customers | - | - | email-based | user IDs | - | email-based |
| CPA/CAC | platform CPA | platform CPA | - | - | - | true CAC |

## Key Decisions

1. BigQuery = ground truth for revenue and customer counts
2. Platform-attributed revenue shown alongside but clearly labeled
3. Google Ads micros normalized at transformer level
4. GA4 data flagged as unreliable before April 2025
5. All money in USD, all percentages as decimals
