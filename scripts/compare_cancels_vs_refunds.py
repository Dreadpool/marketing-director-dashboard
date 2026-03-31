"""
Test hypothesis: cancels WITHOUT a void record should match CardPointe refunds,
since voided orders never hit CardPointe.

Usage: python3 scripts/compare_cancels_vs_refunds.py
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


def fmt(val):
    return f"${val:,.2f}"


def run():
    print("=" * 100)
    print("Cancel Breakdown: With Void vs Without Void vs CardPointe Refunds")
    print("=" * 100)

    summary = []

    for start, end, label in MONTHS:
        # Break down cancels into those WITH a void and those WITHOUT
        row = list(client.query(f"""
            WITH cc_sales AS (
                SELECT order_id
                FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE DATE(purchase_date) BETWEEN '{start}' AND '{end}'
                  AND (activity_type = 'Sale' OR activity_type IS NULL)
                  AND selling_company = 'Salt Lake Express'
                  AND payment_type_1 IN {CC_TYPES}
            ),
            voided_orders AS (
                SELECT DISTINCT order_id
                FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE activity_type = 'Void'
                  AND order_id IN (SELECT order_id FROM cc_sales)
            ),
            all_cancels AS (
                SELECT
                    c.order_id,
                    ABS(COALESCE(c.canceled_outbound_fare, 0)) +
                    ABS(COALESCE(c.canceled_return_fare, 0)) +
                    ABS(COALESCE(c.canceled_baggage_fee, 0)) AS cancel_amount,
                    CASE WHEN v.order_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_void
                FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
                INNER JOIN cc_sales s ON c.order_id = s.order_id
                LEFT JOIN voided_orders v ON c.order_id = v.order_id
                WHERE c.activity_type = 'Cancel'
            )
            SELECT
                COUNT(*) AS total_cancels,
                COUNTIF(has_void) AS cancels_with_void,
                COUNTIF(NOT has_void) AS cancels_without_void,
                COALESCE(SUM(cancel_amount), 0) AS total_cancel_amt,
                COALESCE(SUM(CASE WHEN has_void THEN cancel_amount ELSE 0 END), 0) AS void_cancel_amt,
                COALESCE(SUM(CASE WHEN NOT has_void THEN cancel_amount ELSE 0 END), 0) AS refund_cancel_amt
            FROM all_cancels
        """).result())[0]

        # CardPointe refunds
        cp = list(client.query(f"""
            SELECT COALESCE(SUM(ABS(amount)), 0) AS total
            FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
            WHERE DATE(auth_date) BETWEEN '{start}' AND '{end}'
              AND method = 'REFUND'
              AND status IN ('PROCESSED', 'REFUNDED')
        """).result())[0]

        # Gross CC sales (excluding voids)
        gross = list(client.query(f"""
            WITH voided AS (
                SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE activity_type = 'Void'
            )
            SELECT COALESCE(SUM(total_sale), 0) AS total
            FROM `{PROJECT_ID}.{DATASET}.sales_orders`
            WHERE DATE(purchase_date) BETWEEN '{start}' AND '{end}'
              AND (activity_type = 'Sale' OR activity_type IS NULL)
              AND selling_company = 'Salt Lake Express'
              AND payment_type_1 IN {CC_TYPES}
              AND order_id NOT IN (SELECT order_id FROM voided)
        """).result())[0]

        # CardPointe gross charges
        cp_gross = list(client.query(f"""
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
            WHERE DATE(auth_date) BETWEEN '{start}' AND '{end}'
              AND method IN ('SALE', 'FORCE')
              AND status IN ('PROCESSED', 'PARTIALLY_REFUNDED')
        """).result())[0]

        total_cancels = int(row.total_cancels)
        with_void = int(row.cancels_with_void)
        without_void = int(row.cancels_without_void)
        total_cancel_amt = float(row.total_cancel_amt)
        void_amt = float(row.void_cancel_amt)
        refund_amt = float(row.refund_cancel_amt)
        cp_refunds = float(cp.total)
        gross_sales = float(gross.total)
        cp_charges = float(cp_gross.total)

        # Net calculations
        so_net = gross_sales - refund_amt  # gross minus only real refunds (no voids)
        cp_net = cp_charges - cp_refunds
        net_diff = so_net - cp_net
        net_pct = (net_diff / cp_net * 100) if cp_net != 0 else float("inf")

        refund_diff = refund_amt - cp_refunds
        refund_pct = (refund_diff / cp_refunds * 100) if cp_refunds != 0 else float("inf")

        print(f"\n{'─' * 100}")
        print(f"  {label}")
        print(f"{'─' * 100}")
        print(f"  Cancel breakdown:")
        print(f"    Total cancels:        {total_cancels:>6} records  {fmt(total_cancel_amt):>14}")
        print(f"    With void (failed):   {with_void:>6} records  {fmt(void_amt):>14}  <- never hit CardPointe")
        print(f"    Without void (real):  {without_void:>6} records  {fmt(refund_amt):>14}  <- should match CP refunds")
        print(f"  CardPointe refunds:                      {fmt(cp_refunds):>14}")
        print(f"  Refund diff (SO real - CP):              {fmt(refund_diff):>14} ({refund_pct:+.1f}%)")
        print(f"")
        print(f"  Net revenue comparison:")
        print(f"    SO: {fmt(gross_sales)} gross - {fmt(refund_amt)} real refunds = {fmt(so_net)} net")
        print(f"    CP: {fmt(cp_charges)} charges - {fmt(cp_refunds)} refunds = {fmt(cp_net)} net")
        print(f"    Diff: {fmt(net_diff)} ({net_pct:+.3f}%)")

        summary.append((label, gross_sales, refund_amt, so_net, cp_charges, cp_refunds, cp_net, net_diff, net_pct, void_amt, with_void, without_void))

    # Summary table
    print(f"\n\n{'=' * 100}")
    print("SUMMARY TABLE")
    print(f"{'=' * 100}")
    print(f"  {'Month':<10} | {'SO Gross':>12} | {'SO Refund':>12} | {'SO Net':>12} | {'CP Gross':>12} | {'CP Refund':>12} | {'CP Net':>12} | {'Net Diff':>12} | {'Diff%':>8}")
    print(f"  {'─'*10}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*8}")

    for label, sg, sr, sn, cg, cr, cn, nd, np, *_ in summary:
        print(f"  {label:<10} | {fmt(sg):>12} | {fmt(sr):>12} | {fmt(sn):>12} | {fmt(cg):>12} | {fmt(cr):>12} | {fmt(cn):>12} | {fmt(nd):>12} | {np:>+7.2f}%")

    # Totals
    tot_sg = sum(s[1] for s in summary)
    tot_sr = sum(s[2] for s in summary)
    tot_sn = sum(s[3] for s in summary)
    tot_cg = sum(s[4] for s in summary)
    tot_cr = sum(s[5] for s in summary)
    tot_cn = sum(s[6] for s in summary)
    tot_nd = tot_sn - tot_cn
    tot_np = (tot_nd / tot_cn * 100) if tot_cn != 0 else 0
    print(f"  {'─'*10}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*12}-+-{'─'*8}")
    print(f"  {'TOTAL':<10} | {fmt(tot_sg):>12} | {fmt(tot_sr):>12} | {fmt(tot_sn):>12} | {fmt(tot_cg):>12} | {fmt(tot_cr):>12} | {fmt(tot_cn):>12} | {fmt(tot_nd):>12} | {tot_np:>+7.2f}%")

    # Void breakdown
    print(f"\n  Void breakdown:")
    print(f"  {'Month':<10} | {'Void Cancels':>12} | {'Void Amount':>14} | {'Real Cancels':>12} | {'Real Amount':>14} | {'CP Refunds':>14} | {'Real vs CP':>12}")
    print(f"  {'─'*10}-+-{'─'*12}-+-{'─'*14}-+-{'─'*12}-+-{'─'*14}-+-{'─'*14}-+-{'─'*12}")
    for label, _, sr, _, _, cr, _, _, _, va, wv, wov in summary:
        rdiff = sr - cr
        print(f"  {label:<10} | {wv:>12} | {fmt(va):>14} | {wov:>12} | {fmt(sr):>14} | {fmt(cr):>14} | {fmt(rdiff):>12}")


if __name__ == "__main__":
    run()
