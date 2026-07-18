import type { MonthPeriod } from "@/lib/schemas/types";
import { getBigQueryClient, PROJECT_ID } from "./bigquery-client";
import { getMonthDateRange } from "@/lib/utils/month-period";

const DATASET = process.env.BIGQUERY_DATASET ?? "tds_sales";

function periodToDateRange(period: MonthPeriod) {
  return getMonthDateRange(period);
}

export type SalesOrderRow = {
  order_id: number;
  purchase_date: string;
  purchaser_email: string | null;
  purchaser_first_name: string | null;
  purchaser_last_name: string | null;
  total_sale: number;
  amount_discounted: number;
  promotion_code: string | null;
  payment_type_1: string | null;
  payment_amount_1: number;
  payment_type_2: string | null;
  payment_amount_2: number;
  payment_type_3: string | null;
  payment_amount_3: number;
  payment_type_4: string | null;
  payment_amount_4: number;
  trip_origin_stop: string | null;
  trip_destination_stop: string | null;
  previous_order: number | null;
  revenue_after_cancellations: number;
  total_canceled_amount: number;
  num_cancel_records: number;
  is_paid_in: boolean;
  is_fee_only_cancellation: boolean;
};

/** Fetch all non-void SLE sales for booked-value reporting, including full cancellations. */
export async function getSalesOrders(
  period: MonthPeriod,
): Promise<SalesOrderRow[]> {
  const { start, end } = periodToDateRange(period);
  const bq = getBigQueryClient();

  const query = `
    WITH voided_orders AS (
      SELECT DISTINCT order_id
      FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
      WHERE activity_type = 'Void'
        AND selling_company = 'Salt Lake Express'
    ),
    cancel_amounts AS (
      SELECT
        order_id,
        COUNT(*) AS num_cancel_records,
        CASE
          WHEN COUNT(DISTINCT ABS(COALESCE(canceled_outbound_fare, 0))) = 1
           AND COUNT(DISTINCT ABS(COALESCE(canceled_return_fare, 0))) = 1
           AND COUNT(DISTINCT ABS(COALESCE(canceled_baggage_fee, 0))) = 1
          THEN
            MAX(ABS(COALESCE(canceled_outbound_fare, 0))) +
            MAX(ABS(COALESCE(canceled_return_fare, 0))) +
            MAX(ABS(COALESCE(canceled_baggage_fee, 0)))
          ELSE
            SUM(ABS(COALESCE(canceled_outbound_fare, 0)) +
                ABS(COALESCE(canceled_return_fare, 0)) +
                ABS(COALESCE(canceled_baggage_fee, 0)))
        END AS total_canceled
      FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
      WHERE activity_type = 'Cancel'
        AND selling_company = 'Salt Lake Express'
        AND order_id NOT IN (SELECT order_id FROM voided_orders)
      GROUP BY order_id
    )
    SELECT
      so.order_id,
      CAST(so.purchase_date AS STRING) AS purchase_date,
      so.purchaser_email,
      so.purchaser_first_name,
      so.purchaser_last_name,
      COALESCE(so.total_sale, 0) AS total_sale,
      COALESCE(so.amount_discounted, 0) AS amount_discounted,
      so.promotion_code,
      so.payment_type_1, COALESCE(so.payment_amount_1, 0) AS payment_amount_1,
      so.payment_type_2, COALESCE(so.payment_amount_2, 0) AS payment_amount_2,
      so.payment_type_3, COALESCE(so.payment_amount_3, 0) AS payment_amount_3,
      so.payment_type_4, COALESCE(so.payment_amount_4, 0) AS payment_amount_4,
      so.trip_origin_stop,
      so.trip_destination_stop,
      so.previous_order,
      so.total_sale - COALESCE(ca.total_canceled, 0) AS revenue_after_cancellations,
      COALESCE(ca.total_canceled, 0) AS total_canceled_amount,
      COALESCE(ca.num_cancel_records, 0) AS num_cancel_records,
      (so.trip_origin_stop IS NULL AND so.num_passengers = 0 AND so.fares = 0) AS is_paid_in,
      (COALESCE(ca.num_cancel_records, 0) > 0
       AND so.total_sale - COALESCE(ca.total_canceled, 0)
           <= 12 * GREATEST(COALESCE(so.num_passengers, 0), 1)
      ) AS is_fee_only_cancellation
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\` so
    LEFT JOIN cancel_amounts ca ON so.order_id = ca.order_id
    WHERE DATE(so.purchase_date) BETWEEN @start_date AND @end_date
      AND (so.activity_type = 'Sale' OR so.activity_type IS NULL)
      AND so.selling_company = 'Salt Lake Express'
      AND so.total_sale > 0
      AND so.order_id NOT IN (SELECT order_id FROM voided_orders)
  `;

  const [rows] = await bq.query({
    query,
    params: { start_date: start, end_date: end },
  });

  return rows.map((r: Record<string, unknown>) => ({
    order_id: Number(r.order_id),
    purchase_date: String(r.purchase_date),
    purchaser_email: r.purchaser_email ? String(r.purchaser_email) : null,
    purchaser_first_name: r.purchaser_first_name
      ? String(r.purchaser_first_name)
      : null,
    purchaser_last_name: r.purchaser_last_name
      ? String(r.purchaser_last_name)
      : null,
    total_sale: Number(r.total_sale),
    amount_discounted: Number(r.amount_discounted),
    promotion_code: r.promotion_code ? String(r.promotion_code) : null,
    payment_type_1: r.payment_type_1 ? String(r.payment_type_1) : null,
    payment_amount_1: Number(r.payment_amount_1),
    payment_type_2: r.payment_type_2 ? String(r.payment_type_2) : null,
    payment_amount_2: Number(r.payment_amount_2),
    payment_type_3: r.payment_type_3 ? String(r.payment_type_3) : null,
    payment_amount_3: Number(r.payment_amount_3),
    payment_type_4: r.payment_type_4 ? String(r.payment_type_4) : null,
    payment_amount_4: Number(r.payment_amount_4),
    trip_origin_stop: r.trip_origin_stop ? String(r.trip_origin_stop) : null,
    trip_destination_stop: r.trip_destination_stop ? String(r.trip_destination_stop) : null,
    previous_order: r.previous_order ? Number(r.previous_order) : null,
    revenue_after_cancellations: Number(r.revenue_after_cancellations),
    total_canceled_amount: Number(r.total_canceled_amount),
    num_cancel_records: Number(r.num_cancel_records),
    is_paid_in: Boolean(r.is_paid_in),
    is_fee_only_cancellation: Boolean(r.is_fee_only_cancellation),
  }));
}

export type CardPointeSettlement = {
  total_charges: number;
  total_refunds: number;
  net_amount: number;
  transaction_count: number;
};

/** Get CardPointe settlement totals for a month.
 *  Uses settlement data (ground truth) when available, falls back to
 *  authorization aggregates from `cardpointe_authorizations` for months
 *  where settlement data doesn't exist (e.g. 2025 historical data). */
export async function getCardPointeSettlements(
  period: MonthPeriod,
): Promise<CardPointeSettlement> {
  const { start, end } = periodToDateRange(period);
  const bq = getBigQueryClient();

  // Try settlement data first (ground truth)
  const settlementQuery = `
    SELECT
      COALESCE(SUM(charge_total), 0) AS total_charges,
      COALESCE(SUM(refund_total), 0) AS total_refunds,
      COALESCE(SUM(net_total), 0) AS net_amount,
      COALESCE(SUM(txn_count), 0) AS transaction_count
    FROM \`${PROJECT_ID}.${DATASET}.cardpointe_settlements\`
    WHERE settlement_date BETWEEN @start_date AND @end_date
  `;

  const [settlementRows] = await bq.query({
    query: settlementQuery,
    params: { start_date: start, end_date: end },
  });

  const sRow = settlementRows[0] ?? {};
  const settlementNet = Number(sRow.net_amount ?? 0);

  // If settlement data exists for this period, use it
  if (settlementNet !== 0) {
    return {
      total_charges: Number(sRow.total_charges ?? 0),
      total_refunds: Number(sRow.total_refunds ?? 0),
      net_amount: settlementNet,
      transaction_count: Number(sRow.transaction_count ?? 0),
    };
  }

  // Fall back to authorization aggregates
  const authQuery = `
    SELECT
      COALESCE(SUM(CASE WHEN method IN ('SALE', 'FORCE') THEN amount ELSE 0 END), 0) AS total_charges,
      COALESCE(SUM(CASE WHEN method = 'REFUND' THEN ABS(amount) ELSE 0 END), 0) AS total_refunds,
      COUNT(*) AS transaction_count
    FROM \`${PROJECT_ID}.${DATASET}.cardpointe_authorizations\`
    WHERE DATE(auth_date) BETWEEN @start_date AND @end_date
  `;

  const [authRows] = await bq.query({
    query: authQuery,
    params: { start_date: start, end_date: end },
  });

  const aRow = authRows[0] ?? {};
  const charges = Number(aRow.total_charges ?? 0);
  const refunds = Number(aRow.total_refunds ?? 0);

  return {
    total_charges: charges,
    total_refunds: refunds,
    net_amount: charges - refunds,
    transaction_count: Number(aRow.transaction_count ?? 0),
  };
}

/**
 * Get first purchase date for each email (all-time, excluding voids).
 * Used to determine new vs returning customers for a target month.
 */
export async function getCustomerFirstPurchases(
  emails: string[],
): Promise<Map<string, string>> {
  if (emails.length === 0) return new Map();

  const bq = getBigQueryClient();

  const query = `
    SELECT
      customer_account_holder_email AS email,
      CAST(first_order_date AS STRING) AS first_purchase_date
    FROM \`${PROJECT_ID}.${DATASET}.customer_first_order\`
    WHERE customer_account_holder_email IN UNNEST(@emails)
  `;

  const [rows] = await bq.query({
    query,
    params: { emails },
  });

  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(String(r.email), String(r.first_purchase_date));
  }
  return map;
}
