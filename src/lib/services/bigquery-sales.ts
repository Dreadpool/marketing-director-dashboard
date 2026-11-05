import type { MonthPeriod } from "@/lib/schemas/types";
import { getBigQueryClient, PROJECT_ID } from "./bigquery-client";
import { getMonthDateRange } from "@/lib/utils/month-period";

const DATASET = process.env.BIGQUERY_DATASET ?? "tds_sales";

/** The Google Ads denominator includes every positive, non-void SLE sale row. */
export async function getAdBookingCount(period: MonthPeriod) {
  const { start, end } = getMonthDateRange(period);
  const [rows] = await getBigQueryClient().query({
    query: `
    WITH voided_orders AS (
      SELECT DISTINCT order_id
      FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
      WHERE activity_type = 'Void'
        AND selling_company = 'Salt Lake Express'
    )
    SELECT COUNT(*) AS bookings
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\` so
    WHERE DATE(so.purchase_date) BETWEEN @start_date AND @end_date
      AND (so.activity_type = 'Sale' OR so.activity_type IS NULL)
      AND so.selling_company = 'Salt Lake Express'
      AND so.total_sale > 0
      AND so.order_id NOT IN (SELECT order_id FROM voided_orders)
    `,
    params: { start_date: start, end_date: end },
  });
  return Number(rows[0].bookings);
}

/** Preserve the existing monthly booking eligibility and within-month rebook rules. */
export async function getMonthlyBookingCounts(period: MonthPeriod) {
  const { start, end } = getMonthDateRange(period);
  const [rows] = await getBigQueryClient().query({
    query: `
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
    ), eligible AS (
    SELECT so.order_id, so.previous_order, NULLIF(LOWER(TRIM(so.purchaser_email)), '') AS email
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\` so
    LEFT JOIN cancel_amounts ca ON so.order_id = ca.order_id
    WHERE DATE(so.purchase_date) BETWEEN @start_date AND @end_date
      AND (so.activity_type = 'Sale' OR so.activity_type IS NULL)
      AND so.selling_company = 'Salt Lake Express'
      AND so.total_sale > 0
      AND so.order_id NOT IN (SELECT order_id FROM voided_orders)
      AND (so.trip_origin_stop IS NULL AND so.num_passengers = 0 AND so.fares = 0) IS NOT TRUE
      AND (ca.num_cancel_records > 0 AND so.total_sale - ca.total_canceled
           <= 12 * GREATEST(COALESCE(so.num_passengers, 0), 1)) IS NOT TRUE
    ), bookings AS (
      SELECT e.* FROM eligible e
      WHERE NOT EXISTS (SELECT 1 FROM eligible r WHERE SAFE_CAST(r.previous_order AS FLOAT64) = e.order_id)
    )
    SELECT COUNT(DISTINCT b.order_id) AS orders, COUNT(DISTINCT b.email) AS purchasers,
      COUNT(DISTINCT IF(f.first_order_date BETWEEN @start_date AND @end_date, b.email, NULL)) AS new_purchasers
    FROM bookings b
    LEFT JOIN \`${PROJECT_ID}.${DATASET}.customer_first_order\` f ON f.customer_account_holder_email = b.email
    `,
    params: { start_date: start, end_date: end },
  });
  const row = rows[0];
  return {
    orders: Number(row.orders),
    purchasers: Number(row.purchasers),
    newPurchasers: Number(row.new_purchasers),
  };
}
