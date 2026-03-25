import type { MasterMetrics } from "../sources/monthly-analytics";
import type { DashboardMetrics } from "../dashboard";
import type { MonthlyComparison } from "../metrics";
import { createProvenance } from "../utils";

/** Fast path when master_metrics.json exists. Maps directly to DashboardMetrics. */
export function normalizeMonthlyAnalytics(
  data: MasterMetrics,
): DashboardMetrics {
  const dateRange = {
    start: data.period.date_range.start,
    end: data.period.date_range.end,
  };

  const bqProvenance = createProvenance("bigquery", dateRange, {
    isGroundTruth: true,
    notes: ["Via master_metrics.json"],
  });

  const monthlyProvenance = createProvenance("monthly_analytics", dateRange, {
    notes: [`Generated: ${data.metadata.generated_at}`],
  });

  const { revenue, customers, marketing, promotions } = data.current_month;
  const { month_over_month: mom, year_over_year: yoy } = data.comparisons;

  const momComparison: MonthlyComparison | undefined = mom
    ? {
        revenue: {
          direction: "mom",
          currentValue: revenue.total_revenue,
          previousValue: mom.previous_revenue ?? 0,
          absoluteChange: mom.revenue_change_absolute ?? 0,
          percentChange: mom.revenue_change_percent,
          previousPeriod: dateRange,
        },
        customers: {
          direction: "mom",
          currentValue: customers.new_customers + customers.returning_customers,
          previousValue: mom.previous_customers ?? 0,
          absoluteChange: mom.customer_change_absolute ?? 0,
          percentChange: mom.customer_change_percent,
          previousPeriod: dateRange,
        },
        orders: {
          direction: "mom",
          currentValue: revenue.total_orders,
          previousValue: mom.previous_orders ?? 0,
          absoluteChange: mom.order_change_absolute ?? 0,
          percentChange: mom.order_change_percent,
          previousPeriod: dateRange,
        },
        adSpend: mom.ad_spend_change_percent != null
          ? {
              direction: "mom",
              currentValue: marketing.ad_spend,
              previousValue: mom.previous_ad_spend ?? 0,
              absoluteChange: mom.ad_spend_change_absolute ?? 0,
              percentChange: mom.ad_spend_change_percent,
              previousPeriod: dateRange,
            }
          : undefined,
        cac: mom.cac_change_percent != null
          ? {
              direction: "mom",
              currentValue: marketing.cac,
              previousValue: mom.previous_cac ?? 0,
              absoluteChange: marketing.cac - (mom.previous_cac ?? 0),
              percentChange: mom.cac_change_percent,
              previousPeriod: dateRange,
            }
          : undefined,
      }
    : undefined;

  const yoyComparison: MonthlyComparison | undefined = yoy
    ? {
        revenue: {
          direction: "yoy",
          currentValue: revenue.total_revenue,
          previousValue: 0,
          absoluteChange: 0,
          percentChange: yoy.revenue_change_percent,
          previousPeriod: dateRange,
        },
        customers: {
          direction: "yoy",
          currentValue: customers.new_customers + customers.returning_customers,
          previousValue: 0,
          absoluteChange: 0,
          percentChange: yoy.customer_change_percent,
          previousPeriod: dateRange,
        },
        orders: {
          direction: "yoy",
          currentValue: revenue.total_orders,
          previousValue: 0,
          absoluteChange: 0,
          percentChange: yoy.order_change_percent,
          previousPeriod: dateRange,
        },
      }
    : undefined;

  const adSpendBreakdown: Record<string, number> = {};
  for (const [category, amount] of Object.entries(marketing.ad_spend_categories)) {
    adSpendBreakdown[category] = amount;
  }

  return {
    period: { year: data.period.year, month: data.period.month_num },
    dateRange,
    revenue: {
      actual: {
        source: "bigquery",
        amount: revenue.total_revenue,
        attributionWindow: "none",
        isGroundTruth: true,
        provenance: bqProvenance,
      },
      platformAttributed: [],
      totalOrders: revenue.total_orders,
      avgOrderValue: revenue.avg_order_value,
      revenuePerCustomer: revenue.revenue_per_customer,
      comparison: momComparison?.revenue,
    },
    customers: {
      total: revenue.unique_customers,
      new: customers.new_customers,
      returning: customers.returning_customers,
      newRevenue: customers.new_customer_revenue,
      returningRevenue: customers.returning_customer_revenue,
      newAvgRevenue: customers.new_customer_avg_revenue,
      returningAvgRevenue: customers.returning_customer_avg_revenue,
      provenance: bqProvenance,
      comparison: momComparison?.customers,
    },
    adSpend: {
      total: marketing.ad_spend,
      byPlatform: [
        {
          source: "monthly_analytics",
          amount: marketing.ad_spend,
          breakdown: adSpendBreakdown,
        },
      ],
      provenance: [monthlyProvenance],
      comparison: momComparison?.adSpend,
    },
    efficiency: {
      cac: {
        value: marketing.cac,
        totalSpend: marketing.ad_spend,
        newCustomers: customers.new_customers,
        paybackRatio: marketing.payback_ratio,
        provenance: [monthlyProvenance, bqProvenance],
        comparison: momComparison?.cac,
      },
      cpa: [],
      roas: [
        {
          source: "monthly_analytics",
          value: marketing.ad_spend > 0
            ? revenue.total_revenue / marketing.ad_spend
            : 0,
          revenue: revenue.total_revenue,
          spend: marketing.ad_spend,
          attributionWindow: "none",
          provenance: monthlyProvenance,
        },
      ],
    },
    conversions: [
      {
        source: "bigquery",
        count: revenue.total_orders,
        attributionWindow: "none",
        isGroundTruth: true,
        label: "Actual Orders (BigQuery)",
        provenance: bqProvenance,
      },
    ],
    promotions: {
      totalOrders: promotions.usage_metrics.total_orders,
      promoOrders: promotions.usage_metrics.promo_orders,
      promoPercentage: promotions.usage_metrics.promo_percentage,
      totalDiscountAmount: promotions.usage_metrics.total_discount_amount,
      avgDiscountPerPromo: promotions.usage_metrics.avg_discount_per_promo,
      revenueWithPromo: promotions.usage_metrics.revenue_with_promo,
      revenueWithoutPromo: promotions.usage_metrics.revenue_without_promo,
      aovWithPromo: promotions.usage_metrics.aov_with_promo,
      aovWithoutPromo: promotions.usage_metrics.aov_without_promo,
      topCodes: promotions.top_promo_codes.map((c) => ({
        code: c.code,
        uses: c.uses,
        revenue: c.revenue,
        discount: c.discount,
        uniqueCustomers: c.unique_customers,
      })),
      provenance: monthlyProvenance,
    },
    comparisons: {
      mom: momComparison,
      yoy: yoyComparison,
    },
    sources: [bqProvenance, monthlyProvenance],
    lastUpdated: data.metadata.generated_at,
  };
}
