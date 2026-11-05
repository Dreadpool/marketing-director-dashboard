// Saved snapshots retain their original contents. Only the fields used by the
// current marketing reports are sent to the browser.
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function monthCounts(value: unknown) {
  const row = object(value);
  return {
    orders: number(row.orders),
    purchasers: number(row.purchasers),
    newPurchasers: number(row.newPurchasers),
    returningPurchasers: number(row.returningPurchasers),
    adSpend: number(row.adSpend),
    costPerNewPurchaser: number(row.costPerNewPurchaser),
  };
}

export function savedMarketingReport(slug: string, value: unknown) {
  const data = object(value);
  const date = {
    dataRetrievedAt:
      data.dataRetrievedAt ??
      object(data.metadata).generated_at ??
      object(data.metadata).generatedAt,
  };
  if (slug === "monthly-analytics-review") {
    if (data.kind === "monthly-marketing") {
      return {
        ...date,
        kind: data.kind,
        current: monthCounts(data.current),
        priorYear: data.priorYear ? monthCounts(data.priorYear) : null,
      };
    }
    if (!data.current_month) return null;
    const month = object(data.current_month);
    const counts = object(month.revenue);
    const customers = object(month.customers);
    const marketing = object(month.marketing);
    const prior = object(object(data.comparisons).year_over_year);
    const missing = object(data.metadata).missing_sources;
    const hasSpend = !(
      Array.isArray(missing) && missing.includes("quickbooks_gl")
    );
    return {
      ...date,
      kind: "monthly-marketing",
      current: monthCounts({
        orders: counts.total_orders,
        purchasers: counts.unique_customers,
        newPurchasers: customers.new_customers,
        returningPurchasers: customers.returning_customers,
        adSpend: hasSpend ? marketing.ad_spend : null,
        costPerNewPurchaser:
          hasSpend && Number(customers.new_customers) > 0
            ? marketing.cac
            : null,
      }),
      priorYear:
        prior.previous_orders == null
          ? null
          : monthCounts({
              orders: prior.previous_orders,
              purchasers: prior.previous_customers,
              newPurchasers: prior.previous_new_customers,
              returningPurchasers:
                typeof prior.previous_customers === "number" &&
                typeof prior.previous_new_customers === "number"
                  ? prior.previous_customers - prior.previous_new_customers
                  : null,
              adSpend: prior.previous_ad_spend,
              costPerNewPurchaser:
                Number(prior.previous_new_customers) > 0
                  ? prior.previous_cac
                  : null,
            }),
    };
  }
  if (slug === "promo-code-analysis") {
    if (!data.promoCode) return null;
    const fields = [
      "promoCode",
      "dateRange",
      "totalOrders",
      "uniqueCustomers",
      "newCustomers",
      "returningCustomers",
      "newCustomerPct",
      "ordersPerCustomer",
      "totalDiscounted",
      "avgDiscountPerOrder",
      "weeklyUsage",
      "channelBreakdown",
      "campaignCost",
      "similarCodes",
      "derivedPeriod",
    ];
    return {
      ...date,
      ...Object.fromEntries(fields.map((key) => [key, data[key]])),
      spendPerFirstPurchaser:
        data.spendPerFirstPurchaser ?? object(data.roi).spendPerFirstPurchaser,
      topRoutes: Array.isArray(data.topRoutes)
        ? data.topRoutes.map((row) => ({
            route: object(row).route,
            orders: object(row).orders,
          }))
        : [],
    };
  }
  return value;
}
