export interface RouteData {
  name: string;
  revenue: number;
  sle_revenue: number;
  flix_revenue: number;
  other_revenue: number;
  passengers: number;
  sle_passengers: number;
  flix_passengers: number;
  other_passengers: number;
  d2d_count: number;
  d2d_revenue: number;
}

export interface YoyDelta {
  prior: number;
  delta_pct: number;
  delta_abs: number;
}

export interface YoySummary {
  total_revenue: YoyDelta | null;
  sle_revenue: YoyDelta | null;
  interline_revenue: YoyDelta | null;
  total_passengers: YoyDelta | null;
}

export interface ReportSummary {
  total_revenue: number;
  sle_revenue: number;
  flix_revenue: number;
  other_revenue: number;
  interline_revenue: number;
  total_passengers: number;
  yoy: YoySummary;
}

export interface RouteWithYoy extends RouteData {
  yoy_revenue: YoyDelta | null;
  yoy_passengers: YoyDelta | null;
}

export interface FeeData {
  allocated: {
    processing_fee: number;
    excess_baggage: number;
    terminal_fee: number;
    other: number;
    total: number;
  };
  non_allocated: {
    door_service_fee: number;
    driver_gratuity: number;
    total: number;
  };
  fee_rate: number;
}

export interface Commission {
  carrier: string;
  amount: number;
}

export interface ReportResponse {
  month: string;
  summary: ReportSummary;
  routes: RouteWithYoy[];
  fees: FeeData;
  interline_commissions: Commission[];
  available_months: string[];
}
