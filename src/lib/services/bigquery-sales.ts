import type { MonthPeriod } from "@/lib/schemas/types";
import { getBigQueryClient, PROJECT_ID } from "./bigquery-client";

const DATASET = process.env.BIGQUERY_DATASET ?? "tds_sales";

function periodToDateRange(period: MonthPeriod) {
  const start = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const end = new Date(period.year, period.month, 0).toISOString().slice(0, 10);
  return { start, end };
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
};

/** Fetch sales orders for a month, excluding voided order_ids */
export async function getSalesOrders(
  period: MonthPeriod,
): Promise<SalesOrderRow[]> {
  const { start, end } = periodToDateRange(period);
  const bq = getBigQueryClient();

  const query = `
    SELECT
      order_id,
      CAST(purchase_date AS STRING) AS purchase_date,
      purchaser_email,
      purchaser_first_name,
      purchaser_last_name,
      COALESCE(total_sale, 0) AS total_sale,
      COALESCE(amount_discounted, 0) AS amount_discounted,
      promotion_code,
      payment_type_1, COALESCE(payment_amount_1, 0) AS payment_amount_1,
      payment_type_2, COALESCE(payment_amount_2, 0) AS payment_amount_2,
      payment_type_3, COALESCE(payment_amount_3, 0) AS payment_amount_3,
      payment_type_4, COALESCE(payment_amount_4, 0) AS payment_amount_4,
      trip_origin_stop,
      trip_destination_stop,
      previous_order
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE DATE(purchase_date) BETWEEN @start_date AND @end_date
      AND (activity_type = 'Sale' OR activity_type IS NULL)
      AND selling_company = 'Salt Lake Express'
      AND order_id NOT IN (
        SELECT DISTINCT order_id
        FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
        WHERE activity_type = 'Void'
      )
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
  }));
}

/** Get cancel amounts per order_id. Returns Map<orderId, canceledTotal>. */
export async function getCancelAmounts(
  orderIds: number[],
): Promise<Map<number, number>> {
  if (orderIds.length === 0) return new Map();

  const bq = getBigQueryClient();

  // BigQuery parameterized queries don't support IN with arrays well,
  // so we use a subquery approach with the same date-independent logic
  // the Python pipeline uses (cancels can happen any time after the sale).
  const query = `
    SELECT
      order_id,
      SUM(
        COALESCE(canceled_outbound_fare, 0) +
        COALESCE(canceled_return_fare, 0) +
        COALESCE(canceled_baggage_fee, 0)
      ) AS total_canceled
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE activity_type = 'Cancel'
      AND order_id IN UNNEST(@order_ids)
    GROUP BY order_id
  `;

  const [rows] = await bq.query({
    query,
    params: { order_ids: orderIds },
  });

  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(Number(r.order_id), Number(r.total_canceled));
  }
  return map;
}

export type CancelsByPaymentCategory = {
  cc: number;
  cash: number;
  account_credit: number;
  other: number;
};

// Payment type constants for cancel allocation
const CC_TYPES = [
  "Visa",
  "Mastercard",
  "American Express",
  "Discover",
  "Debit Card",
  "BankCard",
];
const ACCOUNT_CREDIT_TYPES = ["Customer Account Credit", "Corporate Account"];
const CASH_TYPES = [
  "POS (Cash)",
  "Driver Collect Payment",
  "Cash",
  "Driver Cash Sale",
];

function categorizePaymentType(
  type: string | null,
): "cc" | "account_credit" | "cash" | "other" {
  if (!type) return "other";
  if (CC_TYPES.includes(type)) return "cc";
  if (ACCOUNT_CREDIT_TYPES.includes(type)) return "account_credit";
  if (CASH_TYPES.includes(type)) return "cash";
  return "other";
}

/** Get cancel totals broken down by the original sale's primary payment category */
export async function getCancelsByPaymentCategory(
  period: MonthPeriod,
): Promise<CancelsByPaymentCategory> {
  const { start, end } = periodToDateRange(period);
  const bq = getBigQueryClient();

  const query = `
    WITH voided AS (
      SELECT DISTINCT order_id
      FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
      WHERE activity_type = 'Void'
    ),
    sales AS (
      SELECT order_id, payment_type_1
      FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
      WHERE DATE(purchase_date) BETWEEN @start_date AND @end_date
        AND (activity_type = 'Sale' OR activity_type IS NULL)
        AND selling_company = 'Salt Lake Express'
        AND order_id NOT IN (SELECT order_id FROM voided)
    ),
    cancels AS (
      SELECT order_id,
        ABS(COALESCE(canceled_outbound_fare, 0)) +
        ABS(COALESCE(canceled_return_fare, 0)) +
        ABS(COALESCE(canceled_baggage_fee, 0)) AS cancel_amount
      FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
      WHERE activity_type = 'Cancel'
        AND order_id IN (SELECT order_id FROM sales)
    )
    SELECT
      s.payment_type_1,
      c.cancel_amount
    FROM sales s
    INNER JOIN cancels c ON s.order_id = c.order_id
  `;

  const [rows] = await bq.query({
    query,
    params: { start_date: start, end_date: end },
  });

  const result: CancelsByPaymentCategory = {
    cc: 0,
    cash: 0,
    account_credit: 0,
    other: 0,
  };

  for (const row of rows) {
    const category = categorizePaymentType(
      row.payment_type_1 ? String(row.payment_type_1) : null,
    );
    result[category] += Number(row.cancel_amount ?? 0);
  }

  return result;
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
  _period: MonthPeriod,
): Promise<Map<string, string>> {
  if (emails.length === 0) return new Map();

  const bq = getBigQueryClient();

  // Query all-time first purchase per email. We pass the emails to filter
  // but the MIN(purchase_date) is computed across all time.
  const query = `
    WITH voided AS (
      SELECT DISTINCT order_id
      FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
      WHERE activity_type = 'Void'
    )
    SELECT
      LOWER(TRIM(purchaser_email)) AS email,
      CAST(MIN(DATE(purchase_date)) AS STRING) AS first_purchase_date
    FROM \`${PROJECT_ID}.${DATASET}.sales_orders\`
    WHERE (activity_type = 'Sale' OR activity_type IS NULL)
      AND selling_company = 'Salt Lake Express'
      AND order_id NOT IN (SELECT order_id FROM voided)
      AND purchaser_email IS NOT NULL
      AND LOWER(TRIM(purchaser_email)) IN UNNEST(@emails)
    GROUP BY email
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
