"""
Split cancel amounts into rebooked (trip change) vs not rebooked (potential refund).
Compare the non-rebooked amount against CardPointe refunds across all months.

Usage: python3 scripts/cancel_rebooking_split.py
"""

import os
from google.cloud import bigquery

CREDENTIALS = os.path.expanduser("~/credentials/bigquery-service-account.json")
os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", CREDENTIALS)

PROJECT_ID = "jovial-root-443516-a7"
DATASET = "tds_sales"
client = bigquery.Client(project=PROJECT_ID)

CC_TYPES = "('Visa', 'Mastercard', 'American Express', 'Discover', 'Debit Card', 'BankCard')"

MONTHS = [
    ("2025-03-01", "2025-03-31", "Mar 2025"),
    ("2025-04-01", "2025-04-30", "Apr 2025"),
    ("2025-05-01", "2025-05-31", "May 2025"),
    ("2025-06-01", "2025-06-30", "Jun 2025"),
    ("2025-07-01", "2025-07-31", "Jul 2025"),
    ("2025-08-01", "2025-08-31", "Aug 2025"),
    ("2025-09-01", "2025-09-30", "Sep 2025"),
    ("2025-10-01", "2025-10-31", "Oct 2025"),
    ("2025-11-01", "2025-11-30", "Nov 2025"),
    ("2025-12-01", "2025-12-31", "Dec 2025"),
]


def fmt(v):
    return f"${v:,.2f}"


print("=" * 110)
print("Cancel Split: Rebooked (trip change) vs Not Rebooked (potential refund) vs CardPointe Refunds")
print("=" * 110)

summary = []

for start, end, label in MONTHS:
    row = list(client.query(f"""
        WITH voided AS (
            SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
            WHERE activity_type = 'Void'
        ),
        cc_sales AS (
            SELECT order_id, total_sale
            FROM `{PROJECT_ID}.{DATASET}.sales_orders`
            WHERE DATE(purchase_date) BETWEEN '{start}' AND '{end}'
              AND (activity_type = 'Sale' OR activity_type IS NULL)
              AND selling_company = 'Salt Lake Express'
              AND payment_type_1 IN {CC_TYPES}
              AND order_id NOT IN (SELECT order_id FROM voided)
        ),
        cancel_amounts AS (
            SELECT c.order_id,
                SUM(
                    ABS(COALESCE(c.canceled_outbound_fare, 0)) +
                    ABS(COALESCE(c.canceled_return_fare, 0)) +
                    ABS(COALESCE(c.canceled_baggage_fee, 0))
                ) AS cancel_amount
            FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
            INNER JOIN cc_sales s ON c.order_id = s.order_id
            WHERE c.activity_type = 'Cancel'
            GROUP BY c.order_id
        ),
        -- Find orders that were rebooked (another order has previous_order pointing to them)
        rebooked AS (
            SELECT DISTINCT SAFE_CAST(REGEXP_REPLACE(previous_order, r'\\.0$', '') AS INT64) AS orig_order_id
            FROM `{PROJECT_ID}.{DATASET}.sales_orders`
            WHERE previous_order IS NOT NULL
              AND (activity_type = 'Sale' OR activity_type IS NULL)
        )
        SELECT
            COUNT(*) AS total_canceled,
            COUNTIF(r.orig_order_id IS NOT NULL) AS rebooked_count,
            COUNTIF(r.orig_order_id IS NULL) AS not_rebooked_count,
            COALESCE(SUM(ca.cancel_amount), 0) AS total_cancel_amt,
            COALESCE(SUM(CASE WHEN r.orig_order_id IS NOT NULL THEN ca.cancel_amount ELSE 0 END), 0) AS rebooked_amt,
            COALESCE(SUM(CASE WHEN r.orig_order_id IS NULL THEN ca.cancel_amount ELSE 0 END), 0) AS not_rebooked_amt
        FROM cancel_amounts ca
        LEFT JOIN rebooked r ON ca.order_id = r.orig_order_id
    """).result())[0]

    # CardPointe refunds
    cp = list(client.query(f"""
        SELECT
            COUNT(*) AS cnt,
            COALESCE(SUM(ABS(amount)), 0) AS total
        FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
        WHERE DATE(auth_date) BETWEEN '{start}' AND '{end}'
          AND method = 'REFUND'
          AND status IN ('PROCESSED', 'REFUNDED')
    """).result())[0]

    cp_refunds = float(cp.total)
    cp_count = int(cp.cnt)
    total_cancel = float(row.total_cancel_amt)
    rebooked = float(row.rebooked_amt)
    not_rebooked = float(row.not_rebooked_amt)
    diff = not_rebooked - cp_refunds
    pct = (diff / cp_refunds * 100) if cp_refunds > 0 else 0

    print(f"\n  {label}:")
    print(f"    Rebooked (trip changes):     {row.rebooked_count:5d} orders  {fmt(rebooked):>14}")
    print(f"    Not rebooked (potential ref): {row.not_rebooked_count:5d} orders  {fmt(not_rebooked):>14}")
    print(f"    CardPointe refunds:          {cp_count:5d} txns    {fmt(cp_refunds):>14}")
    print(f"    Not-rebooked vs CP diff:                        {fmt(diff):>14} ({pct:+.1f}%)")

    summary.append((
        label, row.total_canceled, row.rebooked_count, row.not_rebooked_count,
        total_cancel, rebooked, not_rebooked, cp_count, cp_refunds, diff, pct
    ))

# Summary table
print(f"\n\n{'=' * 110}")
print("SUMMARY: Non-rebooked cancel amount vs CardPointe refunds")
print(f"{'=' * 110}")
print(f"  {'Month':<10} | {'Cancels':>7} | {'Rebooked':>8} | {'Not Reb':>7} | {'Rebook $':>12} | {'Not Reb $':>12} | {'CP Refunds':>12} | {'Diff':>12} | {'Diff%':>8}")
print(f"  {'─'*10}-+-{'─'*7}-+-{'─'*8}-+-{'─'*7}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*8}")

for s in summary:
    label, total, rbc, nrbc, _, rb_amt, nrb_amt, _, cp_ref, diff, pct = s
    print(f"  {label:<10} | {total:>7d} | {rbc:>8d} | {nrbc:>7d} | {fmt(rb_amt):>12} | {fmt(nrb_amt):>12} | {fmt(cp_ref):>12} | {fmt(diff):>12} | {pct:>+7.1f}%")

# Totals
t_total = sum(s[1] for s in summary)
t_rbc = sum(s[2] for s in summary)
t_nrbc = sum(s[3] for s in summary)
t_rb_amt = sum(s[5] for s in summary)
t_nrb_amt = sum(s[6] for s in summary)
t_cp = sum(s[8] for s in summary)
t_diff = t_nrb_amt - t_cp
t_pct = (t_diff / t_cp * 100) if t_cp > 0 else 0
print(f"  {'─'*10}-+-{'─'*7}-+-{'─'*8}-+-{'─'*7}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*8}")
print(f"  {'TOTAL':<10} | {t_total:>7d} | {t_rbc:>8d} | {t_nrbc:>7d} | {fmt(t_rb_amt):>12} | {fmt(t_nrb_amt):>12} | {fmt(t_cp):>12} | {fmt(t_diff):>12} | {t_pct:>+7.1f}%")
