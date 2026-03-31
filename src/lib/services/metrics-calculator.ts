import type {
  SalesOrderRow,
  CardPointeSettlement,
  CancelsByPaymentCategory,
} from "./bigquery-sales";
import type {
  MasterMetricsRevenue,
  MasterMetricsCustomers,
  MasterMetricsPaymentMethods,
  MasterMetricsPromotions,
  MasterMetricsTopCustomers,
  MasterMetricsMarketing,
} from "@/lib/schemas/sources/monthly-analytics";

// Payment type constants matching the Python pipeline
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

type AdjustedRow = SalesOrderRow & { revenue_after_cancellations: number };

/** Apply cancel map to rows, computing net revenue */
export function applyCancelAdjustments(
  rows: SalesOrderRow[],
  cancelMap: Map<number, number>,
): AdjustedRow[] {
  return rows.map((r) => ({
    ...r,
    revenue_after_cancellations: r.total_sale - (cancelMap.get(r.order_id) ?? 0),
  }));
}

/** Revenue breakdown: Gross Bookings as primary KPI, CardPointe for cross-validation only */
export function calculateRevenueBreakdown(
  rows: AdjustedRow[],
  cardpointe: CardPointeSettlement | null,
  cancelsByCategory: CancelsByPaymentCategory,
): MasterMetricsRevenue {
  // Split rebooks from original orders — rebooks inflate gross bookings
  const originalRows = rows.filter((r) => !r.previous_order);
  const rebookRows = rows.filter((r) => !!r.previous_order);

  const totalOrders = new Set(originalRows.map((r) => r.order_id)).size;

  // Rebook transparency metrics
  const rebookCount = new Set(rebookRows.map((r) => r.order_id)).size;
  let rebookAmount = 0;
  for (const row of rebookRows) {
    rebookAmount += row.payment_amount_1 + row.payment_amount_2 + row.payment_amount_3 + row.payment_amount_4;
  }

  // Sum gross payment slots by category from TDS (original orders only)
  let ccGross = 0;
  let cashGross = 0;
  let otherGross = 0;
  let accountCreditGross = 0;

  for (const row of originalRows) {
    const slots = [
      { type: row.payment_type_1, amount: row.payment_amount_1 },
      { type: row.payment_type_2, amount: row.payment_amount_2 },
      { type: row.payment_type_3, amount: row.payment_amount_3 },
      { type: row.payment_type_4, amount: row.payment_amount_4 },
    ];

    for (const slot of slots) {
      if (!slot.type || slot.amount === 0) continue;
      const cat = categorizePaymentType(slot.type);
      if (cat === "cc") ccGross += slot.amount;
      else if (cat === "cash") cashGross += slot.amount;
      else if (cat === "account_credit") accountCreditGross += slot.amount;
      else otherGross += slot.amount;
    }
  }

  // Subtract cancellations per category (no CardPointe override)
  const ccNet = ccGross - cancelsByCategory.cc;
  const cashNet = cashGross - cancelsByCategory.cash;
  const accountCreditNet = accountCreditGross - cancelsByCategory.account_credit;
  const otherNet = otherGross - cancelsByCategory.other;

  const grossBookings = ccGross + cashGross + otherGross + accountCreditGross;
  const totalCancels =
    cancelsByCategory.cc +
    cancelsByCategory.cash +
    cancelsByCategory.account_credit +
    cancelsByCategory.other;
  const netBookings = grossBookings - totalCancels;
  const netBookingRate = grossBookings > 0 ? netBookings / grossBookings : 0;
  const newCash = ccNet + cashNet + otherNet;

  // CardPointe cross-validation: how much TDS CC net differs from settlement
  const cardpointeVariance =
    cardpointe && cardpointe.net_amount > 0
      ? round2(ccNet - cardpointe.net_amount)
      : undefined;

  const byCategory = [
    { name: "Credit Cards", gross: round2(ccGross), cancels: round2(cancelsByCategory.cc), net: round2(ccNet) },
    { name: "Cash", gross: round2(cashGross), cancels: round2(cancelsByCategory.cash), net: round2(cashNet) },
    { name: "Other", gross: round2(otherGross), cancels: round2(cancelsByCategory.other), net: round2(otherNet) },
    { name: "Account Credits", gross: round2(accountCreditGross), cancels: round2(cancelsByCategory.account_credit), net: round2(accountCreditNet) },
  ];

  const uniqueEmails = new Set(
    rows
      .filter((r) => r.purchaser_email)
      .map((r) => r.purchaser_email!.toLowerCase().trim()),
  );

  return {
    gross_bookings: round2(grossBookings),
    net_bookings: round2(netBookings),
    net_booking_rate: round2(netBookingRate),
    new_cash: round2(newCash),
    total_orders: totalOrders,
    avg_order_value: totalOrders > 0 ? round2(grossBookings / totalOrders) : 0,
    unique_customers: uniqueEmails.size,
    revenue_per_customer:
      uniqueEmails.size > 0 ? round2(grossBookings / uniqueEmails.size) : 0,
    orders_per_customer:
      uniqueEmails.size > 0 ? round2(totalOrders / uniqueEmails.size) : 0,
    by_category: byCategory,
    total_cancels: round2(totalCancels),
    rebook_orders: rebookCount,
    rebook_amount: round2(rebookAmount),
    cardpointe_variance: cardpointeVariance,
  };
}

/** Payment method breakdown by individual type, with split payment analysis */
export function calculatePaymentAnalysis(
  rows: AdjustedRow[],
): MasterMetricsPaymentMethods {
  const byType: Record<string, number> = {};

  let splitCount = 0;
  const comboCounts: Record<string, number> = {};

  for (const row of rows) {
    const slots = [
      { type: row.payment_type_1, amount: row.payment_amount_1 },
      { type: row.payment_type_2, amount: row.payment_amount_2 },
      { type: row.payment_type_3, amount: row.payment_amount_3 },
      { type: row.payment_type_4, amount: row.payment_amount_4 },
    ];

    // Track split payments (has payment_type_2)
    if (row.payment_type_2) {
      splitCount++;
      const types = slots
        .filter((s) => s.type)
        .map((s) => s.type!)
        .sort()
        .join(" + ");
      comboCounts[types] = (comboCounts[types] ?? 0) + 1;
    }

    for (const slot of slots) {
      if (!slot.type || slot.amount === 0) continue;
      byType[slot.type] = (byType[slot.type] ?? 0) + slot.amount;
    }
  }

  // Top split payment combinations
  const topCombinations = Object.entries(comboCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([combination, count]) => ({ combination, count }));

  // Round all values
  for (const key of Object.keys(byType)) byType[key] = round2(byType[key]);

  return {
    by_type: byType,
    split_payments: {
      count: splitCount,
      percentage: rows.length > 0 ? round2((splitCount / rows.length) * 100) : 0,
      top_combinations: topCombinations,
    },
    unique_types: Object.keys(byType).length,
  };
}

/** New vs returning customer segmentation. */
export function calculateCustomerSegmentation(
  rows: AdjustedRow[],
  firstPurchaseMap: Map<string, string>,
  period: { year: number; month: number },
): MasterMetricsCustomers {
  const startDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
  const endDate = new Date(period.year, period.month, 0)
    .toISOString()
    .slice(0, 10);

  const customerData = new Map<
    string,
    { revenue: number; orders: number; isNew: boolean }
  >();

  for (const row of rows) {
    if (!row.purchaser_email) continue;
    const email = row.purchaser_email.toLowerCase().trim();

    const existing = customerData.get(email) ?? {
      revenue: 0,
      orders: 0,
      isNew: false,
    };
    existing.revenue += row.total_sale;
    existing.orders += 1;

    const firstPurchase = firstPurchaseMap.get(email);
    if (firstPurchase && firstPurchase >= startDate && firstPurchase <= endDate) {
      existing.isNew = true;
    }

    customerData.set(email, existing);
  }

  let newCustomers = 0;
  let returningCustomers = 0;
  let newCustomerRevenue = 0;
  let returningCustomerRevenue = 0;
  let newCustomerOrders = 0;
  let returningCustomerOrders = 0;

  for (const data of customerData.values()) {
    if (data.isNew) {
      newCustomers++;
      newCustomerRevenue += data.revenue;
      newCustomerOrders += data.orders;
    } else {
      returningCustomers++;
      returningCustomerRevenue += data.revenue;
      returningCustomerOrders += data.orders;
    }
  }

  return {
    new_customers: newCustomers,
    returning_customers: returningCustomers,
    new_customer_revenue: round2(newCustomerRevenue),
    returning_customer_revenue: round2(returningCustomerRevenue),
    new_customer_avg_revenue:
      newCustomers > 0 ? round2(newCustomerRevenue / newCustomers) : 0,
    returning_customer_avg_revenue:
      returningCustomers > 0
        ? round2(returningCustomerRevenue / returningCustomers)
        : 0,
    new_customer_orders: newCustomerOrders,
    returning_customer_orders: returningCustomerOrders,
  };
}

/** Promo code usage, top codes, and suspicious activity */
export function calculatePromoAnalysis(
  rows: AdjustedRow[],
): MasterMetricsPromotions {
  const promoRows = rows.filter(
    (r) => r.promotion_code && r.promotion_code !== "null" && r.promotion_code !== "",
  );
  const nonPromoRows = rows.filter(
    (r) => !r.promotion_code || r.promotion_code === "null" || r.promotion_code === "",
  );

  const uniqueCustomersTotal = new Set(
    rows
      .filter((r) => r.purchaser_email)
      .map((r) => r.purchaser_email!.toLowerCase().trim()),
  ).size;

  const uniqueCustomersWithPromo = new Set(
    promoRows
      .filter((r) => r.purchaser_email)
      .map((r) => r.purchaser_email!.toLowerCase().trim()),
  ).size;

  const promoRevenue = promoRows.reduce(
    (s, r) => s + r.revenue_after_cancellations,
    0,
  );
  const nonPromoRevenue = nonPromoRows.reduce(
    (s, r) => s + r.revenue_after_cancellations,
    0,
  );
  const totalDiscount = promoRows.reduce((s, r) => s + r.amount_discounted, 0);

  // Top promo codes
  const codeMap = new Map<
    string,
    {
      uses: number;
      revenue: number;
      discount: number;
      customers: Set<string>;
    }
  >();

  for (const row of promoRows) {
    const code = row.promotion_code!;
    const existing = codeMap.get(code) ?? {
      uses: 0,
      revenue: 0,
      discount: 0,
      customers: new Set<string>(),
    };
    existing.uses++;
    existing.revenue += row.revenue_after_cancellations;
    existing.discount += row.amount_discounted;
    if (row.purchaser_email)
      existing.customers.add(row.purchaser_email.toLowerCase().trim());
    codeMap.set(code, existing);
  }

  const topCodes = [...codeMap.entries()]
    .sort(([, a], [, b]) => b.uses - a.uses)
    .slice(0, 20)
    .map(([code, data]) => ({
      code,
      uses: data.uses,
      revenue: round2(data.revenue),
      discount: round2(data.discount),
      avg_discount: data.uses > 0 ? round2(data.discount / data.uses) : 0,
      unique_customers: data.customers.size,
    }));

  // Suspicious activity: high usage customers (5+ promo uses)
  const customerPromoUse = new Map<
    string,
    { count: number; discount: number; revenue: number; codes: Set<string> }
  >();

  for (const row of promoRows) {
    if (!row.purchaser_email) continue;
    const email = row.purchaser_email.toLowerCase().trim();
    const existing = customerPromoUse.get(email) ?? {
      count: 0,
      discount: 0,
      revenue: 0,
      codes: new Set<string>(),
    };
    existing.count++;
    existing.discount += row.amount_discounted;
    existing.revenue += row.revenue_after_cancellations;
    existing.codes.add(row.promotion_code!);
    customerPromoUse.set(email, existing);
  }

  const highUsageCustomers = [...customerPromoUse.entries()]
    .filter(([, d]) => d.count >= 5)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 20)
    .map(([email, d]) => ({
      email,
      promo_count: d.count,
      total_discount: round2(d.discount),
      total_revenue: round2(d.revenue),
      codes_used: [...d.codes],
    }));

  // Suspicious codes: revenue <= 0 or discount > 50% of revenue
  const suspiciousCodes = [...codeMap.entries()]
    .filter(([, d]) => d.revenue <= 0 || d.discount > d.revenue * 0.5)
    .map(([code, d]) => ({
      code,
      uses: d.uses,
      revenue: round2(d.revenue),
      discount: round2(d.discount),
      issue:
        d.revenue <= 0
          ? "Zero or negative revenue"
          : "Discount exceeds 50% of revenue",
    }));

  return {
    usage_metrics: {
      total_orders: new Set(rows.map((r) => r.order_id)).size,
      promo_orders: promoRows.length,
      promo_percentage:
        rows.length > 0
          ? round2((promoRows.length / rows.length) * 100)
          : 0,
      unique_customers_total: uniqueCustomersTotal,
      unique_customers_with_promo: uniqueCustomersWithPromo,
      total_discount_amount: round2(totalDiscount),
      avg_discount_per_promo:
        promoRows.length > 0 ? round2(totalDiscount / promoRows.length) : 0,
      revenue_with_promo: round2(promoRevenue),
      revenue_without_promo: round2(nonPromoRevenue),
      aov_with_promo:
        promoRows.length > 0 ? round2(promoRevenue / promoRows.length) : 0,
      aov_without_promo:
        nonPromoRows.length > 0
          ? round2(nonPromoRevenue / nonPromoRows.length)
          : 0,
    },
    top_promo_codes: topCodes,
    suspicious_activity: {
      high_usage_customers: highUsageCustomers,
      suspicious_codes: suspiciousCodes,
    },
  };
}

/** Top customer tiers (1%, 10%, 200) and top 10 individual list */
export function calculateTopCustomers(
  rows: AdjustedRow[],
): MasterMetricsTopCustomers {
  // Aggregate by customer email
  const customerMap = new Map<
    string,
    {
      name: string;
      email: string;
      revenue: number;
      orders: number;
      routes: Map<string, { origin: string; destination: string; count: number }>;
    }
  >();

  for (const row of rows) {
    if (!row.purchaser_email) continue;
    const email = row.purchaser_email.toLowerCase().trim();
    const existing = customerMap.get(email) ?? {
      name: `${row.purchaser_first_name ?? ""} ${row.purchaser_last_name ?? ""}`.trim(),
      email,
      revenue: 0,
      orders: 0,
      routes: new Map(),
    };
    existing.revenue += row.revenue_after_cancellations;
    existing.orders++;
    if (row.trip_origin_stop && row.trip_destination_stop) {
      const routeKey = `${row.trip_origin_stop}→${row.trip_destination_stop}`;
      const r = existing.routes.get(routeKey) ?? {
        origin: row.trip_origin_stop,
        destination: row.trip_destination_stop,
        count: 0,
      };
      r.count++;
      existing.routes.set(routeKey, r);
    }
    customerMap.set(email, existing);
  }

  const sorted = [...customerMap.values()].sort(
    (a, b) => b.revenue - a.revenue,
  );
  const totalCustomers = sorted.length;
  const totalRevenue = sorted.reduce((s, c) => s + c.revenue, 0);

  function tierStats(count: number) {
    const slice = sorted.slice(0, count);
    const tierRevenue = slice.reduce((s, c) => s + c.revenue, 0);
    return {
      customer_count: count,
      total_revenue: round2(tierRevenue),
      revenue_share: totalRevenue > 0 ? round2((tierRevenue / totalRevenue) * 100) : 0,
      avg_spend: count > 0 ? round2(tierRevenue / count) : 0,
    };
  }

  const top1Count = Math.max(1, Math.floor(totalCustomers * 0.01));
  const top10Count = Math.max(1, Math.floor(totalCustomers * 0.1));
  const top200Count = Math.min(200, totalCustomers);

  const top10List = sorted.slice(0, 10).map((c, i) => {
    let topRoute: { origin: string; destination: string; count: number } | undefined;
    if (c.routes.size > 0) {
      topRoute = [...c.routes.values()].sort((a, b) => b.count - a.count)[0];
    }
    return {
      rank: i + 1,
      customer_name: c.name,
      email: c.email,
      revenue: round2(c.revenue),
      orders: c.orders,
      avg_order_value: c.orders > 0 ? round2(c.revenue / c.orders) : 0,
      top_route: topRoute,
    };
  });

  return {
    top_10_list: top10List,
    top_1_percent: tierStats(top1Count),
    top_10_percent: tierStats(top10Count),
    top_200_customers: tierStats(top200Count),
  };
}

/** Order-level gross margin for REGULAR routes (what ads drive).
 *  $27.10 GP per passenger × 1.3 avg passengers = $35.23 GP on ~$82 avg order = 43%.
 *  The blended margin including grant-funded routes is higher, but those routes have
 *  artificially high margins from subsidies and don't reflect acquisition economics.
 *  Hardcoded until dynamic COGS from QB GL by route type. */
const GROSS_MARGIN = 0.43;

/** CAC and marketing efficiency metrics */
export function calculateCAC(params: {
  newCustomers: number;
  adSpend: number;
  adSpendCategories: Record<string, number>;
  transactionCount: number;
  avgCustomerValue: number;
  avgCustomerValueSource: "cardpointe" | "tds_sales_orders";
}): MasterMetricsMarketing {
  const { newCustomers, adSpend, adSpendCategories, transactionCount,
          avgCustomerValue, avgCustomerValueSource } = params;

  const cac = newCustomers > 0 ? adSpend / newCustomers : 0;
  const avgCustomerGrossProfit = avgCustomerValue * GROSS_MARGIN;
  const cacToValueRatio = cac > 0 ? avgCustomerGrossProfit / cac : 0;

  return {
    ad_spend: round2(adSpend),
    ad_spend_categories: adSpendCategories,
    transaction_count: transactionCount,
    cac: round2(cac),
    avg_customer_value: round2(avgCustomerValue),
    avg_customer_gross_profit: round2(avgCustomerGrossProfit),
    avg_customer_value_source: avgCustomerValueSource,
    cac_to_value_ratio: round2(cacToValueRatio),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
