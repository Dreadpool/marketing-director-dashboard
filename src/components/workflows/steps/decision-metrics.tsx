// src/components/workflows/steps/decision-metrics.tsx

"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cpaColor, roasColor } from "@/lib/utils/meta-ads-formatting";

// ─── Formatters ─────────────────────────────────────────────────────────────

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

function cpaStatusBadge(status: string) {
  const colors: Record<string, string> = {
    "on-target": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    elevated: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    high: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const labels: Record<string, string> = {
    "on-target": "On Target",
    elevated: "Elevated",
    high: "High",
  };
  return (
    <Badge variant="outline" className={`text-xs ${colors[status] ?? ""}`}>
      {labels[status] ?? status}
    </Badge>
  );
}

// ─── Metric Card ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  secondary,
  tooltip,
  statusColor,
}: {
  label: string;
  value: string;
  secondary?: string;
  tooltip?: string;
  statusColor?: string;
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
      <p
        className={`text-lg font-heading font-semibold tabular-nums ${statusColor ?? ""}`}
      >
        {value}
      </p>
      {secondary && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {secondary}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface DecisionMetricsData {
  account_health: {
    total_spend: number;
    total_purchases: number;
    total_attributed_revenue: number;
    cpa: number;
    roas: number;
    cpm: number;
    ctr: number;
    total_impressions: number;
    total_clicks: number;
    total_reach: number;
    avg_frequency: number;
    cpa_status: string;
    roas_status: string;
  };
  prospecting: {
    spend: number;
    purchases: number;
    cpa: number;
    campaign_count: number;
  };
  retargeting: {
    spend: number;
    purchases: number;
    cpa: number;
    campaign_count: number;
  };
  thresholds: {
    cpa_on_target: number;
    cpa_elevated: number;
    roas_floor: number;
  };
}

export function DecisionMetricsViz({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const d = data as unknown as DecisionMetricsData;
  const { account_health: h, prospecting: p, retargeting: r } = d;

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <p className="text-[11px] text-muted-foreground/60">
        We make $35 profit per booking. Meta over-reports conversions by ~30%.
        To maintain a 3:1 return, keep CPA under $9 as reported by Meta.
      </p>

      {/* CPA Status */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">CPA Status:</span>
        {cpaStatusBadge(h.cpa_status)}
      </div>

      {/* Account Health KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Account CPA"
          value={usd2.format(h.cpa)}
          secondary={
            h.cpa_status === "on-target"
              ? `On target (<$${d.thresholds.cpa_on_target})`
              : h.cpa_status === "elevated"
                ? `Elevated ($${d.thresholds.cpa_on_target}-$${d.thresholds.cpa_elevated})`
                : `High (>$${d.thresholds.cpa_elevated})`
          }
          tooltip="Meta-reported CPA. True CPA is ~1.3x higher due to over-attribution."
          statusColor={cpaColor(h.cpa)}
        />
        <MetricCard
          label="ROAS"
          value={`${h.roas.toFixed(2)}x`}
          secondary={
            h.roas_status === "above-target"
              ? `Above ${d.thresholds.roas_floor}x floor`
              : `Below ${d.thresholds.roas_floor}x floor`
          }
          tooltip="Return on Ad Spend. Below 3.0x = losing money after COGS."
          statusColor={roasColor(h.roas)}
        />
        <MetricCard
          label="Purchases"
          value={num.format(h.total_purchases)}
          secondary={`${usd.format(h.total_attributed_revenue)} revenue`}
          tooltip="Meta-attributed purchases (28d click window)"
        />
        <MetricCard
          label="Total Spend"
          value={usd.format(h.total_spend)}
          secondary={`${num.format(h.total_impressions)} impressions`}
        />
      </div>

      {/* Prospecting vs Retargeting */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Funnel Stage Breakdown
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-4 py-3">
            <p className="text-[11px] text-blue-400/80 mb-1">
              Prospecting (TOF) — {p.campaign_count} campaign{p.campaign_count !== 1 ? "s" : ""}
            </p>
            <p className={`text-lg font-heading font-semibold tabular-nums ${cpaColor(p.cpa)}`}>
              {p.purchases > 0 ? usd2.format(p.cpa) : "No purchases"}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {usd.format(p.spend)} spend · {num.format(p.purchases)} purchases
            </p>
          </div>
          <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-4 py-3">
            <p className="text-[11px] text-purple-400/80 mb-1">
              Retargeting — {r.campaign_count} campaign{r.campaign_count !== 1 ? "s" : ""}
            </p>
            <p className={`text-lg font-heading font-semibold tabular-nums ${cpaColor(r.cpa)}`}>
              {r.purchases > 0 ? usd2.format(r.cpa) : "No purchases"}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {usd.format(r.spend)} spend · {num.format(r.purchases)} purchases
            </p>
          </div>
        </div>
        {p.purchases > 0 && r.purchases > 0 && r.cpa > p.cpa && (
          <p className="mt-2 text-xs text-amber-400">
            Warning: Retargeting CPA ({usd2.format(r.cpa)}) is higher than prospecting CPA ({usd2.format(p.cpa)}). Retargeting should be cheaper since it targets warm audiences.
          </p>
        )}
      </div>
    </div>
  );
}
