"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ReportSummary } from "@/lib/types/mmc-report";

function formatCurrency(n: number): string {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDeltaAbs(n: number, isCurrency: boolean): string {
  const sign = n >= 0 ? "+" : "-";
  const abs = Math.abs(n);
  if (isCurrency) {
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

interface KpiCardProps {
  label: string;
  value: string;
  delta: { delta_pct: number; delta_abs: number; prior: number } | null;
  priorLabel: string;
  isCurrency?: boolean;
}

function KpiCard({ label, value, delta, priorLabel, isCurrency = true }: KpiCardProps) {
  const isUp = delta && delta.delta_pct > 0;
  const isDown = delta && delta.delta_pct < 0;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className="text-3xl font-bold font-mono text-foreground">{value}</div>
        {delta ? (
          <>
            <div
              className={`text-base font-semibold font-mono mt-1 ${
                isUp ? "text-growth" : isDown ? "text-decline" : "text-muted-foreground"
              }`}
            >
              {isUp ? "▲" : isDown ? "▼" : "—"}{" "}
              {formatDeltaAbs(delta.delta_abs, isCurrency)}{" "}
              ({delta.delta_pct > 0 ? "+" : ""}{delta.delta_pct.toFixed(1)}%)
            </div>
            <div className="text-xs text-muted-foreground mt-1">{priorLabel}</div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground mt-1">N/A</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function KpiCards({ summary }: { summary: ReportSummary }) {
  const yoy = summary.yoy;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Total Revenue"
        value={formatCurrency(summary.total_revenue)}
        delta={yoy.total_revenue}
        priorLabel={yoy.total_revenue ? `vs ${formatCurrency(yoy.total_revenue.prior)}` : ""}
      />
      <KpiCard
        label="SLE Revenue"
        value={formatCurrency(summary.sle_revenue)}
        delta={yoy.sle_revenue}
        priorLabel={yoy.sle_revenue ? `vs ${formatCurrency(yoy.sle_revenue.prior)}` : ""}
      />
      <KpiCard
        label="Interline Revenue"
        value={formatCurrency(summary.interline_revenue)}
        delta={yoy.interline_revenue}
        priorLabel={yoy.interline_revenue ? `vs ${formatCurrency(yoy.interline_revenue.prior)}` : ""}
      />
      <KpiCard
        label="Total Passengers"
        value={formatNumber(summary.total_passengers)}
        delta={yoy.total_passengers}
        priorLabel={yoy.total_passengers ? `vs ${formatNumber(yoy.total_passengers.prior)}` : ""}
        isCurrency={false}
      />
    </div>
  );
}
