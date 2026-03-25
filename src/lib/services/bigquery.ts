import { BigQuery } from "@google-cloud/bigquery";
import type { MonthPeriod, DateRange } from "@/lib/schemas/types";
import type { BigQueryPeriodSummary } from "@/lib/schemas/sources/bigquery";

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? "jovial-root-443516-a7";
const DATASET = process.env.BIGQUERY_DATASET ?? "tds_sales";

let client: BigQuery | null = null;

function getBigQueryClient(): BigQuery {
  if (!client) {
    client = new BigQuery({ projectId: PROJECT_ID });
  }
  return client;
}

export type ConnectionStatus = {
  ok: boolean;
  error?: string;
  latencyMs: number;
};

/** Health check: SELECT 1 to verify credentials work */
export async function testConnection(): Promise<ConnectionStatus> {
  const start = Date.now();
  try {
    const bq = getBigQueryClient();
    await bq.query({ query: "SELECT 1" });
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}

function monthToDateRange(period: MonthPeriod): DateRange {
  const start = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, end };
}

/** Revenue, orders, unique customers for a month from vw_sle_active_orders */
export async function getMonthlyRevenueSummary(
  period: MonthPeriod,
): Promise<{
  totalRevenue: number;
  totalOrders: number;
  uniqueCustomers: number;
  avgOrderValue: number;
}> {
  const { start, end } = monthToDateRange(period);
  const bq = getBigQueryClient();

  const query = `
    SELECT
      COALESCE(SUM(revenue_after_cancellations), 0) AS total_revenue,
      COUNT(DISTINCT order_id) AS total_orders,
      COUNT(DISTINCT LOWER(TRIM(purchaser_email))) AS unique_customers
    FROM \`${PROJECT_ID}.${DATASET}.vw_sle_active_orders\`
    WHERE DATE(purchase_date) >= @start_date
      AND DATE(purchase_date) < @end_date
  `;

  const [rows] = await bq.query({
    query,
    params: { start_date: start, end_date: end },
  });

  const row = rows[0] ?? { total_revenue: 0, total_orders: 0, unique_customers: 0 };
  const totalRevenue = Number(row.total_revenue);
  const totalOrders = Number(row.total_orders);

  return {
    totalRevenue,
    totalOrders,
    uniqueCustomers: Number(row.unique_customers),
    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
  };
}

/** New vs returning customer segmentation for a month */
export async function getCustomerSegmentation(
  period: MonthPeriod,
): Promise<{
  newCustomers: number;
  returningCustomers: number;
  newCustomerRevenue: number;
  returningCustomerRevenue: number;
}> {
  const { start, end } = monthToDateRange(period);
  const bq = getBigQueryClient();

  const query = `
    WITH monthly_customers AS (
      SELECT
        LOWER(TRIM(o.purchaser_email)) AS email,
        SUM(o.revenue_after_cancellations) AS revenue,
        MIN(f.first_order_date) AS first_order_date
      FROM \`${PROJECT_ID}.${DATASET}.vw_sle_active_orders\` o
      LEFT JOIN \`${PROJECT_ID}.${DATASET}.customer_first_order\` f
        ON LOWER(TRIM(o.purchaser_email)) = f.pk_email
      WHERE DATE(o.purchase_date) >= @start_date
        AND DATE(o.purchase_date) < @end_date
      GROUP BY email
    )
    SELECT
      COUNTIF(first_order_date >= @start_date) AS new_customers,
      COUNTIF(first_order_date < @start_date OR first_order_date IS NULL) AS returning_customers,
      COALESCE(SUM(CASE WHEN first_order_date >= @start_date THEN revenue END), 0) AS new_customer_revenue,
      COALESCE(SUM(CASE WHEN first_order_date < @start_date OR first_order_date IS NULL THEN revenue END), 0) AS returning_customer_revenue
    FROM monthly_customers
  `;

  const [rows] = await bq.query({
    query,
    params: { start_date: start, end_date: end },
  });

  const row = rows[0] ?? {
    new_customers: 0,
    returning_customers: 0,
    new_customer_revenue: 0,
    returning_customer_revenue: 0,
  };

  return {
    newCustomers: Number(row.new_customers),
    returningCustomers: Number(row.returning_customers),
    newCustomerRevenue: Number(row.new_customer_revenue),
    returningCustomerRevenue: Number(row.returning_customer_revenue),
  };
}

/** Combined dashboard data: revenue + customer segmentation → BigQueryPeriodSummary */
export async function getDashboardSummary(
  period: MonthPeriod,
): Promise<BigQueryPeriodSummary> {
  const [revenue, customers] = await Promise.all([
    getMonthlyRevenueSummary(period),
    getCustomerSegmentation(period),
  ]);

  return {
    total_revenue: revenue.totalRevenue,
    total_orders: revenue.totalOrders,
    unique_customers: revenue.uniqueCustomers,
    avg_order_value: revenue.avgOrderValue,
    new_customers: customers.newCustomers,
    returning_customers: customers.returningCustomers,
    new_customer_revenue: customers.newCustomerRevenue,
    returning_customer_revenue: customers.returningCustomerRevenue,
  };
}
