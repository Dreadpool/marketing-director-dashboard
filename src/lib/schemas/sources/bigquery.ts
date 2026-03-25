/** BigQuery revenue row from vw_sle_active_orders */
export type BigQueryRevenueRow = {
  order_id: number;
  purchase_date: string;
  pk_email: string;
  purchaser_email: string;
  purchaser_first_name?: string;
  purchaser_last_name?: string;
  total_sale: number;
  amount_discounted: number;
  fares?: number;
  baggage?: number;
  tax?: number;
  total_paid_ins?: number;
  trip_type?: string;
  trip_origin_stop?: string;
  trip_destination_stop?: string;
  origin_state?: string;
  destination_state?: string;
  num_passengers?: number;
  promotion_code?: string;
  payment_type_1?: string;
  payment_amount_1?: number;
  payment_type_2?: string;
  payment_amount_2?: number;
  selling_company: string;
  activity_type?: string;
};

/** BigQuery customer row from customer_first_order view */
export type BigQueryCustomerRow = {
  pk_email: string;
  first_order_date: string;
  total_orders: number;
  total_revenue: number;
  is_new: boolean;
};

/** Aggregated BigQuery stats for a period */
export type BigQueryPeriodSummary = {
  total_revenue: number;
  total_orders: number;
  unique_customers: number;
  new_customers: number;
  returning_customers: number;
  new_customer_revenue: number;
  returning_customer_revenue: number;
  avg_order_value: number;
};
