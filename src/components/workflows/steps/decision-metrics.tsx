// src/components/workflows/steps/decision-metrics.tsx

"use client";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

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
        CPA, ROAS, purchases, and revenue are reported by Meta. SLE&apos;s
        profitability benchmark is pending a route-economics rerun, so these
        numbers do not receive a profit verdict.
      </p>

      {/* Account Health KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Account CPA"
          value={usd2.format(h.cpa)}
          secondary="Platform attributed"
          tooltip="Meta-reported spend divided by Meta-attributed purchases."
        />
        <MetricCard
          label="ROAS"
          value={`${h.roas.toFixed(2)}x`}
          secondary="Platform attributed"
          tooltip="Meta-attributed revenue divided by Meta spend; not profitability proof."
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
            <p className="text-lg font-heading font-semibold tabular-nums">
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
            <p className="text-lg font-heading font-semibold tabular-nums">
              {r.purchases > 0 ? usd2.format(r.cpa) : "No purchases"}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {usd.format(r.spend)} spend · {num.format(r.purchases)} purchases
            </p>
          </div>
        </div>
        {p.purchases > 0 && r.purchases > 0 && r.cpa > p.cpa && (
          <p className="mt-2 text-xs text-amber-400">
            Retargeting CPA ({usd2.format(r.cpa)}) is higher than prospecting CPA ({usd2.format(p.cpa)}). Check audience mix and conversion tracking before acting.
          </p>
        )}
      </div>
    </div>
  );
}
