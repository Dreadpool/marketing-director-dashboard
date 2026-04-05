"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import type {
  MasterMetrics,
  MasterMetricsTopCustomer,
  SourceDetail,
} from "@/lib/schemas/sources/monthly-analytics";
import {
  HorizontalBarChart,
  EMERALD,
  MUTED,
} from "./fetch-step-charts";
import {
  MetaAdsFetchSummary,
  isMetaAdsMetrics,
} from "./meta-ads-fetch-summary";
import {
  PromoCodeFetchSummary,
  isPromoCodeMetrics,
} from "./promo-code-fetch-summary";
import {
  SeoRankingFetchSummary,
  isSeoRankingMetrics,
} from "./seo-ranking-fetch-summary";

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
const pct = (n: number) => `${n.toFixed(1)}%`;

// ─── Type guard ──────────────────────────────────────────────────────────────

function isMasterMetrics(data: unknown): data is MasterMetrics {
  return (
    typeof data === "object" &&
    data !== null &&
    "metadata" in data &&
    "current_month" in data &&
    typeof (data as MasterMetrics).metadata?.loaded_sources !== "undefined"
  );
}

// ─── CollapsibleSection ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {title}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ─── MetricCell ──────────────────────────────────────────────────────────────

function yoyColor(change: number, good: "up" | "down" | "neutral"): string {
  if (good === "neutral") return "text-muted-foreground";
  const isGood = (good === "up" && change > 0) || (good === "down" && change < 0);
  return isGood ? "text-emerald-400" : "text-red-400";
}

function MetricCell({
  label,
  value,
  secondary,
  tooltip,
  yoyChange,
  goodDirection,
}: {
  label: string;
  value: string;
  secondary?: React.ReactNode;
  tooltip?: string;
  yoyChange?: number;
  goodDirection?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-md bg-muted/50 px-4 py-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="inline-flex items-center gap-1 text-[11px] text-muted-foreground cursor-help">
            {label}
            {tooltip && <Info className="h-3 w-3 text-muted-foreground/50" />}
          </TooltipTrigger>
          {tooltip && (
            <TooltipContent side="top" className="max-w-xs text-xs">
              {tooltip}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-lg font-heading font-semibold tabular-nums">
          {value}
        </p>
        {yoyChange != null && yoyChange !== 0 && goodDirection && (
          <span className={`text-[11px] font-medium tabular-nums shrink-0 ${yoyColor(yoyChange, goodDirection)}`}>
            {yoyChange > 0 ? "▲" : "▼"} {Math.abs(yoyChange).toFixed(1)}%
          </span>
        )}
      </div>
      {secondary && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {secondary}
        </p>
      )}
    </div>
  );
}

// ─── HeadlineMetrics ─────────────────────────────────────────────────────────

function NetBookingRateBadge({ rate }: { rate: number }) {
  const pctVal = rate * 100;
  const color =
    pctVal >= 82
      ? "text-emerald-400"
      : pctVal >= 78
        ? "text-amber-400"
        : "text-red-400";
  return <span className={`${color} font-medium`}>{pct(pctVal)} held</span>;
}

function HeadlineMetrics({ data }: { data: MasterMetrics }) {
  const { revenue: rev, customers: cust, marketing: mkt } = data.current_month;
  const yoy = data.comparisons?.year_over_year;
  const hasYoY = yoy && yoy.gross_bookings_change_percent !== 0;
  const priorYear = data.period.year - 1;
  const monthName = data.period.month;
  return (
    <div className="space-y-3">
      {hasYoY && (
        <p className="text-[11px] text-muted-foreground/60 text-right">
          Arrows compare to {monthName} {priorYear}
        </p>
      )}
      {/* Row 1: Revenue */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCell
          label="Gross Bookings"
          value={usd.format(rev.gross_bookings)}
          secondary={`${num.format(rev.total_orders)} orders, ${usd2.format(rev.avg_order_value)} avg`}
          tooltip="Total payment amounts on all Sale records for the month, before cancellations. Excludes voided orders (failed payments) and orders that were rescheduled to a new booking in the same month. The replacement booking is counted instead. If a customer rebooks across months (e.g. books in Jan, reschedules in Feb), both months show their respective booking. This means adding months together slightly overcounts rebook activity in Gross, but Net Bookings corrects for this since the cancel offsets the original."
          yoyChange={yoy?.gross_bookings_change_percent}
          goodDirection="up"
        />
        <MetricCell
          label="Net Bookings"
          value={usd.format(rev.net_bookings)}
          secondary={<NetBookingRateBadge rate={rev.net_booking_rate} />}
          tooltip="Gross Bookings minus true cancellation amounts. True cancels are Cancel records where the order was not voided and not rebooked (no other Sale has previous_order pointing to this order_id). Cancel amounts use ABS(canceled_outbound_fare + canceled_return_fare + canceled_baggage_fee), the refund amount excluding the ~$4 processing fee we retain. Source: BigQuery tds_sales.sales_orders."
          yoyChange={yoy?.net_bookings_change_percent}
          goodDirection="up"
        />
        <MetricCell
          label="New Cash"
          value={usd.format(rev.new_cash)}
          tooltip="Net revenue from payment types that represent incoming cash: credit cards (Visa, Mastercard, AmEx, Discover), POS Cash, and Driver Collect Payment. Excludes Customer Account Credit (recycled balances) and Corporate Account (billed separately). Calculated as gross per category minus true cancel amounts per category. Source: BigQuery tds_sales.sales_orders."
          yoyChange={yoy?.new_cash_change_percent}
          goodDirection="up"
        />
      </div>
      {/* Row 2: Acquisition */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCell
          label="Orders"
          value={num.format(rev.total_orders)}
          secondary={
            <>
              {num.format(rev.unique_customers)} customers
              {rev.rebook_orders > 0 && (
                <span className="text-muted-foreground/70">
                  {" "}({num.format(rev.rebook_orders)} rebooks)
                </span>
              )}
            </>
          }
          tooltip="Count of unique order_ids from Sale records, excluding voided orders and rebook originals replaced in the same month. Rebook replacements are counted (they represent the standing booking). Source: BigQuery tds_sales.sales_orders."
          yoyChange={yoy?.order_change_percent}
          goodDirection="up"
        />
        <MetricCell
          label="New Customers"
          value={num.format(cust.new_customers)}
          secondary={`${pct(cust.new_customers / (cust.new_customers + cust.returning_customers) * 100)} of total`}
          tooltip="Customers whose first-ever purchase falls within this month. Source: BigQuery customer_first_order table."
          yoyChange={yoy?.new_customers_change_percent}
          goodDirection="up"
        />
        <MetricCell
          label="Marketing Spend"
          value={usd.format(mkt.ad_spend)}
          tooltip="Total spend across QuickBooks advertising accounts (65010-65017). Includes platform ads, agencies, SEO, email marketing, and tools. Source: QuickBooks GL via BigQuery."
          yoyChange={yoy?.ad_spend_change_percent}
          goodDirection="neutral"
        />
      </div>
      {/* Row 3: Efficiency */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCell
          label="CAC"
          value={usd2.format(mkt.cac)}
          secondary={`${usd.format(mkt.ad_spend)} / ${num.format(cust.new_customers)}`}
          tooltip="Customer Acquisition Cost. Marketing Spend divided by New Customers. Blended across all marketing channels."
          yoyChange={yoy?.cac_change_percent}
          goodDirection="down"
        />
        <div className="rounded-md bg-muted/30 px-4 py-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="inline-flex items-center gap-1 text-[11px] text-muted-foreground cursor-help">
                Avg Customer Value
                <Info className="h-3 w-3 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p>Total real revenue (CardPointe CC net + cash + other from TDS) divided by unique active customers that month. Confirmed: total_sale always equals SUM(payment_amount_1..4) on Sale records. Source: {mkt.avg_customer_value_source === "cardpointe" ? "CardPointe settlements" : "TDS sales_orders"}.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-lg font-heading font-semibold tabular-nums">
              {usd2.format(mkt.avg_customer_gross_profit)}
            </p>
            {yoy?.avg_customer_gross_profit_change_percent != null && yoy.avg_customer_gross_profit_change_percent !== 0 && (
              <span className={`text-[11px] font-medium tabular-nums shrink-0 ${yoyColor(yoy.avg_customer_gross_profit_change_percent, "up")}`}>
                {yoy.avg_customer_gross_profit_change_percent > 0 ? "▲" : "▼"} {Math.abs(yoy.avg_customer_gross_profit_change_percent).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {usd2.format(mkt.avg_customer_value)} rev × 43% margin
          </p>
        </div>
        <MetricCell
          label="CAC : Gross Profit"
          value={`$${(mkt.cac_to_value_ratio ?? 0).toFixed(1)} : $1`}
          secondary={`${usd2.format(mkt.avg_customer_gross_profit ?? 0)} GP per ${usd2.format(mkt.cac)} CAC`}
          tooltip="For every $1 spent acquiring a customer, how much gross profit do they generate? Uses 43% margin on regular routes ($27.10/pax × 1.3 pax/order = $35.23 GP on ~$82 order). Excludes grant-funded routes which skew the blended margin higher. Above $3 = healthy unit economics."
          yoyChange={yoy?.cac_to_value_ratio_change_percent}
          goodDirection="up"
        />
      </div>
    </div>
  );
}

// ─── RevenueBreakdown ────────────────────────────────────────────────────────

function RevenueBreakdown({ data }: { data: MasterMetrics }) {
  const { revenue: rev } = data.current_month;
  const cats = rev.by_category;

  // Separate cash-generating categories from account credits
  const cashCats = cats.filter((c) => c.name !== "Account Credits");
  const accountCredits = cats.find((c) => c.name === "Account Credits");
  const newCashNet = rev.new_cash;

  const hasVarianceWarning =
    rev.cardpointe_variance !== undefined &&
    Math.abs(rev.cardpointe_variance) > 1000;

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th className="text-left font-medium pb-1.5">Category</th>
            <th className="text-right font-medium pb-1.5">Gross</th>
            <th className="text-right font-medium pb-1.5">Cancels</th>
            <th className="text-right font-medium pb-1.5">Net</th>
            <th className="text-right font-medium pb-1.5">% of Net</th>
          </tr>
        </thead>
        <tbody>
          {cashCats.map((r) => (
            <tr key={r.name} className="border-b border-border/50">
              <td className="py-1.5 text-foreground/90">
                {r.name === "Credit Cards" && rev.cardpointe_variance !== undefined ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1 cursor-help">
                        {r.name}
                        {hasVarianceWarning ? (
                          <AlertTriangle className="h-3 w-3 text-amber-400" />
                        ) : (
                          <Info className="h-3 w-3 text-muted-foreground/50" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        CC net verified against CardPointe settlement. Variance: {usd2.format(rev.cardpointe_variance ?? 0)}.
                        {hasVarianceWarning && " Variance exceeds $1,000 threshold."}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : r.name === "Other" ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1 cursor-help">
                        {r.name}
                        <Info className="h-3 w-3 text-muted-foreground/50" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Includes checks, wire transfers, and other non-standard payment methods
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  r.name
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {usd.format(r.gross)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-xs text-muted-foreground">
                -{usd.format(r.cancels)}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {usd.format(r.net)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                {newCashNet > 0 ? pct((r.net / newCashNet) * 100) : "0%"}
              </td>
            </tr>
          ))}
          {/* New Cash subtotal */}
          <tr className="border-b-2 border-border font-semibold">
            <td className="py-2">New Cash</td>
            <td className="py-2 text-right tabular-nums">
              {usd.format(cashCats.reduce((s, c) => s + c.gross, 0))}
            </td>
            <td className="py-2 text-right tabular-nums text-xs text-muted-foreground">
              -{usd.format(cashCats.reduce((s, c) => s + c.cancels, 0))}
            </td>
            <td className="py-2 text-right tabular-nums">
              {usd.format(newCashNet)}
            </td>
            <td className="py-2 text-right" />
          </tr>
          {/* Account Credits */}
          {accountCredits && (
            <tr className="border-b border-border/50">
              <td className="py-1.5 text-foreground/90">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="inline-flex items-center gap-1 cursor-help">
                      Account Credits
                      <Info className="h-3 w-3 text-muted-foreground/50" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Recirculated balances from prior cancellations or corporate accounts. Not new money entering the business.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {usd.format(accountCredits.gross)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-xs text-muted-foreground">
                -{usd.format(accountCredits.cancels)}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {usd.format(accountCredits.net)}
              </td>
              <td className="py-1.5 text-right" />
            </tr>
          )}
          {/* Gross Bookings total */}
          <tr className="font-semibold">
            <td className="pt-2">Gross Bookings</td>
            <td className="pt-2 text-right tabular-nums">
              {usd.format(rev.gross_bookings)}
            </td>
            <td className="pt-2 text-right tabular-nums text-xs text-muted-foreground">
              -{usd.format(rev.total_cancels)}
            </td>
            <td className="pt-2 text-right tabular-nums">
              {usd.format(rev.net_bookings)}
            </td>
            <td className="pt-2 text-right" />
          </tr>
        </tbody>
      </table>
      <div className="flex gap-6 text-xs text-muted-foreground">
        <span>
          Revenue/customer:{" "}
          <span className="text-foreground tabular-nums">
            {usd2.format(rev.revenue_per_customer)}
          </span>
        </span>
        <span>
          Orders/customer:{" "}
          <span className="text-foreground tabular-nums">
            {rev.orders_per_customer.toFixed(2)}
          </span>
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        Rebook orders (where previous_order is set) are excluded from Gross Bookings and order count to avoid double-counting reschedule demand. This catches ~45% of reschedules. Remaining cancellations still depress Net Booking Rate.
      </p>
    </div>
  );
}


// ─── CustomerConcentration ──────────────────────────────────────────────────

function CustomerConcentration({ data }: { data: MasterMetrics }) {
  const { top_customers: top } = data.current_month;
  const tiers = [
    { label: "Top 1%", ...top.top_1_percent },
    { label: "Top 10%", ...top.top_10_percent },
    { label: "Top 200", ...top.top_200_customers },
  ];

  return (
    <div className="space-y-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th className="text-left font-medium pb-1">Tier</th>
            <th className="text-right font-medium pb-1">Customers</th>
            <th className="text-right font-medium pb-1">Rev Share</th>
            <th className="text-right font-medium pb-1">Avg Spend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {tiers.map((t) => (
            <tr key={t.label}>
              <td className="py-1.5 text-foreground/90">{t.label}</td>
              <td className="py-1.5 text-right tabular-nums">
                {num.format(t.customer_count)}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {pct(t.revenue_share)}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {usd2.format(t.avg_spend)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── MarketingEfficiency ─────────────────────────────────────────────────────

function MarketingEfficiency({ data }: { data: MasterMetrics }) {
  const mkt = data.current_month.marketing;
  const adSpendMissing = mkt.ad_spend === 0 && mkt.transaction_count === 0;

  if (adSpendMissing) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Ad Spend Data Unavailable
          </div>
          <p className="text-xs text-amber-300/80">
            Marketing efficiency metrics require ad spend data from the Adv Detail Google Sheet. No data was found for this period.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="inline-flex items-center gap-1 text-[11px] text-muted-foreground cursor-help">
                  Avg New Customer Value
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  New Customer Revenue / New Customers.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-sm font-semibold tabular-nums">{usd2.format(mkt.avg_customer_value)}</p>
          </div>
        </div>
      </div>
    );
  }

  const categories = Object.entries(mkt.ad_spend_categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-4">
      <HorizontalBarChart data={categories} height={150} labelWidth={75} marginLeft={80} />
      <p className="text-[11px] text-muted-foreground">
        {num.format(mkt.transaction_count)} GL transactions from QuickBooks advertising accounts (65010-65017).
      </p>
    </div>
  );
}


// ─── TopCustomersTable ───────────────────────────────────────────────────────

function TopCustomersTable({
  customers,
}: {
  customers: MasterMetricsTopCustomer[];
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[11px] text-muted-foreground">
          <th className="text-left font-medium pb-1 w-6">#</th>
          <th className="text-left font-medium pb-1">Name</th>
          <th className="text-right font-medium pb-1">Revenue</th>
          <th className="text-right font-medium pb-1">Orders</th>
          <th className="text-left font-medium pb-1 pl-3">Top Route</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {customers.map((c) => (
          <tr key={c.rank}>
            <td className="py-1.5 text-muted-foreground">{c.rank}</td>
            <td className="py-1.5">
              <span className="text-foreground/90">{c.customer_name}</span>
              <br />
              <span className="text-[10px] text-muted-foreground">{c.email}</span>
            </td>
            <td className="py-1.5 text-right tabular-nums">
              {usd.format(c.revenue)}
            </td>
            <td className="py-1.5 text-right tabular-nums">
              {num.format(c.orders)}
            </td>
            <td className="py-1.5 pl-3 text-muted-foreground">
              {c.top_route ? (
                <>
                  <span className="text-foreground/80">
                    {c.top_route.origin} → {c.top_route.destination}
                  </span>
                  <span className="text-[10px] ml-1">({c.top_route.count})</span>
                </>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── DataQuality ─────────────────────────────────────────────────────────────

function DataQuality({ data }: { data: MasterMetrics }) {
  const dq = data.data_quality;
  const zeroEmails = dq.top_zero_revenue_emails ?? [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          {dq.validation_passed ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className="text-muted-foreground">Validation</span>
          <span>{dq.validation_passed ? "Passed" : "Failed"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Null emails:</span>
          <span>{num.format(dq.null_emails)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Zero-revenue orders:</span>
          <span>{num.format(dq.zero_revenue_orders)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="inline-flex items-center gap-1 text-muted-foreground cursor-help">
                Revenue variance:
                <Info className="h-3 w-3 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                Difference between sum of individual payment amounts and total_sale field. A large number means payment records don&apos;t match sale totals.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span>{usd.format(dq.revenue_variance)}</span>
        </div>
      </div>
      {zeroEmails.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
            Top zero-revenue emails
          </p>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border/50">
              {zeroEmails.map((e) => (
                <tr key={e.email}>
                  <td className="py-1 font-mono text-[11px] text-foreground/80">
                    {e.email}
                  </td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">
                    {num.format(e.count)} orders
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function FetchStepSummary({ data }: { data: unknown }) {
  if (isPromoCodeMetrics(data)) return <PromoCodeFetchSummary data={data} />;
  if (isMetaAdsMetrics(data)) return <MetaAdsFetchSummary data={data} />;
  if (isSeoRankingMetrics(data)) return <SeoRankingFetchSummary data={data} />;
  if (!isMasterMetrics(data)) return null;

  const { metadata, data_quality } = data;
  const loaded = new Set(metadata.loaded_sources ?? []);
  const missing = new Set(metadata.missing_sources ?? []);
  const allSources = [...loaded, ...missing];
  const sourceDetails = metadata.source_details as Record<string, SourceDetail> | undefined;

  const periodLabel = `${data.period.month} ${data.period.year}`;
  const dateRange = `${data.period.date_range.start} – ${data.period.date_range.end}`;

  return (
    <div className="space-y-5">
      {/* Tier 1: Period Header + Data Sources */}
      <div className="space-y-2">
        <div>
          <p className="text-sm font-heading font-semibold">{periodLabel}</p>
          <p className="text-[11px] text-muted-foreground">{dateRange}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {allSources.map((src) => {
            const detail = sourceDetails?.[src];
            const displayName = detail?.displayName ?? src;
            const status = detail?.status ?? (loaded.has(src) ? "ok" : "error");
            const message = detail?.message;

            const badgeClass =
              status === "ok"
                ? "bg-emerald-500/10 text-emerald-400 text-[11px]"
                : status === "warning"
                  ? "bg-amber-500/10 text-amber-400 text-[11px]"
                  : "bg-red-500/10 text-red-400 text-[11px]";
            const icon = status === "ok" ? "✓" : status === "warning" ? "⚠" : "✗";

            if (message) {
              return (
                <TooltipProvider key={src}>
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      <Badge variant="secondary" className={badgeClass}>
                        {icon} {displayName}
                        <Info className="ml-1 h-3 w-3 inline" />
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {message}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return (
              <Badge key={src} variant="secondary" className={badgeClass}>
                {icon} {displayName}
              </Badge>
            );
          })}
        </div>
        {data_quality && !data_quality.validation_passed && (
          <p className="text-xs text-amber-400">
            Data validation did not pass
          </p>
        )}
      </div>

      {/* Tier 2: Headline Metrics */}
      <HeadlineMetrics data={data} />

      {/* FIXME: Revenue Breakdown hidden until after TDS call to confirm
         category logic (CC vs cash vs account credit split). May not need
         this section at all — the headline cards tell the story. */}

      {/* Tier 5: Customer Concentration + Top Customers */}
      <CollapsibleSection title="Customer Concentration">
        <CustomerConcentration data={data} />
        <div className="mt-4">
          <TopCustomersTable
            customers={data.current_month.top_customers.top_10_list}
          />
        </div>
      </CollapsibleSection>

      {/* Promotions section removed — moving to standalone Promo Code Analysis workflow */}

      {/* Data Quality */}
      {data_quality && (
        <CollapsibleSection title="Data Quality">
          <DataQuality data={data} />
        </CollapsibleSection>
      )}
    </div>
  );
}
