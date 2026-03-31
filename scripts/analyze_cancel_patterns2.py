"""
Deeper analysis: what do CardPointe refunds look like in sales orders?
And what do sales order cancels actually represent?

Usage: python3 scripts/analyze_cancel_patterns2.py
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


START, END, LABEL = "2025-08-01", "2025-08-31", "Aug 2025"

print(f"Deep cancel analysis for {LABEL}")
print("=" * 90)

# 1. Do canceled orders have rebookings (previous_order links)?
print("\n--- Orders with previous_order pointing to a canceled order ---")
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
    ),
    canceled_orders AS (
        SELECT DISTINCT c.order_id
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
        INNER JOIN cc_sales s ON c.order_id = s.order_id
        WHERE c.activity_type = 'Cancel'
    ),
    rebookings AS (
        SELECT SAFE_CAST(REGEXP_REPLACE(previous_order, r'\\.0$', '') AS INT64) AS prev_id
        FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE previous_order IS NOT NULL
          AND (activity_type = 'Sale' OR activity_type IS NULL)
    )
    SELECT
        (SELECT COUNT(*) FROM canceled_orders) AS total_canceled,
        COUNTIF(co.order_id IN (SELECT prev_id FROM rebookings)) AS have_rebooking,
        COUNTIF(co.order_id NOT IN (SELECT prev_id FROM rebookings)) AS no_rebooking
    FROM canceled_orders co
""")
for r in rows:
    print(f"  Total canceled CC orders: {r.total_canceled}")
    print(f"  Have a rebooking (another order points back): {r.have_rebooking}")
    print(f"  No rebooking found: {r.no_rebooking}")

# 2. What does previous_order look like on cancel records?
print("\n--- Sample previous_order values on cancel records ---")
rows = q(f"""
    SELECT previous_order, COUNT(*) as cnt
    FROM `{PROJECT_ID}.{DATASET}.sales_orders`
    WHERE activity_type = 'Cancel'
      AND DATE(purchase_date) BETWEEN '{START}' AND '{END}'
      AND selling_company = 'Salt Lake Express'
    GROUP BY previous_order
    ORDER BY cnt DESC
    LIMIT 10
""")
for r in rows:
    print(f"  previous_order={r.previous_order!r}: {r.cnt} records")

# 3. Activity types overview for the month
print("\n--- All activity_type values and counts ---")
rows = q(f"""
    SELECT
        COALESCE(activity_type, 'NULL') AS act_type,
        COUNT(*) AS cnt,
        COALESCE(SUM(total_sale), 0) AS total_sale_sum
    FROM `{PROJECT_ID}.{DATASET}.sales_orders`
    WHERE DATE(purchase_date) BETWEEN '{START}' AND '{END}'
      AND selling_company = 'Salt Lake Express'
    GROUP BY act_type
    ORDER BY cnt DESC
""")
for r in rows:
    print(f"  {r.act_type:15s}: {r.cnt:6d} records, total_sale sum={fmt(r.total_sale_sum)}")

# 4. On cancel records, check what fields have data
print("\n--- Cancel record field analysis (non-null rates) ---")
rows = q(f"""
    SELECT
        COUNTIF(payment_type_1 IS NOT NULL) AS has_pt1,
        COUNTIF(payment_type_2 IS NOT NULL) AS has_pt2,
        COUNTIF(payment_amount_1 != 0) AS has_pa1,
        COUNTIF(payment_transaction_1 IS NOT NULL AND payment_transaction_1 != 0) AS has_ptx1,
        COUNTIF(total_sale != 0) AS has_total_sale,
        COUNTIF(fares IS NOT NULL AND fares != 0) AS has_fares,
        COUNTIF(previous_order IS NOT NULL) AS has_prev_order,
        COUNTIF(canceled_outbound_fare IS NOT NULL AND canceled_outbound_fare != 0) AS has_c_out,
        COUNTIF(canceled_return_fare IS NOT NULL AND canceled_return_fare != 0) AS has_c_ret,
        COUNTIF(canceled_baggage_fee IS NOT NULL AND canceled_baggage_fee != 0) AS has_c_bag,
        COUNT(*) AS total
    FROM `{PROJECT_ID}.{DATASET}.sales_orders`
    WHERE activity_type = 'Cancel'
      AND DATE(purchase_date) BETWEEN '{START}' AND '{END}'
      AND selling_company = 'Salt Lake Express'
""")
for r in rows:
    t = r.total
    print(f"  Total cancel records: {t}")
    print(f"  payment_type_1 populated:       {r.has_pt1:5d} ({r.has_pt1/t*100:.1f}%)")
    print(f"  payment_type_2 populated:       {r.has_pt2:5d} ({r.has_pt2/t*100:.1f}%)")
    print(f"  payment_amount_1 non-zero:      {r.has_pa1:5d} ({r.has_pa1/t*100:.1f}%)")
    print(f"  payment_transaction_1 non-zero: {r.has_ptx1:5d} ({r.has_ptx1/t*100:.1f}%)")
    print(f"  total_sale non-zero:            {r.has_total_sale:5d} ({r.has_total_sale/t*100:.1f}%)")
    print(f"  fares non-zero:                 {r.has_fares:5d} ({r.has_fares/t*100:.1f}%)")
    print(f"  previous_order populated:       {r.has_prev_order:5d} ({r.has_prev_order/t*100:.1f}%)")
    print(f"  canceled_outbound non-zero:     {r.has_c_out:5d} ({r.has_c_out/t*100:.1f}%)")
    print(f"  canceled_return non-zero:       {r.has_c_ret:5d} ({r.has_c_ret/t*100:.1f}%)")
    print(f"  canceled_baggage non-zero:      {r.has_c_bag:5d} ({r.has_c_bag/t*100:.1f}%)")

# 5. Look at cancel records where total_sale IS populated (not zero)
print("\n--- Cancel records with non-zero total_sale ---")
rows = q(f"""
    SELECT
        order_id, total_sale, payment_type_1, payment_amount_1,
        payment_type_2, payment_amount_2,
        canceled_outbound_fare, canceled_return_fare, canceled_baggage_fee,
        CAST(purchase_date AS STRING) as pd
    FROM `{PROJECT_ID}.{DATASET}.sales_orders`
    WHERE activity_type = 'Cancel'
      AND DATE(purchase_date) BETWEEN '{START}' AND '{END}'
      AND selling_company = 'Salt Lake Express'
      AND total_sale != 0
    LIMIT 20
""")
if rows:
    for r in rows:
        print(f"  order {r.order_id}: total_sale={r.total_sale}, pt1={r.payment_type_1}/{r.payment_amount_1}, "
              f"pt2={r.payment_type_2}/{r.payment_amount_2}, "
              f"c_out={r.canceled_outbound_fare}, c_ret={r.canceled_return_fare}")
else:
    print("  (none)")

# 6. For a few specific cancel orders, show ALL records (sale + cancel + void)
print("\n--- Sample orders: all activity records for canceled orders ---")
rows = q(f"""
    WITH sample_cancels AS (
        SELECT DISTINCT order_id
        FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE activity_type = 'Cancel'
          AND DATE(purchase_date) BETWEEN '{START}' AND '{END}'
          AND selling_company = 'Salt Lake Express'
        LIMIT 5
    )
    SELECT
        s.order_id, s.activity_type, s.total_sale,
        s.payment_type_1, s.payment_amount_1,
        s.payment_type_2, s.payment_amount_2,
        s.canceled_outbound_fare, s.canceled_return_fare, s.canceled_baggage_fee,
        s.outbound_fare, s.return_fare,
        s.previous_order,
        CAST(s.purchase_date AS STRING) as pd
    FROM `{PROJECT_ID}.{DATASET}.sales_orders` s
    WHERE s.order_id IN (SELECT order_id FROM sample_cancels)
    ORDER BY s.order_id, s.activity_type
""")
current_oid = None
for r in rows:
    if r.order_id != current_oid:
        print(f"\n  Order {r.order_id}:")
        current_oid = r.order_id
    at = r.activity_type or "NULL"
    if at == 'Cancel':
        print(f"    [{at}] c_out={r.canceled_outbound_fare}, c_ret={r.canceled_return_fare}, "
              f"c_bag={r.canceled_baggage_fee}, prev_order={r.previous_order}")
    else:
        print(f"    [{at}] total={r.total_sale}, out={r.outbound_fare}, ret={r.return_fare}, "
              f"pt1={r.payment_type_1}/{r.payment_amount_1}, pt2={r.payment_type_2}/{r.payment_amount_2}, "
              f"prev_order={r.previous_order}")

# 7. The big question: can we match CP refund amounts to SO cancel amounts?
print("\n\n--- CardPointe refund amounts (Aug 2025) ---")
rows = q(f"""
    SELECT amount, cardholder_name, CAST(auth_date AS STRING) as dt, method, status
    FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
    WHERE DATE(auth_date) BETWEEN '{START}' AND '{END}'
      AND method = 'REFUND'
    ORDER BY ABS(amount) DESC
    LIMIT 20
""")
print("  Top 20 CP refunds by amount:")
for r in rows:
    print(f"    {fmt(abs(float(r.amount)))} | {r.cardholder_name or 'NULL':30s} | {r.dt[:19]} | {r.status}")

# 8. Count CP refund amounts
rows = q(f"""
    SELECT
        COUNT(*) AS cnt,
        SUM(ABS(amount)) AS total
    FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
    WHERE DATE(auth_date) BETWEEN '{START}' AND '{END}'
      AND method = 'REFUND'
""")
for r in rows:
    print(f"\n  Total CP refunds: {r.cnt} transactions, {fmt(float(r.total))}")
