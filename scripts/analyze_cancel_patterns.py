"""
Analyze cancel record patterns to understand what distinguishes
a CC refund from a trip change/account credit.

Usage: python3 scripts/analyze_cancel_patterns.py
"""

import os
from google.cloud import bigquery

CREDENTIALS = os.path.expanduser("~/credentials/bigquery-service-account.json")
os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", CREDENTIALS)

PROJECT_ID = "jovial-root-443516-a7"
DATASET = "tds_sales"
client = bigquery.Client(project=PROJECT_ID)

CC_TYPES = "('Visa', 'Mastercard', 'American Express', 'Discover', 'Debit Card', 'BankCard')"


def q(sql):
    return list(client.query(sql).result())


def fmt(v):
    return f"${v:,.2f}"


# Use Aug 2025 as test month (gross matched within $36)
START, END, LABEL = "2025-08-01", "2025-08-31", "Aug 2025"

print(f"Analyzing cancel patterns for {LABEL}")
print("=" * 80)

# 1. Full vs partial cancels
print("\n--- Full cancel (amount = total_sale) vs Partial cancel ---")
rows = q(f"""
    WITH voided AS (
        SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE activity_type = 'Void'
    ),
    cc_sales AS (
        SELECT order_id, total_sale
        FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE DATE(purchase_date) BETWEEN '{START}' AND '{END}'
          AND (activity_type = 'Sale' OR activity_type IS NULL)
          AND selling_company = 'Salt Lake Express'
          AND payment_type_1 IN {CC_TYPES}
          AND order_id NOT IN (SELECT order_id FROM voided)
    ),
    cancels AS (
        SELECT c.order_id,
            ABS(COALESCE(c.canceled_outbound_fare, 0)) +
            ABS(COALESCE(c.canceled_return_fare, 0)) +
            ABS(COALESCE(c.canceled_baggage_fee, 0)) AS cancel_amount,
            s.total_sale
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
        INNER JOIN cc_sales s ON c.order_id = s.order_id
        WHERE c.activity_type = 'Cancel'
    )
    SELECT
        CASE WHEN ABS(cancel_amount - total_sale) < 1.0 THEN 'full_cancel' ELSE 'partial_cancel' END AS type,
        COUNT(*) AS cnt,
        SUM(cancel_amount) AS total
    FROM cancels
    GROUP BY type
""")
for r in rows:
    print(f"  {r.type}: {r.cnt} orders, {fmt(r.total)}")
print(f"  CP refunds: $12,900.27")

# 2. Cancel type by legs
print("\n--- Cancel by which legs were canceled ---")
rows = q(f"""
    WITH voided AS (
        SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE activity_type = 'Void'
    ),
    cc_sales AS (
        SELECT order_id, total_sale, outbound_fare, return_fare
        FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE DATE(purchase_date) BETWEEN '{START}' AND '{END}'
          AND (activity_type = 'Sale' OR activity_type IS NULL)
          AND selling_company = 'Salt Lake Express'
          AND payment_type_1 IN {CC_TYPES}
          AND order_id NOT IN (SELECT order_id FROM voided)
    ),
    cancels AS (
        SELECT c.order_id,
            COALESCE(c.canceled_outbound_fare, 0) AS c_out,
            COALESCE(c.canceled_return_fare, 0) AS c_ret,
            COALESCE(c.canceled_baggage_fee, 0) AS c_bag,
            s.total_sale, s.outbound_fare, s.return_fare
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
        INNER JOIN cc_sales s ON c.order_id = s.order_id
        WHERE c.activity_type = 'Cancel'
    )
    SELECT
        CASE
            WHEN c_out != 0 AND c_ret != 0 THEN 'both_legs'
            WHEN c_out != 0 THEN 'outbound_only'
            WHEN c_ret != 0 THEN 'return_only'
            WHEN c_bag != 0 THEN 'baggage_only'
            ELSE 'zero_amount'
        END AS cancel_type,
        COUNT(*) AS cnt,
        SUM(ABS(c_out) + ABS(c_ret) + ABS(c_bag)) AS cancel_total
    FROM cancels
    GROUP BY cancel_type
    ORDER BY cnt DESC
""")
for r in rows:
    print(f"  {r.cancel_type:15s}: {r.cnt:5d} cancels, {fmt(r.cancel_total)}")

# 3. Check previous_order field — do canceled orders get rebooked?
print("\n--- Canceled orders that have a replacement order (previous_order field) ---")
rows = q(f"""
    WITH voided AS (
        SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE activity_type = 'Void'
    ),
    cc_sales AS (
        SELECT order_id, total_sale
        FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE DATE(purchase_date) BETWEEN '{START}' AND '{END}'
          AND (activity_type = 'Sale' OR activity_type IS NULL)
          AND selling_company = 'Salt Lake Express'
          AND payment_type_1 IN {CC_TYPES}
          AND order_id NOT IN (SELECT order_id FROM voided)
    ),
    canceled_orders AS (
        SELECT DISTINCT c.order_id
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
        INNER JOIN cc_sales s ON c.order_id = s.order_id
        WHERE c.activity_type = 'Cancel'
    ),
    -- Check if any newer order references a canceled order as previous_order
    rebookings AS (
        SELECT previous_order, COUNT(*) as rebook_count
        FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE previous_order IS NOT NULL
          AND (activity_type = 'Sale' OR activity_type IS NULL)
          AND CAST(previous_order AS INT64) IN (SELECT order_id FROM canceled_orders)
        GROUP BY previous_order
    )
    SELECT
        COUNT(*) AS orders_with_rebooking,
        (SELECT COUNT(*) FROM canceled_orders) AS total_canceled_orders
    FROM rebookings
""")
for r in rows:
    print(f"  Total canceled CC orders: {r.total_canceled_orders}")
    print(f"  Of those, orders with a rebooking: {r.orders_with_rebooking}")

# 4. Check multiple cancel records per order (could indicate partial + full)
print("\n--- Orders with multiple cancel records ---")
rows = q(f"""
    WITH cc_sales AS (
        SELECT order_id
        FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE DATE(purchase_date) BETWEEN '{START}' AND '{END}'
          AND (activity_type = 'Sale' OR activity_type IS NULL)
          AND selling_company = 'Salt Lake Express'
          AND payment_type_1 IN {CC_TYPES}
          AND order_id NOT IN (
              SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
              WHERE activity_type = 'Void'
          )
    )
    SELECT
        cancel_count,
        COUNT(*) AS orders,
        SUM(total_cancel) AS total_amount
    FROM (
        SELECT c.order_id,
            COUNT(*) AS cancel_count,
            SUM(ABS(COALESCE(c.canceled_outbound_fare, 0)) +
                ABS(COALESCE(c.canceled_return_fare, 0)) +
                ABS(COALESCE(c.canceled_baggage_fee, 0))) AS total_cancel
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
        INNER JOIN cc_sales s ON c.order_id = s.order_id
        WHERE c.activity_type = 'Cancel'
        GROUP BY c.order_id
    )
    GROUP BY cancel_count
    ORDER BY cancel_count
""")
for r in rows:
    print(f"  {r.cancel_count} cancel records: {r.orders} orders, {fmt(r.total_amount)}")

# 5. Total cancel amount vs total_sale — is cancel > total_sale ever?
print("\n--- Cancel amount relative to total_sale ---")
rows = q(f"""
    WITH voided AS (
        SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE activity_type = 'Void'
    ),
    cc_sales AS (
        SELECT order_id, total_sale
        FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE DATE(purchase_date) BETWEEN '{START}' AND '{END}'
          AND (activity_type = 'Sale' OR activity_type IS NULL)
          AND selling_company = 'Salt Lake Express'
          AND payment_type_1 IN {CC_TYPES}
          AND order_id NOT IN (SELECT order_id FROM voided)
    ),
    cancel_totals AS (
        SELECT c.order_id,
            SUM(ABS(COALESCE(c.canceled_outbound_fare, 0)) +
                ABS(COALESCE(c.canceled_return_fare, 0)) +
                ABS(COALESCE(c.canceled_baggage_fee, 0))) AS total_cancel,
            s.total_sale
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
        INNER JOIN cc_sales s ON c.order_id = s.order_id
        WHERE c.activity_type = 'Cancel'
        GROUP BY c.order_id, s.total_sale
    )
    SELECT
        CASE
            WHEN ABS(total_cancel - total_sale) < 1.0 THEN 'exact_match'
            WHEN total_cancel > total_sale THEN 'cancel_exceeds_sale'
            WHEN total_cancel / total_sale > 0.9 THEN 'cancel_90_100pct'
            WHEN total_cancel / total_sale > 0.5 THEN 'cancel_50_90pct'
            WHEN total_cancel / total_sale > 0.1 THEN 'cancel_10_50pct'
            ELSE 'cancel_under_10pct'
        END AS bucket,
        COUNT(*) AS orders,
        SUM(total_cancel) AS cancel_amt,
        SUM(total_sale) AS sale_amt
    FROM cancel_totals
    GROUP BY bucket
    ORDER BY cancel_amt DESC
""")
for r in rows:
    print(f"  {r.bucket:25s}: {r.orders:5d} orders, cancel={fmt(r.cancel_amt)}, sale={fmt(r.sale_amt)}")

# 6. Key question: what if cancels that are partial (one leg only) are trip changes,
#    and the customer rebooked? These wouldn't be refunds.
#    Only full cancels (both legs or cancel = total_sale) would be actual refunds.
print("\n--- Hypothesis: Only full cancels are CC refunds ---")
rows = q(f"""
    WITH voided AS (
        SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE activity_type = 'Void'
    ),
    cc_sales AS (
        SELECT order_id, total_sale
        FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE DATE(purchase_date) BETWEEN '{START}' AND '{END}'
          AND (activity_type = 'Sale' OR activity_type IS NULL)
          AND selling_company = 'Salt Lake Express'
          AND payment_type_1 IN {CC_TYPES}
          AND order_id NOT IN (SELECT order_id FROM voided)
    ),
    cancel_totals AS (
        SELECT c.order_id,
            SUM(ABS(COALESCE(c.canceled_outbound_fare, 0)) +
                ABS(COALESCE(c.canceled_return_fare, 0)) +
                ABS(COALESCE(c.canceled_baggage_fee, 0))) AS total_cancel,
            s.total_sale
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
        INNER JOIN cc_sales s ON c.order_id = s.order_id
        WHERE c.activity_type = 'Cancel'
        GROUP BY c.order_id, s.total_sale
    )
    SELECT
        SUM(CASE WHEN ABS(total_cancel - total_sale) < 1.0 THEN total_cancel ELSE 0 END) AS full_cancel_total,
        SUM(CASE WHEN ABS(total_cancel - total_sale) >= 1.0 THEN total_cancel ELSE 0 END) AS partial_cancel_total,
        SUM(total_cancel) AS all_cancel_total
    FROM cancel_totals
""")
for r in rows:
    print(f"  Full cancels (cancel = total_sale):    {fmt(r.full_cancel_total)}")
    print(f"  Partial cancels (cancel < total_sale):  {fmt(r.partial_cancel_total)}")
    print(f"  All cancels:                            {fmt(r.all_cancel_total)}")
    print(f"  CP refunds:                             $12,900.27")
    print(f"  Full cancel vs CP refund diff:          {fmt(r.full_cancel_total - 12900.27)}")
