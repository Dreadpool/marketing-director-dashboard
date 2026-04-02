"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import type { PromoCodeMetrics } from "@/lib/workflows/executors/fetch-promo-code";

// ─── Type guard ──────────────────────────────────────────────────────────────

export function isPromoCodeMetrics(data: unknown): data is PromoCodeMetrics {
  return (
    typeof data === "object" &&
    data !== null &&
    "promoCode" in data &&
    "topRoutes" in data
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat("en-US");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string, days: number): string {
  if (!start || !end) return "";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `Active: ${fmt(start)} — ${fmt(end)} (${days} days)`;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  secondary,
  valueClass,
}: {
  label: string;
  value: string;
  secondary?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-bold font-heading tabular-nums ${valueClass ?? ""}`}>
        {value}
      </p>
      {secondary && (
        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
          {secondary}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PromoCodeFetchSummary({ data }: { data: PromoCodeMetrics }) {
  const {
    promoCode,
    dateRange,
    totalOrders,
    grossRevenue,
    avgOrderValue,
    uniqueCustomers,
    newCustomers,
    returningCustomers,
    newCustomerPct,
    ordersPerCustomer,
    totalDiscounted,
    avgDiscountPerOrder,
    baselineAov,
    topRoutes,
    weeklyUsage,
    campaignCost,
    roi,
  } = data;

  const isEmpty = totalOrders === 0;

  return (
    <div className="space-y-6">
      {/* Header: code badge + date range */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Badge className="bg-gold/10 text-gold border border-gold/20 text-sm font-mono font-semibold px-3 py-0.5">
            {promoCode}
          </Badge>
        </div>
        {dateRange.start ? (
          <p className="text-[12px] text-muted-foreground">
            {formatDateRange(dateRange.start, dateRange.end, dateRange.days)}
          </p>
        ) : (
          <p className="text-[12px] text-muted-foreground">No active date range</p>
        )}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-lg border border-border bg-muted/50 px-5 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No orders found for promo code{" "}
            <span className="font-mono font-semibold text-foreground">{promoCode}</span>.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            The AI analysis below will suggest similar codes if any exist.
          </p>
        </div>
      )}

      {/* Headline KPI grid — hidden when empty */}
      {!isEmpty && (
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="Total Orders"
            value={num.format(totalOrders)}
          />
          <KpiCard
            label="Gross Revenue"
            value={usd.format(grossRevenue)}
            secondary={`Avg ${usd2.format(avgOrderValue)}/order`}
          />
          <KpiCard
            label="New Customers"
            value={num.format(newCustomers)}
            valueClass="text-emerald-400"
            secondary={`${newCustomerPct.toFixed(1)}% new / ${(100 - newCustomerPct).toFixed(1)}% returning`}
          />
          <KpiCard
            label="Unique Customers"
            value={num.format(uniqueCustomers)}
            secondary={`${ordersPerCustomer.toFixed(1)} orders/customer`}
          />
        </div>
      )}

      {/* Campaign ROI section — conditional */}
      {!isEmpty && campaignCost && roi && (
        <div className="rounded-lg border border-gold/20 bg-gold/5 px-5 py-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-gold font-semibold">
            Campaign ROI
          </p>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Revenue Return
              </p>
              <p className="text-2xl font-bold font-heading tabular-nums">
                {roi.revenueReturn.toFixed(1)}x
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Gross Profit Return
              </p>
              <p
                className={`text-2xl font-bold font-heading tabular-nums ${
                  roi.grossProfitReturn >= 1.0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {roi.grossProfitReturn.toFixed(1)}x
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Cost per Acquisition
              </p>
              <p className="text-2xl font-bold font-heading tabular-nums">
                {usd2.format(roi.costPerAcquisition)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Net Profit
              </p>
              <p
                className={`text-2xl font-bold font-heading tabular-nums ${
                  roi.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {roi.netProfit >= 0 ? "+" : ""}
                {usd.format(roi.netProfit)}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Campaign cost: {usd.format(campaignCost)} &bull; 43% gross margin applied
          </p>
        </div>
      )}

      {/* Detail cards: Discount Impact + Top Routes */}
      {!isEmpty && (
        <div className="grid grid-cols-2 gap-3">
          {/* Left: Discount Impact */}
          <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Discount Impact
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total discounted</span>
                <span className="text-sm font-semibold tabular-nums">
                  {usd.format(totalDiscounted)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Avg discount/order</span>
                <span className="text-sm font-semibold tabular-nums">
                  {usd2.format(avgDiscountPerOrder)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">AOV with promo</span>
                <span className="text-sm font-semibold tabular-nums">
                  {usd2.format(avgOrderValue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">AOV baseline (no promo)</span>
                <span className="text-sm font-semibold tabular-nums">
                  {baselineAov > 0 ? usd2.format(baselineAov) : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Top Routes */}
          <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Top Routes
            </p>
            <div className="space-y-2">
              {topRoutes.slice(0, 5).map((r) => (
                <div key={r.route} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {r.route}
                  </span>
                  <span className="text-sm font-semibold tabular-nums shrink-0 ml-3">
                    {num.format(r.orders)} orders
                  </span>
                </div>
              ))}
              {topRoutes.length === 0 && (
                <p className="text-xs text-muted-foreground">No route data</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Usage bar chart */}
      {!isEmpty && weeklyUsage.length > 0 && (
        <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Weekly Usage
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={weeklyUsage}
              margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
              barCategoryGap="25%"
            >
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 11, fill: "#e0e0e0" }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "#1a1a24",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#e0e0e0",
                  padding: "8px 12px",
                }}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                labelFormatter={(label) => `Week of ${label}`}
                formatter={(value) => [
                  `${num.format(Number(value))} orders`,
                  "",
                ]}
              />
              <Bar
                dataKey="orders"
                fill="oklch(0.78 0.12 85)"
                radius={[3, 3, 0, 0]}
              >
                <LabelList
                  dataKey="orders"
                  position="insideTop"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: "#111",
                  }}
                  offset={6}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
