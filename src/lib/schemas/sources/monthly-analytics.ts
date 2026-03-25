/** Typed from actual 2025-10/master_metrics.json structure */

export type MasterMetricsPeriod = {
  year: number;
  month: string;
  month_num: number;
  date_range: { start: string; end: string };
};

export type MasterMetricsRevenue = {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  unique_customers: number;
  revenue_per_customer: number;
  orders_per_customer: number;
};

export type MasterMetricsCustomers = {
  new_customers: number;
  returning_customers: number;
  new_customer_revenue: number;
  returning_customer_revenue: number;
  new_customer_avg_revenue: number;
  returning_customer_avg_revenue: number;
  new_customer_orders: number;
  returning_customer_orders: number;
};

export type MasterMetricsMarketing = {
  ad_spend: number;
  ad_spend_categories: Record<string, number>;
  transaction_count: number;
  cac: number;
  payback_ratio: number;
  new_customer_revenue: number;
  avg_new_customer_value: number;
  cost_per_revenue_dollar: number;
  revenue_per_dollar_spent: number;
  cac_30day_cash_ratio: number;
};

export type MasterMetricsPaymentMethods = {
  by_type: Record<string, number>;
  by_category: Record<string, number>;
  new_cash: number;
  credits: number;
  split_payments: {
    count: number;
    percentage: number;
    top_combinations: Array<{ combination: string; count: number }>;
  };
  total_amount: number;
  unique_types: number;
};

export type MasterMetricsTopCustomer = {
  rank: number;
  customer_name: string;
  email: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
};

export type MasterMetricsCustomerTier = {
  customer_count: number;
  total_revenue: number;
  revenue_share: number;
  avg_spend: number;
};

export type MasterMetricsTopCustomers = {
  top_10_list: MasterMetricsTopCustomer[];
  top_1_percent: MasterMetricsCustomerTier;
  top_10_percent: MasterMetricsCustomerTier;
  top_200_customers: MasterMetricsCustomerTier;
};

export type MasterMetricsPromoCode = {
  code: string;
  uses: number;
  revenue: number;
  discount: number;
  avg_discount: number;
  unique_customers: number;
};

export type MasterMetricsPromotions = {
  usage_metrics: {
    total_orders: number;
    promo_orders: number;
    promo_percentage: number;
    unique_customers_total: number;
    unique_customers_with_promo: number;
    total_discount_amount: number;
    avg_discount_per_promo: number;
    revenue_with_promo: number;
    revenue_without_promo: number;
    aov_with_promo: number;
    aov_without_promo: number;
  };
  top_promo_codes: MasterMetricsPromoCode[];
  suspicious_activity: {
    high_usage_customers: Array<{
      email: string;
      promo_count: number;
      total_discount: number;
      total_revenue: number;
      codes_used: string[];
    }>;
    suspicious_codes: Array<{
      code: string;
      uses: number;
      revenue: number;
      discount: number;
      issue: string;
    }>;
  };
};

export type MasterMetricsComparison = {
  revenue_change_absolute?: number;
  revenue_change_percent: number;
  customer_change_absolute?: number;
  customer_change_percent: number;
  order_change_absolute?: number;
  order_change_percent: number;
  ad_spend_change_absolute?: number;
  ad_spend_change_percent?: number;
  avg_order_value_change_percent?: number;
  revenue_per_dollar_spent?: number;
  cost_per_customer_change?: number;
  cac_change_percent?: number;
  previous_revenue?: number;
  previous_orders?: number;
  previous_customers?: number;
  previous_aov?: number;
  previous_revenue_per_customer?: number;
  previous_ad_spend?: number;
  previous_cac?: number;
  revenue_components?: {
    impact_of_customer_change: number;
    impact_of_spending_change: number;
    cross_effect: number;
  };
};

export type MasterMetricsDataQuality = {
  unique_orders_verified: boolean;
  emails_deduplicated: boolean;
  null_emails: number;
  validation_passed: boolean;
  revenue_variance: number;
  zero_revenue_orders: number;
};

export type MasterMetricsMetadata = {
  generated_at: string;
  scripts_version: string;
  data_source: string;
  loaded_sources: string[];
  missing_sources: string[];
};

export type MasterMetrics = {
  period: MasterMetricsPeriod;
  current_month: {
    revenue: MasterMetricsRevenue;
    customers: MasterMetricsCustomers;
    marketing: MasterMetricsMarketing;
    payment_methods: MasterMetricsPaymentMethods;
    top_customers: MasterMetricsTopCustomers;
    promotions: MasterMetricsPromotions;
  };
  comparisons: {
    month_over_month: MasterMetricsComparison;
    year_over_year: MasterMetricsComparison;
  };
  data_quality: MasterMetricsDataQuality;
  metadata: MasterMetricsMetadata;
};
