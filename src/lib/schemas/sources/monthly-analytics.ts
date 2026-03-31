/** Typed from actual 2025-10/master_metrics.json structure */

export type MasterMetricsPeriod = {
  year: number;
  month: string;
  month_num: number;
  date_range: { start: string; end: string };
};

export type RevenueByCategory = {
  name: string; // "Credit Cards", "Cash", "Account Credits", "Other"
  gross: number;
  cancels: number;
  net: number;
};

export type MasterMetricsRevenue = {
  gross_bookings: number; // sum of all payment slots (primary KPI)
  net_bookings: number; // gross minus all cancel amounts
  net_booking_rate: number; // net / gross as decimal (0.81 = 81%)
  new_cash: number; // CC net + cash net + other net (no account credits)
  total_orders: number;
  avg_order_value: number; // gross_bookings / total_orders
  unique_customers: number;
  revenue_per_customer: number; // uses gross_bookings
  orders_per_customer: number;
  by_category: RevenueByCategory[];
  total_cancels: number; // sum of all cancel amounts
  rebook_orders: number; // orders with previous_order set (excluded from gross/orders)
  rebook_amount: number; // total payment amount from rebook orders (excluded from gross)
  cardpointe_variance?: number; // CC net (TDS) minus CC net (CardPointe)
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
  avg_customer_value: number;
  avg_customer_value_source: "cardpointe" | "tds_sales_orders";
  cac_to_value_ratio: number;
};

export type MasterMetricsPaymentMethods = {
  by_type: Record<string, number>;
  split_payments: {
    count: number;
    percentage: number;
    top_combinations: Array<{ combination: string; count: number }>;
  };
  unique_types: number;
};

export type MasterMetricsTopCustomer = {
  rank: number;
  customer_name: string;
  email: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
  top_route?: { origin: string; destination: string; count: number };
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
  gross_bookings_change_absolute?: number;
  gross_bookings_change_percent: number;
  net_bookings_change_absolute?: number;
  net_bookings_change_percent?: number;
  new_cash_change_absolute?: number;
  new_cash_change_percent?: number;
  customer_change_absolute?: number;
  customer_change_percent: number;
  order_change_absolute?: number;
  order_change_percent: number;
  ad_spend_change_absolute?: number;
  ad_spend_change_percent?: number;
  avg_order_value_change_percent?: number;
  cac_change_percent?: number;
  previous_gross_bookings?: number;
  previous_net_bookings?: number;
  previous_new_cash?: number;
  previous_orders?: number;
  previous_customers?: number;
  previous_aov?: number;
  previous_ad_spend?: number;
  previous_cac?: number;
  new_customers_change_percent?: number;
  previous_new_customers?: number;
  avg_customer_value_change_percent?: number;
  previous_avg_customer_value?: number;
  cac_to_value_ratio_change_percent?: number;
  previous_cac_to_value_ratio?: number;
};

export type ZeroRevenueEmail = {
  email: string;
  count: number;
};

export type MasterMetricsDataQuality = {
  unique_orders_verified: boolean;
  emails_deduplicated: boolean;
  null_emails: number;
  validation_passed: boolean;
  revenue_variance: number;
  zero_revenue_orders: number;
  top_zero_revenue_emails?: ZeroRevenueEmail[];
};

export type SourceDetail = {
  displayName: string;
  status: "ok" | "warning" | "error";
  message?: string;
};

export type MasterMetricsMetadata = {
  generated_at: string;
  scripts_version: string;
  data_source: string;
  loaded_sources: string[];
  missing_sources: string[];
  source_details?: Record<string, SourceDetail>;
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
