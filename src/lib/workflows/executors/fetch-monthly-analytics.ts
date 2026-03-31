import type { MonthPeriod } from "@/lib/schemas/types";
import type {
  MasterMetrics,
  MasterMetricsComparison,
  SourceDetail,
} from "@/lib/schemas/sources/monthly-analytics";
import {
  getSalesOrders,
  getCancelAmounts,
  getCardPointeSettlements,
  getCancelsByPaymentCategory,
  getCustomerFirstPurchases,
} from "@/lib/services/bigquery-sales";
import { getMonthlyAdSpend } from "@/lib/services/bigquery-adspend";
import {
  applyCancelAdjustments,
  calculateRevenueBreakdown,
  calculatePaymentAnalysis,
  calculateCustomerSegmentation,
  calculatePromoAnalysis,
  calculateTopCustomers,
  calculateCAC,
} from "@/lib/services/metrics-calculator";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Fetch and compute all monthly analytics metrics from BigQuery + QuickBooks GL */
export async function fetchMonthlyAnalytics(
  period: MonthPeriod,
): Promise<MasterMetrics> {
  const startDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const endDate = new Date(period.year, period.month, 0)
    .toISOString()
    .slice(0, 10);

  // 1. Parallel: sales orders + CardPointe + ad spend + cancels by category
  const [salesResult, cardpointeResult, adSpendResult, cancelsByCatResult] =
    await Promise.allSettled([
      getSalesOrders(period),
      getCardPointeSettlements(period),
      getMonthlyAdSpend(period),
      getCancelsByPaymentCategory(period),
    ]);

  // BigQuery sales orders are required
  if (salesResult.status === "rejected") {
    throw new Error(
      `BigQuery sales orders fetch failed: ${salesResult.reason}`,
    );
  }

  const salesRows = salesResult.value;

  // CardPointe optional but preferred for CC revenue
  const cardpointe =
    cardpointeResult.status === "fulfilled" ? cardpointeResult.value : null;
  if (cardpointeResult.status === "rejected") {
    console.error("CardPointe fetch failed:", cardpointeResult.reason);
  }

  // Ad spend optional
  const adSpend =
    adSpendResult.status === "fulfilled"
      ? adSpendResult.value
      : { categories: {} as Record<string, number>, total_spend: 0, transaction_count: 0 };
  const adSpendAvailable = adSpendResult.status === "fulfilled";
  if (adSpendResult.status === "rejected") {
    console.error("Ad spend fetch failed:", adSpendResult.reason);
  }

  // Cancels by payment category for net revenue calculation
  const cancelsByCategory =
    cancelsByCatResult.status === "fulfilled"
      ? cancelsByCatResult.value
      : { cc: 0, cash: 0, account_credit: 0, other: 0 };
  if (cancelsByCatResult.status === "rejected") {
    console.error("Cancels by category fetch failed:", cancelsByCatResult.reason);
  }

  // 2. Get cancel amounts for fetched order IDs (still needed for promo/top customer calculations)
  const orderIds = salesRows.map((r) => r.order_id);
  const cancelMap = await getCancelAmounts(orderIds);

  // 3. Apply cancellations
  const adjustedRows = applyCancelAdjustments(salesRows, cancelMap);

  // 4. Get customer first purchases for new/returning determination
  const uniqueEmails = [
    ...new Set(
      adjustedRows
        .filter((r) => r.purchaser_email)
        .map((r) => r.purchaser_email!.toLowerCase().trim()),
    ),
  ];
  const firstPurchaseMap = await getCustomerFirstPurchases(uniqueEmails, period);

  // 5. Run all calculations
  const revenue = calculateRevenueBreakdown(adjustedRows, cardpointe, cancelsByCategory);
  const customers = calculateCustomerSegmentation(
    adjustedRows,
    firstPurchaseMap,
    period,
  );
  const payments = calculatePaymentAnalysis(adjustedRows);
  const promos = calculatePromoAnalysis(adjustedRows);
  const topCustomers = calculateTopCustomers(adjustedRows);
  // Avg Customer Value: prefer CardPointe actuals for CC, add cash + other from TDS
  const cashNet = revenue.by_category.find(c => c.name === "Cash")?.net ?? 0;
  const otherNet = revenue.by_category.find(c => c.name === "Other")?.net ?? 0;

  let avgCustomerValueNumerator: number;
  let avgCustomerValueSource: "cardpointe" | "tds_sales_orders";

  if (cardpointe && cardpointe.net_amount > 0) {
    avgCustomerValueNumerator = cardpointe.net_amount + cashNet + otherNet;
    avgCustomerValueSource = "cardpointe";
  } else {
    avgCustomerValueNumerator = revenue.new_cash;
    avgCustomerValueSource = "tds_sales_orders";
  }

  const avgCustomerValue = revenue.unique_customers > 0
    ? avgCustomerValueNumerator / revenue.unique_customers
    : 0;

  const marketing = calculateCAC({
    newCustomers: customers.new_customers,
    adSpend: adSpend.total_spend,
    adSpendCategories: adSpend.categories,
    transactionCount: adSpend.transaction_count,
    avgCustomerValue,
    avgCustomerValueSource,
  });

  // 6. Data quality checks
  const orderIdSet = new Set(adjustedRows.map((r) => r.order_id));
  const nullEmails = adjustedRows.filter((r) => !r.purchaser_email).length;
  const zeroRevenueRows = adjustedRows.filter(
    (r) => r.revenue_after_cancellations <= 0,
  );
  const zeroRevenue = zeroRevenueRows.length;

  // Top emails with zero-revenue orders
  const zeroRevEmailCounts = new Map<string, number>();
  for (const row of zeroRevenueRows) {
    if (!row.purchaser_email) continue;
    const email = row.purchaser_email.toLowerCase().trim();
    zeroRevEmailCounts.set(email, (zeroRevEmailCounts.get(email) ?? 0) + 1);
  }
  const topZeroRevenueEmails = [...zeroRevEmailCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, count]) => ({ email, count }));

  // Revenue variance: compare sum of payment amounts vs total_sale
  const paymentTotal = adjustedRows.reduce(
    (s, r) =>
      s + r.payment_amount_1 + r.payment_amount_2 + r.payment_amount_3 + r.payment_amount_4,
    0,
  );
  const saleTotal = adjustedRows.reduce(
    (s, r) => s + r.revenue_after_cancellations,
    0,
  );
  const revenueVariance =
    saleTotal > 0
      ? Math.round(Math.abs(paymentTotal - saleTotal) * 100) / 100
      : 0;

  const monthName = MONTH_NAMES[period.month];
  const loadedSources = ["bigquery"];
  const missingSources: string[] = [];
  const sourceDetails: Record<string, SourceDetail> = {
    bigquery: { displayName: "BigQuery", status: "ok" },
  };

  if (cardpointe) {
    loadedSources.push("cardpointe");
    sourceDetails.cardpointe = { displayName: "CardPointe", status: "ok" };
  } else {
    missingSources.push("cardpointe");
    sourceDetails.cardpointe = {
      displayName: "CardPointe",
      status: "error",
      message: cardpointeResult.status === "rejected"
        ? String(cardpointeResult.reason)
        : "No data returned",
    };
  }

  if (adSpendAvailable) {
    const adSpendEmpty = adSpend.total_spend === 0 && adSpend.transaction_count === 0;
    if (adSpendEmpty) {
      loadedSources.push("quickbooks_gl");
      sourceDetails.quickbooks_gl = {
        displayName: "QuickBooks GL (BigQuery)",
        status: "warning",
        message: `No ad spend rows found for ${monthName} ${period.year}`,
      };
    } else {
      loadedSources.push("quickbooks_gl");
      sourceDetails.quickbooks_gl = {
        displayName: "QuickBooks GL (BigQuery)",
        status: "ok",
      };
    }
  } else {
    missingSources.push("quickbooks_gl");
    sourceDetails.quickbooks_gl = {
      displayName: "QuickBooks GL (BigQuery)",
      status: "error",
      message: adSpendResult.status === "rejected"
        ? String(adSpendResult.reason)
        : "Connection failed",
    };
  }

  // Build data quality with optional ad spend warning
  const dataQuality: MasterMetrics["data_quality"] = {
    unique_orders_verified: orderIdSet.size === adjustedRows.length,
    emails_deduplicated: true,
    null_emails: nullEmails,
    validation_passed: orderIdSet.size === adjustedRows.length,
    revenue_variance: revenueVariance,
    zero_revenue_orders: zeroRevenue,
    top_zero_revenue_emails: topZeroRevenueEmails,
  };

  if (!adSpendAvailable) {
    (dataQuality as Record<string, unknown>).ad_spend_warning =
      "Ad spend data unavailable. Marketing metrics show zeros. Check QuickBooks GL data in BigQuery.";
  }

  // 7. Fetch prior-year data for YoY comparison (optional, non-blocking)
  const priorYearPeriod: MonthPeriod = { year: period.year - 1, month: period.month };
  const yoyComparison = await computeYoYComparison(
    revenue,
    customers,
    marketing,
    priorYearPeriod,
  );

  return {
    period: {
      year: period.year,
      month: MONTH_NAMES[period.month],
      month_num: period.month,
      date_range: { start: startDate, end: endDate },
    },
    current_month: {
      revenue,
      customers,
      marketing,
      payment_methods: payments,
      top_customers: topCustomers,
      promotions: promos,
    },
    comparisons: {
      month_over_month: {
        gross_bookings_change_percent: 0,
        customer_change_percent: 0,
        order_change_percent: 0,
      },
      year_over_year: yoyComparison,
    },
    data_quality: dataQuality,
    metadata: {
      generated_at: new Date().toISOString(),
      scripts_version: "dashboard-1.0",
      data_source: "bigquery+sheets",
      loaded_sources: loadedSources,
      missing_sources: missingSources,
      source_details: sourceDetails,
    },
  };
}

/** Fetch prior-year data and compute YoY comparison metrics.
 *  Uses Promise.allSettled so failure doesn't block the current month. */
async function computeYoYComparison(
  currentRevenue: MasterMetrics["current_month"]["revenue"],
  currentCustomers: MasterMetrics["current_month"]["customers"],
  currentMarketing: MasterMetrics["current_month"]["marketing"],
  priorPeriod: MonthPeriod,
): Promise<MasterMetricsComparison> {
  const empty: MasterMetricsComparison = {
    gross_bookings_change_percent: 0,
    customer_change_percent: 0,
    order_change_percent: 0,
  };

  const [salesResult, cardpointeResult, cancelsCatResult, adSpendResult] =
    await Promise.allSettled([
      getSalesOrders(priorPeriod),
      getCardPointeSettlements(priorPeriod),
      getCancelsByPaymentCategory(priorPeriod),
      getMonthlyAdSpend(priorPeriod),
    ]);

  if (salesResult.status === "rejected") {
    console.error("Prior-year sales fetch failed:", salesResult.reason);
    return empty;
  }

  const priorSalesRows = salesResult.value;
  if (priorSalesRows.length === 0) {
    return empty;
  }

  const priorCardpointe =
    cardpointeResult.status === "fulfilled" ? cardpointeResult.value : null;
  const priorCancelsCat =
    cancelsCatResult.status === "fulfilled"
      ? cancelsCatResult.value
      : { cc: 0, cash: 0, account_credit: 0, other: 0 };
  const priorAdSpend =
    adSpendResult.status === "fulfilled"
      ? adSpendResult.value
      : { categories: {} as Record<string, number>, total_spend: 0, transaction_count: 0 };

  // Get cancel amounts and compute prior-year metrics
  const priorOrderIds = priorSalesRows.map((r) => r.order_id);
  const priorCancelMap = await getCancelAmounts(priorOrderIds);
  const priorAdjusted = applyCancelAdjustments(priorSalesRows, priorCancelMap);

  const priorUniqueEmails = [
    ...new Set(
      priorAdjusted
        .filter((r) => r.purchaser_email)
        .map((r) => r.purchaser_email!.toLowerCase().trim()),
    ),
  ];
  const priorFirstPurchaseMap = await getCustomerFirstPurchases(
    priorUniqueEmails,
    priorPeriod,
  );

  const priorRevenue = calculateRevenueBreakdown(
    priorAdjusted,
    priorCardpointe,
    priorCancelsCat,
  );
  const priorCustomers = calculateCustomerSegmentation(
    priorAdjusted,
    priorFirstPurchaseMap,
    priorPeriod,
  );
  // Prior year avg customer value (same CardPointe-preferred logic)
  const priorCashNet = priorRevenue.by_category.find(c => c.name === "Cash")?.net ?? 0;
  const priorOtherNet = priorRevenue.by_category.find(c => c.name === "Other")?.net ?? 0;

  let priorAvgCVNumerator: number;
  let priorAvgCVSource: "cardpointe" | "tds_sales_orders";
  if (priorCardpointe && priorCardpointe.net_amount > 0) {
    priorAvgCVNumerator = priorCardpointe.net_amount + priorCashNet + priorOtherNet;
    priorAvgCVSource = "cardpointe";
  } else {
    priorAvgCVNumerator = priorRevenue.new_cash;
    priorAvgCVSource = "tds_sales_orders";
  }
  const priorAvgCustomerValue = priorRevenue.unique_customers > 0
    ? priorAvgCVNumerator / priorRevenue.unique_customers
    : 0;

  const priorMarketing = calculateCAC({
    newCustomers: priorCustomers.new_customers,
    adSpend: priorAdSpend.total_spend,
    adSpendCategories: priorAdSpend.categories,
    transactionCount: priorAdSpend.transaction_count,
    avgCustomerValue: priorAvgCustomerValue,
    avgCustomerValueSource: priorAvgCVSource,
  });

  function pctChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }

  return {
    gross_bookings_change_absolute: currentRevenue.gross_bookings - priorRevenue.gross_bookings,
    gross_bookings_change_percent: pctChange(
      currentRevenue.gross_bookings,
      priorRevenue.gross_bookings,
    ),
    net_bookings_change_absolute: currentRevenue.net_bookings - priorRevenue.net_bookings,
    net_bookings_change_percent: pctChange(
      currentRevenue.net_bookings,
      priorRevenue.net_bookings,
    ),
    new_cash_change_absolute: currentRevenue.new_cash - priorRevenue.new_cash,
    new_cash_change_percent: pctChange(
      currentRevenue.new_cash,
      priorRevenue.new_cash,
    ),
    customer_change_absolute:
      currentRevenue.unique_customers - priorRevenue.unique_customers,
    customer_change_percent: pctChange(
      currentRevenue.unique_customers,
      priorRevenue.unique_customers,
    ),
    order_change_absolute: currentRevenue.total_orders - priorRevenue.total_orders,
    order_change_percent: pctChange(
      currentRevenue.total_orders,
      priorRevenue.total_orders,
    ),
    avg_order_value_change_percent: pctChange(
      currentRevenue.avg_order_value,
      priorRevenue.avg_order_value,
    ),
    previous_gross_bookings: priorRevenue.gross_bookings,
    previous_net_bookings: priorRevenue.net_bookings,
    previous_new_cash: priorRevenue.new_cash,
    previous_orders: priorRevenue.total_orders,
    previous_customers: priorRevenue.unique_customers,
    previous_aov: priorRevenue.avg_order_value,
    previous_ad_spend: priorMarketing.ad_spend,
    previous_cac: priorMarketing.cac,
    ad_spend_change_absolute: currentMarketing.ad_spend - priorMarketing.ad_spend,
    ad_spend_change_percent: pctChange(
      currentMarketing.ad_spend,
      priorMarketing.ad_spend,
    ),
    cac_change_percent: pctChange(currentMarketing.cac, priorMarketing.cac),
    new_customers_change_percent: pctChange(
      currentCustomers.new_customers,
      priorCustomers.new_customers,
    ),
    previous_new_customers: priorCustomers.new_customers,
    avg_customer_value_change_percent: pctChange(
      currentMarketing.avg_customer_value,
      priorMarketing.avg_customer_value,
    ),
    previous_avg_customer_value: priorMarketing.avg_customer_value,
    cac_to_value_ratio_change_percent: pctChange(
      currentMarketing.cac_to_value_ratio,
      priorMarketing.cac_to_value_ratio,
    ),
    previous_cac_to_value_ratio: priorMarketing.cac_to_value_ratio,
    avg_customer_gross_profit_change_percent: pctChange(
      currentMarketing.avg_customer_gross_profit,
      priorMarketing.avg_customer_gross_profit,
    ),
    previous_avg_customer_gross_profit: priorMarketing.avg_customer_gross_profit,
  };
}
