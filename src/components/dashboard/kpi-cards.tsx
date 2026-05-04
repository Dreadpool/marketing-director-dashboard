"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ReportSummary } from "@/lib/types/mmc-report";
import { formatCount, formatCurrencyCompact, formatPct } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  delta: { delta_pct: number; delta_abs: number; prior: number } | null;
  priorLabel: string;
  isCurrency?: boolean;
}

function KpiCard({ label, value, delta, priorLabel, isCurrency = true }: KpiCardProps) {
  const finiteDelta =
    delta && Number.isFinite(delta.delta_pct) && Number.isFinite(delta.delta_abs) ? delta : null;
  const isUp = finiteDelta && finiteDelta.delta_pct > 0;
  const isDown = finiteDelta && finiteDelta.delta_pct < 0;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className="text-3xl font-bold font-mono text-foreground">{value}</div>
        {finiteDelta ? (
          <>
            <div
              className={`text-base font-semibold font-mono mt-1 ${
                isUp ? "text-growth" : isDown ? "text-decline" : "text-muted-foreground"
              }`}
            >
              {isUp ? "▲" : isDown ? "▼" : "—"}{" "}
              {isCurrency
                ? formatCurrencyCompact(finiteDelta.delta_abs, { signed: true })
                : formatCount(finiteDelta.delta_abs, { signed: true })}{" "}
              ({formatPct(finiteDelta.delta_pct, { signed: true })})
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
        value={formatCurrencyCompact(summary.total_revenue)}
        delta={yoy.total_revenue}
        priorLabel={yoy.total_revenue ? `vs ${formatCurrencyCompact(yoy.total_revenue.prior)}` : ""}
      />
      <KpiCard
        label="SLE Revenue"
        value={formatCurrencyCompact(summary.sle_revenue)}
        delta={yoy.sle_revenue}
        priorLabel={yoy.sle_revenue ? `vs ${formatCurrencyCompact(yoy.sle_revenue.prior)}` : ""}
      />
      <KpiCard
        label="Interline Revenue"
        value={formatCurrencyCompact(summary.interline_revenue)}
        delta={yoy.interline_revenue}
        priorLabel={yoy.interline_revenue ? `vs ${formatCurrencyCompact(yoy.interline_revenue.prior)}` : ""}
      />
      <KpiCard
        label="Total Passengers"
        value={formatCount(summary.total_passengers)}
        delta={yoy.total_passengers}
        priorLabel={yoy.total_passengers ? `vs ${formatCount(yoy.total_passengers.prior)}` : ""}
        isCurrency={false}
      />
    </div>
  );
}
