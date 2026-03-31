"""
Compare CC revenue from sales_orders vs cardpointe_authorizations in BigQuery.
Tries every reasonable calculation variation to find the closest match.

Usage: python3 scripts/compare_sales_vs_cardpointe.py
"""

import os
from google.cloud import bigquery

CREDENTIALS = os.path.expanduser("~/credentials/bigquery-service-account.json")
os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", CREDENTIALS)

PROJECT_ID = "jovial-root-443516-a7"
DATASET = "tds_sales"

client = bigquery.Client(project=PROJECT_ID)

CC_TYPES = "('Visa', 'Mastercard', 'American Express', 'Discover', 'Debit Card', 'BankCard')"

# All months with full data: March 2025 - February 2026
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
    ("2026-01-01", "2026-01-31", "Jan 2026"),
    ("2026-02-01", "2026-02-28", "Feb 2026"),
]


def query(sql):
    """Run a query and return the first row."""
    result = client.query(sql).result()
    for row in result:
        return row
    return None


def fmt(val):
    """Format currency."""
    return f"${val:,.2f}"


def pct_diff(a, b):
    """Percentage difference between a and b."""
    if b == 0:
        return float("inf")
    return ((a - b) / b) * 100


def run_comparison():
    print("=" * 90)
    print("CC Revenue Comparison: Sales Orders vs CardPointe Authorizations")
    print("=" * 90)

    all_results = []

    for start, end, label in MONTHS:
        print(f"\n{'─' * 90}")
        print(f"  {label} ({start} to {end})")
        print(f"{'─' * 90}")

        # ── CardPointe Variations ──────────────────────────────────────

        # CP-A: Gross charges (SALE + FORCE)
        cp_a = query(f"""
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
            WHERE DATE(auth_date) BETWEEN '{start}' AND '{end}'
              AND method IN ('SALE', 'FORCE')
              AND status IN ('PROCESSED', 'PARTIALLY_REFUNDED')
        """)
        cp_charges = float(cp_a.total) if cp_a else 0

        # CP-B: Refunds
        cp_ref = query(f"""
            SELECT COALESCE(SUM(ABS(amount)), 0) AS total
            FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
            WHERE DATE(auth_date) BETWEEN '{start}' AND '{end}'
              AND method = 'REFUND'
              AND status IN ('PROCESSED', 'REFUNDED')
        """)
        cp_refunds = float(cp_ref.total) if cp_ref else 0
        cp_net = cp_charges - cp_refunds

        # CP-C: SALE only (no FORCE)
        cp_c = query(f"""
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM `{PROJECT_ID}.{DATASET}.cardpointe_authorizations`
            WHERE DATE(auth_date) BETWEEN '{start}' AND '{end}'
              AND method = 'SALE'
              AND status IN ('PROCESSED', 'PARTIALLY_REFUNDED')
        """)
        cp_sale_only = float(cp_c.total) if cp_c else 0

        print(f"\n  CardPointe:")
        print(f"    A) Gross charges (SALE+FORCE):  {fmt(cp_charges)}")
        print(f"    B) Net (charges - refunds):     {fmt(cp_net)}  (refunds: {fmt(cp_refunds)})")
        print(f"    C) SALE only (no FORCE):        {fmt(cp_sale_only)}")

        # ── Sales Order Variations ─────────────────────────────────────

        # SO-1: Gross CC across all 4 payment slots
        so_1 = query(f"""
            WITH voided AS (
                SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE activity_type = 'Void'
            )
            SELECT SUM(cc_total) AS total FROM (
                SELECT
                    CASE WHEN payment_type_1 IN {CC_TYPES} THEN COALESCE(payment_amount_1, 0) ELSE 0 END +
                    CASE WHEN payment_type_2 IN {CC_TYPES} THEN COALESCE(payment_amount_2, 0) ELSE 0 END +
                    CASE WHEN payment_type_3 IN {CC_TYPES} THEN COALESCE(payment_amount_3, 0) ELSE 0 END +
                    CASE WHEN payment_type_4 IN {CC_TYPES} THEN COALESCE(payment_amount_4, 0) ELSE 0 END AS cc_total
                FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE DATE(purchase_date) BETWEEN '{start}' AND '{end}'
                  AND (activity_type = 'Sale' OR activity_type IS NULL)
                  AND selling_company = 'Salt Lake Express'
                  AND order_id NOT IN (SELECT order_id FROM voided)
            )
        """)
        gross_cc_all_slots = float(so_1.total) if so_1 and so_1.total else 0

        # SO-2: CC from slot 1 only
        so_2 = query(f"""
            WITH voided AS (
                SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE activity_type = 'Void'
            )
            SELECT COALESCE(SUM(payment_amount_1), 0) AS total
            FROM `{PROJECT_ID}.{DATASET}.sales_orders`
            WHERE DATE(purchase_date) BETWEEN '{start}' AND '{end}'
              AND (activity_type = 'Sale' OR activity_type IS NULL)
              AND selling_company = 'Salt Lake Express'
              AND payment_type_1 IN {CC_TYPES}
              AND order_id NOT IN (SELECT order_id FROM voided)
        """)
        gross_cc_slot1 = float(so_2.total) if so_2 else 0

        # SO-3: total_sale for CC-primary orders
        so_3 = query(f"""
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
        """)
        total_sale_cc_primary = float(so_3.total) if so_3 else 0

        # SO-4: Order count (for context)
        so_cnt = query(f"""
            WITH voided AS (
                SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE activity_type = 'Void'
            )
            SELECT
                COUNT(*) AS total_orders,
                COUNTIF(payment_type_1 IN {CC_TYPES}) AS cc_orders
            FROM `{PROJECT_ID}.{DATASET}.sales_orders`
            WHERE DATE(purchase_date) BETWEEN '{start}' AND '{end}'
              AND (activity_type = 'Sale' OR activity_type IS NULL)
              AND selling_company = 'Salt Lake Express'
              AND order_id NOT IN (SELECT order_id FROM voided)
        """)

        # ── CC Cancellations ───────────────────────────────────────────

        # Cancel amounts where original sale was CC (using ABS on cancel fields)
        cc_cancel = query(f"""
            WITH voided AS (
                SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE activity_type = 'Void'
            ),
            sales AS (
                SELECT order_id, payment_type_1
                FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE DATE(purchase_date) BETWEEN '{start}' AND '{end}'
                  AND (activity_type = 'Sale' OR activity_type IS NULL)
                  AND selling_company = 'Salt Lake Express'
                  AND payment_type_1 IN {CC_TYPES}
                  AND order_id NOT IN (SELECT order_id FROM voided)
            ),
            cancels AS (
                SELECT c.order_id,
                    ABS(COALESCE(c.canceled_outbound_fare, 0)) +
                    ABS(COALESCE(c.canceled_return_fare, 0)) +
                    ABS(COALESCE(c.canceled_baggage_fee, 0)) AS cancel_amount
                FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
                WHERE c.activity_type = 'Cancel'
                  AND c.order_id IN (SELECT order_id FROM sales)
            )
            SELECT
                COALESCE(SUM(cancel_amount), 0) AS total_cancels,
                COUNT(*) AS cancel_count
            FROM cancels
        """)
        cc_cancels = float(cc_cancel.total_cancels) if cc_cancel else 0
        cc_cancel_count = int(cc_cancel.cancel_count) if cc_cancel else 0

        # Also try: cancel amounts using raw values (not ABS) in case they're already negative
        cc_cancel_raw = query(f"""
            WITH voided AS (
                SELECT DISTINCT order_id FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE activity_type = 'Void'
            ),
            sales AS (
                SELECT order_id
                FROM `{PROJECT_ID}.{DATASET}.sales_orders`
                WHERE DATE(purchase_date) BETWEEN '{start}' AND '{end}'
                  AND (activity_type = 'Sale' OR activity_type IS NULL)
                  AND selling_company = 'Salt Lake Express'
                  AND payment_type_1 IN {CC_TYPES}
                  AND order_id NOT IN (SELECT order_id FROM voided)
            ),
            cancels AS (
                SELECT c.order_id,
                    COALESCE(c.canceled_outbound_fare, 0) +
                    COALESCE(c.canceled_return_fare, 0) +
                    COALESCE(c.canceled_baggage_fee, 0) AS cancel_amount
                FROM `{PROJECT_ID}.{DATASET}.sales_orders` c
                WHERE c.activity_type = 'Cancel'
                  AND c.order_id IN (SELECT order_id FROM sales)
            )
            SELECT COALESCE(SUM(cancel_amount), 0) AS total_cancels
            FROM cancels
        """)
        cc_cancels_raw = float(cc_cancel_raw.total_cancels) if cc_cancel_raw else 0

        print(f"\n  Sales Orders:")
        print(f"    Total orders: {so_cnt.total_orders}, CC orders: {so_cnt.cc_orders}")
        print(f"    1) Gross CC all slots:          {fmt(gross_cc_all_slots)}")
        print(f"    2) Gross CC slot 1 only:        {fmt(gross_cc_slot1)}")
        print(f"    3) total_sale (CC-primary):     {fmt(total_sale_cc_primary)}")
        print(f"    CC cancels (ABS):               {fmt(cc_cancels)} ({cc_cancel_count} cancels)")
        print(f"    CC cancels (raw sum):           {fmt(cc_cancels_raw)}")

        # ── Net variations ─────────────────────────────────────────────

        net_1_abs = gross_cc_all_slots - cc_cancels
        net_2_abs = gross_cc_slot1 - cc_cancels
        net_3_abs = total_sale_cc_primary - cc_cancels
        net_1_raw = gross_cc_all_slots + cc_cancels_raw  # raw is negative, so add
        net_2_raw = gross_cc_slot1 + cc_cancels_raw
        net_3_raw = total_sale_cc_primary + cc_cancels_raw

        print(f"\n  Net (gross - ABS cancels):")
        print(f"    4) All slots - cancels:         {fmt(net_1_abs)}")
        print(f"    5) Slot 1 - cancels:            {fmt(net_2_abs)}")
        print(f"    6) total_sale - cancels:        {fmt(net_3_abs)}")

        print(f"\n  Net (gross + raw cancels):")
        print(f"    7) All slots + raw cancels:     {fmt(net_1_raw)}")
        print(f"    8) Slot 1 + raw cancels:        {fmt(net_2_raw)}")
        print(f"    9) total_sale + raw cancels:    {fmt(net_3_raw)}")

        # ── Comparison Matrix ──────────────────────────────────────────

        so_variations = {
            "1) Gross CC all slots":    gross_cc_all_slots,
            "2) Gross CC slot 1":       gross_cc_slot1,
            "3) total_sale CC-primary": total_sale_cc_primary,
            "4) All slots - cancels":   net_1_abs,
            "5) Slot 1 - cancels":      net_2_abs,
            "6) total_sale - cancels":  net_3_abs,
            "7) All slots + raw canc":  net_1_raw,
            "8) Slot 1 + raw canc":     net_2_raw,
            "9) total_sale + raw canc": net_3_raw,
        }

        cp_variations = {
            "A) Gross charges":   cp_charges,
            "B) Net":             cp_net,
            "C) SALE only":       cp_sale_only,
        }

        month_results = []
        for so_name, so_val in so_variations.items():
            for cp_name, cp_val in cp_variations.items():
                diff = so_val - cp_val
                pct = pct_diff(so_val, cp_val) if cp_val != 0 else float("inf")
                month_results.append((abs(pct), so_name, cp_name, so_val, cp_val, diff, pct, label))

        month_results.sort(key=lambda x: x[0])

        # Show top 5 matches for this month
        print(f"\n  Top 5 matches:")
        for abs_pct, so_name, cp_name, so_val, cp_val, diff, pct, _ in month_results[:5]:
            print(f"    {so_name:<28} vs {cp_name:<18} | diff={fmt(diff):>12} ({pct:>+7.3f}%)")

        all_results.extend(month_results)

    # ── Summary: Best matches across all months ────────────────────
    print(f"\n\n{'=' * 90}")
    print("BEST MATCHES (avg absolute % diff across all months)")
    print(f"{'=' * 90}")

    # Group by (so_name, cp_name) and average the abs pct
    from collections import defaultdict
    combos = defaultdict(list)
    for abs_pct, so_name, cp_name, so_val, cp_val, diff, pct, label in all_results:
        combos[(so_name, cp_name)].append((abs_pct, label, so_val, cp_val, diff, pct))

    ranked = []
    for (so_name, cp_name), entries in combos.items():
        avg_pct = sum(e[0] for e in entries) / len(entries)
        ranked.append((avg_pct, so_name, cp_name, entries))

    ranked.sort(key=lambda x: x[0])

    for i, (avg_pct, so_name, cp_name, entries) in enumerate(ranked[:10]):
        print(f"\n  #{i+1}: {so_name} vs {cp_name}  (avg diff: {avg_pct:.3f}%)")
        for abs_pct, label, so_val, cp_val, diff, pct in entries:
            print(f"      {label}: SO={fmt(so_val)}, CP={fmt(cp_val)}, diff={fmt(diff)} ({pct:+.3f}%)")


if __name__ == "__main__":
    run_comparison()
