import type { MonthPeriod } from "@/lib/schemas/types";
import { getBigQueryClient } from "@/lib/services/bigquery-client";

const DATASET = process.env.BIGQUERY_DATASET ?? "tds_sales";
const GROSS_MARGIN = 0.43;

function safeDivide(num: number, den: number, fallback = 0): number {
  return den > 0 ? num / den : fallback;
}

export interface PromoCodeMetrics {
  promoCode: string;
  dateRange: { start: string; end: string; days: number };
  totalOrders: number;
  grossRevenue: number;
  avgOrderValue: number;
  uniqueCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  newCustomerPct: number;
  ordersPerCustomer: number;
  totalDiscounted: number;
  avgDiscountPerOrder: number;
  baselineAov: number;
  topRoutes: Array<{ route: string; orders: number; revenue: number }>;
  weeklyUsage: Array<{ weekLabel: string; weekStart: string; orders: number }>;
  channelBreakdown: { web: number; agent: number };
  campaignCost?: number;
  roi?: {
    revenueReturn: number;
    grossProfitReturn: number;
    costPerAcquisition: number;
    netProfit: number;
  };
  metadata: { generatedAt: string; provenanceNote: string };
}

export async function fetchPromoCode(
  _period: MonthPeriod,
  params?: Record<string, unknown>,
): Promise<PromoCodeMetrics> {
  const promoCode = params?.promoCode as string;
  if (!promoCode) throw new Error("promoCode is required in params");
  const campaignCost = params?.campaignCost as number | undefined;

  const bq = getBigQueryClient();

  // Query 1: All orders with this promo code
  const [ordersResult] = await bq.query({
    query: `
      SELECT
        order_id,
        LOWER(TRIM(purchaser_email)) AS email,
        DATE(purchase_date) AS purchase_date,
        COALESCE(total_sale, 0) AS total_sale,
        COALESCE(amount_discounted, 0) AS amount_discounted,
        COALESCE(trip_origin_stop, '') AS dep_city,
        COALESCE(trip_destination_stop, '') AS arr_city,
        selling_agent
      FROM \`${DATASET}.sales_orders\`
      WHERE selling_company = 'Salt Lake Express'
        AND (activity_type IS NULL OR activity_type = 'Sale')
        AND UPPER(TRIM(promotion_code)) = @promoCode
      ORDER BY purchase_date
    `,
    params: { promoCode: promoCode.toUpperCase().trim() },
  });

  const orders = ordersResult as Array<{
    order_id: string;
    email: string;
    purchase_date: { value: string };
    total_sale: number;
    amount_discounted: number;
    dep_city: string;
    arr_city: string;
    selling_agent: string | null;
  }>;

  if (orders.length === 0) {
    return {
      promoCode: promoCode.toUpperCase().trim(),
      dateRange: { start: "", end: "", days: 0 },
      totalOrders: 0,
      grossRevenue: 0,
      avgOrderValue: 0,
      uniqueCustomers: 0,
      newCustomers: 0,
      returningCustomers: 0,
      newCustomerPct: 0,
      ordersPerCustomer: 0,
      totalDiscounted: 0,
      avgDiscountPerOrder: 0,
      baselineAov: 0,
      topRoutes: [],
      weeklyUsage: [],
      channelBreakdown: { web: 0, agent: 0 },
      campaignCost,
      metadata: {
        generatedAt: new Date().toISOString(),
        provenanceNote: `No orders found for promo code "${promoCode}"`,
      },
    };
  }

  // Derive date range from data
  const dates = orders.map((o) => o.purchase_date.value);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const daysDiff =
    Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1;

  // Unique emails for customer queries
  const emails = [...new Set(orders.map((o) => o.email).filter(Boolean))];

  // Query 2: Customer first purchases (parallel)
  const firstPurchasePromise = emails.length > 0
    ? bq.query({
        query: `
          SELECT LOWER(TRIM(email)) AS email, MIN(DATE(first_order_date)) AS first_date
          FROM \`${DATASET}.customer_first_order\`
          WHERE LOWER(TRIM(email)) IN UNNEST(@emails)
          GROUP BY 1
        `,
        params: { emails },
      })
    : Promise.resolve([[]]);

  // Query 3: Baseline AOV (same date range, no promo code)
  const baselinePromise = bq.query({
    query: `
      SELECT AVG(COALESCE(total_sale, 0)) AS avg_sale
      FROM \`${DATASET}.sales_orders\`
      WHERE selling_company = 'Salt Lake Express'
        AND (activity_type IS NULL OR activity_type = 'Sale')
        AND DATE(purchase_date) BETWEEN @start_date AND @end_date
        AND (promotion_code IS NULL OR TRIM(promotion_code) = '')
        AND COALESCE(total_sale, 0) > 0
    `,
    params: { start_date: startDate, end_date: endDate },
  });

  const [firstPurchaseResult, baselineResult] = await Promise.allSettled([
    firstPurchasePromise,
    baselinePromise,
  ]);

  // Process first purchase data
  const firstPurchaseMap = new Map<string, string>();
  if (firstPurchaseResult.status === "fulfilled") {
    const rows = firstPurchaseResult.value[0] as Array<{
      email: string;
      first_date: { value: string };
    }>;
    for (const row of rows) {
      firstPurchaseMap.set(row.email, row.first_date.value);
    }
  }

  // Classify new vs returning: new if their first purchase date falls within the promo date range
  let newCustomers = 0;
  const uniqueEmails = new Set<string>();

  for (const order of orders) {
    if (!order.email || uniqueEmails.has(order.email)) continue;
    uniqueEmails.add(order.email);
    const firstDate = firstPurchaseMap.get(order.email);
    if (!firstDate || firstDate >= startDate) {
      newCustomers++;
    }
  }

  // Baseline AOV
  let baselineAov = 0;
  if (baselineResult.status === "fulfilled") {
    const rows = baselineResult.value[0] as Array<{ avg_sale: number }>;
    baselineAov = rows[0]?.avg_sale ?? 0;
  }

  // Compute metrics
  const totalOrders = orders.length;
  const grossRevenue = orders.reduce((sum, o) => sum + Number(o.total_sale), 0);
  const totalDiscounted = orders.reduce(
    (sum, o) => sum + Number(o.amount_discounted),
    0,
  );
  const uniqueCustomers = uniqueEmails.size;
  const returningCustomers = uniqueCustomers - newCustomers;

  // Route distribution
  const routeMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    const route = o.dep_city && o.arr_city ? `${o.dep_city} → ${o.arr_city}` : "Unknown";
    const existing = routeMap.get(route) ?? { orders: 0, revenue: 0 };
    existing.orders++;
    existing.revenue += Number(o.total_sale);
    routeMap.set(route, existing);
  }
  const topRoutes = [...routeMap.entries()]
    .map(([route, data]) => ({ route, ...data }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  // Weekly usage
  const weekMap = new Map<string, number>();
  const startMs = new Date(startDate).getTime();
  for (const o of orders) {
    const orderMs = new Date(o.purchase_date.value).getTime();
    const weekNum = Math.floor((orderMs - startMs) / (7 * 24 * 60 * 60 * 1000));
    const weekStart = new Date(startMs + weekNum * 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const key = `W${weekNum + 1}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }
  const weeklyUsage = [...weekMap.entries()]
    .map(([weekLabel, orders]) => ({
      weekLabel,
      weekStart: "",
      orders,
    }))
    .sort((a, b) => parseInt(a.weekLabel.slice(1)) - parseInt(b.weekLabel.slice(1)));

  // Channel breakdown
  const agentOrders = orders.filter(
    (o) => o.selling_agent && o.selling_agent.trim() !== "",
  ).length;

  // ROI (only if campaignCost provided)
  let roi: PromoCodeMetrics["roi"] | undefined;
  if (campaignCost && campaignCost > 0) {
    const grossProfit = grossRevenue * GROSS_MARGIN;
    roi = {
      revenueReturn: safeDivide(grossRevenue, campaignCost),
      grossProfitReturn: safeDivide(grossProfit, campaignCost),
      costPerAcquisition: safeDivide(campaignCost, newCustomers),
      netProfit: grossProfit - campaignCost,
    };
  }

  return {
    promoCode: promoCode.toUpperCase().trim(),
    dateRange: { start: startDate, end: endDate, days: daysDiff },
    totalOrders,
    grossRevenue,
    avgOrderValue: safeDivide(grossRevenue, totalOrders),
    uniqueCustomers,
    newCustomers,
    returningCustomers,
    newCustomerPct: safeDivide(newCustomers, uniqueCustomers) * 100,
    ordersPerCustomer: safeDivide(totalOrders, uniqueCustomers),
    totalDiscounted,
    avgDiscountPerOrder: safeDivide(totalDiscounted, totalOrders),
    baselineAov,
    topRoutes,
    weeklyUsage,
    channelBreakdown: {
      web: totalOrders - agentOrders,
      agent: agentOrders,
    },
    campaignCost,
    roi,
    metadata: {
      generatedAt: new Date().toISOString(),
      provenanceNote: `BigQuery sales_orders, promo code "${promoCode.toUpperCase().trim()}", ${startDate} to ${endDate}`,
    },
  };
}
