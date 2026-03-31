"""
Match CardPointe refund transactions to sales order cancel records
by customer name to identify which SO cancels are actual CC refunds.

Usage: python3 scripts/match_cp_refunds_to_so.py
"""

import os
from google.cloud import bigquery

CREDENTIALS = os.path.expanduser("~/credentials/bigquery-service-account.json")
os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", CREDENTIALS)

PROJECT_ID = "jovial-root-443516-a7"
DATASET = "tds_sales"
client = bigquery.Client(project=PROJECT_ID)

CC_TYPES = "('Visa', 'Mastercard', 'American Express', 'Discover', 'Debit Card', 'BankCard')"


def fmt(v):
    return f"${v:,.2f}"


# Test with Aug 2025
START, END, LABEL = "2025-08-01", "2025-08-31", "Aug 2025"

print(f"Matching CP refunds to SO cancels for {LABEL}")
print("=" * 100)

# Match by name: CP cardholder_name to SO purchaser_first_name + purchaser_last_name
rows = list(client.query(f"""
    WITH cp_refunds AS (
        SELECT
            ABS(amount) AS refund_amount,
            UPPER(TRIM(cardholder_name)) AS cp_name,
            auth_date
        FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
        WHERE DATE(auth_date) BETWEEN '{START}' AND '{END}'
          AND method = 'REFUND'
          AND status IN ('PROCESSED', 'REFUNDED')
    ),
    voided AS (
        SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE activity_type = 'Void'
    ),
    cc_sales_with_cancels AS (
        SELECT
            s.order_id,
            s.total_sale,
            UPPER(TRIM(CONCAT(COALESCE(s.purchaser_first_name, ''), ' ', COALESCE(s.purchaser_last_name, '')))) AS so_name,
            s.payment_type_1,
            ca.cancel_amount
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` s
        INNER JOIN (
            SELECT order_id,
                SUM(ABS(COALESCE(canceled_outbound_fare, 0)) +
                    ABS(COALESCE(canceled_return_fare, 0)) +
                    ABS(COALESCE(canceled_baggage_fee, 0))) AS cancel_amount
            FROM `{PROJECT_ID}.{DATASET}.sales_orders`
            WHERE activity_type = 'Cancel'
            GROUP BY order_id
        ) ca ON s.order_id = ca.order_id
        WHERE DATE(s.purchase_date) BETWEEN '{START}' AND '{END}'
          AND (s.activity_type = 'Sale' OR s.activity_type IS NULL)
          AND s.selling_company = 'Salt Lake Express'
          AND s.payment_type_1 IN {CC_TYPES}
          AND s.order_id NOT IN (SELECT order_id FROM voided)
    ),
    -- Try exact name match
    matched AS (
        SELECT
            sc.order_id,
            sc.so_name,
            cp.cp_name,
            sc.cancel_amount AS so_cancel,
            cp.refund_amount AS cp_refund,
            ABS(sc.cancel_amount - cp.refund_amount) AS amount_diff,
            sc.total_sale
        FROM cc_sales_with_cancels sc
        INNER JOIN cp_refunds cp ON sc.so_name = cp.cp_name
    )
    SELECT
        order_id, so_name, cp_name, so_cancel, cp_refund, amount_diff, total_sale
    FROM matched
    ORDER BY amount_diff ASC
    LIMIT 30
""").result())

print(f"\n--- Name-matched CP refunds to SO cancels (sorted by amount difference) ---")
print(f"  {'Order':>10} | {'Name':30s} | {'SO Cancel':>12} | {'CP Refund':>12} | {'Amt Diff':>10} | {'SO Total':>12}")
print(f"  {'─'*10}-+-{'─'*30}-+-{'─'*12}-+-{'─'*12}-+-{'─'*10}-+-{'─'*12}")
for r in rows:
    print(f"  {r.order_id:>10} | {r.so_name:30s} | {fmt(r.so_cancel):>12} | {fmt(r.cp_refund):>12} | {fmt(r.amount_diff):>10} | {fmt(r.total_sale):>12}")

# Summary stats on matching
stats = list(client.query(f"""
    WITH cp_refunds AS (
        SELECT
            ABS(amount) AS refund_amount,
            UPPER(TRIM(cardholder_name)) AS cp_name
        FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
        WHERE DATE(auth_date) BETWEEN '{START}' AND '{END}'
          AND method = 'REFUND'
          AND status IN ('PROCESSED', 'REFUNDED')
    ),
    voided AS (
        SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE activity_type = 'Void'
    ),
    cc_sales_with_cancels AS (
        SELECT
            s.order_id,
            s.total_sale,
            UPPER(TRIM(CONCAT(COALESCE(s.purchaser_first_name, ''), ' ', COALESCE(s.purchaser_last_name, '')))) AS so_name,
            ca.cancel_amount
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` s
        INNER JOIN (
            SELECT order_id,
                SUM(ABS(COALESCE(canceled_outbound_fare, 0)) +
                    ABS(COALESCE(canceled_return_fare, 0)) +
                    ABS(COALESCE(canceled_baggage_fee, 0))) AS cancel_amount
            FROM `{PROJECT_ID}.{DATASET}.sales_orders`
            WHERE activity_type = 'Cancel'
            GROUP BY order_id
        ) ca ON s.order_id = ca.order_id
        WHERE DATE(s.purchase_date) BETWEEN '{START}' AND '{END}'
          AND (s.activity_type = 'Sale' OR s.activity_type IS NULL)
          AND s.selling_company = 'Salt Lake Express'
          AND s.payment_type_1 IN {CC_TYPES}
          AND s.order_id NOT IN (SELECT order_id FROM voided)
    )
    SELECT
        (SELECT COUNT(*) FROM cp_refunds) AS total_cp_refunds,
        (SELECT SUM(refund_amount) FROM cp_refunds) AS total_cp_amount,
        (SELECT COUNT(DISTINCT cp.cp_name) FROM cp_refunds cp
         INNER JOIN cc_sales_with_cancels sc ON cp.cp_name = sc.so_name) AS matched_cp_names,
        (SELECT SUM(cp.refund_amount) FROM cp_refunds cp
         INNER JOIN cc_sales_with_cancels sc ON cp.cp_name = sc.so_name) AS matched_cp_amount,
        (SELECT COUNT(*) FROM cc_sales_with_cancels) AS total_so_cancels,
        (SELECT SUM(cancel_amount) FROM cc_sales_with_cancels) AS total_so_cancel_amount,
        (SELECT COUNT(DISTINCT sc.order_id) FROM cc_sales_with_cancels sc
         INNER JOIN cp_refunds cp ON sc.so_name = cp.cp_name) AS matched_so_orders,
        (SELECT SUM(sc.cancel_amount) FROM cc_sales_with_cancels sc
         WHERE sc.so_name IN (SELECT cp_name FROM cp_refunds)) AS matched_so_cancel_amount
""").result())

for r in stats:
    print(f"\n--- Matching Summary ---")
    print(f"  CP refunds:  {r.total_cp_refunds} txns, {fmt(float(r.total_cp_amount))}")
    print(f"  CP matched by name to SO cancel: {r.matched_cp_names} names, {fmt(float(r.matched_cp_amount or 0))}")
    cp_unmatched = float(r.total_cp_amount) - float(r.matched_cp_amount or 0)
    print(f"  CP unmatched: {fmt(cp_unmatched)}")
    print(f"")
    print(f"  SO cancels: {r.total_so_cancels} orders, {fmt(float(r.total_so_cancel_amount))}")
    print(f"  SO matched by name to CP refund: {r.matched_so_orders} orders, {fmt(float(r.matched_so_cancel_amount or 0))}")
    so_unmatched = float(r.total_so_cancel_amount) - float(r.matched_so_cancel_amount or 0)
    print(f"  SO unmatched (no CP refund): {fmt(so_unmatched)}")

# Check: SO cancels that DON'T match any CP refund — what are they?
print(f"\n--- SO cancels with NO matching CP refund name (sample) ---")
rows2 = list(client.query(f"""
    WITH cp_names AS (
        SELECT DISTINCT UPPER(TRIM(cardholder_name)) AS cp_name
        FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
        WHERE DATE(auth_date) BETWEEN '{START}' AND '{END}'
          AND method = 'REFUND'
    ),
    voided AS (
        SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
        WHERE activity_type = 'Void'
    ),
    cc_sales_with_cancels AS (
        SELECT
            s.order_id,
            UPPER(TRIM(CONCAT(COALESCE(s.purchaser_first_name, ''), ' ', COALESCE(s.purchaser_last_name, '')))) AS so_name,
            ca.cancel_amount,
            s.total_sale
        FROM `{PROJECT_ID}.{DATASET}.sales_orders` s
        INNER JOIN (
            SELECT order_id,
                SUM(ABS(COALESCE(canceled_outbound_fare, 0)) +
                    ABS(COALESCE(canceled_return_fare, 0)) +
                    ABS(COALESCE(canceled_baggage_fee, 0))) AS cancel_amount
            FROM `{PROJECT_ID}.{DATASET}.sales_orders`
            WHERE activity_type = 'Cancel'
            GROUP BY order_id
        ) ca ON s.order_id = ca.order_id
        WHERE DATE(s.purchase_date) BETWEEN '{START}' AND '{END}'
          AND (s.activity_type = 'Sale' OR s.activity_type IS NULL)
          AND s.selling_company = 'Salt Lake Express'
          AND s.payment_type_1 IN {CC_TYPES}
          AND s.order_id NOT IN (SELECT order_id FROM voided)
    )
    SELECT order_id, so_name, cancel_amount, total_sale,
           ROUND(cancel_amount / NULLIF(total_sale, 0) * 100, 1) AS cancel_pct
    FROM cc_sales_with_cancels
    WHERE so_name NOT IN (SELECT cp_name FROM cp_names)
    ORDER BY cancel_amount DESC
    LIMIT 15
""").result())

for r in rows2:
    print(f"  order {r.order_id}: {r.so_name:30s} cancel={fmt(r.cancel_amount)}, total={fmt(r.total_sale)}, cancel%={r.cancel_pct}%")
