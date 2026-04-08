"use client";

import type { YoySummary } from "@/lib/types/mmc-report";

function formatDelta(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  const abs = Math.abs(n);
  if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface BarProps {
  label: string;
  delta_abs: number;
  delta_pct: number;
  maxAbs: number;
  color: "growth" | "decline" | "sle-blue";
}

function Bar({ label, delta_abs, delta_pct, maxAbs, color }: BarProps) {
  const isPositive = delta_abs >= 0;
  const widthPct = maxAbs > 0 ? (Math.abs(delta_abs) / maxAbs) * 45 : 0;

  return (
    <div className="flex items-center mb-2.5">
      <div className="w-24 text-xs text-muted-foreground text-right pr-3 shrink-0">
        {label}
      </div>
      <div className="flex-1 relative h-7">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
        <div
          className={`absolute h-5 top-1 rounded-sm flex items-center ${
            isPositive ? "left-1/2" : "right-1/2"
          }`}
          style={{
            width: `${widthPct}%`,
            backgroundColor: isPositive
              ? (color === "sle-blue" ? "#4a8cff" : "#22c55e")
              : "#ef4444",
          }}
        >
          <span className="text-[11px] font-semibold font-mono text-white px-2 whitespace-nowrap">
            {formatDelta(delta_abs)} ({delta_pct > 0 ? "+" : ""}{delta_pct.toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DecompositionBars({ yoy }: { yoy: YoySummary }) {
  if (!yoy.sle_revenue || !yoy.interline_revenue || !yoy.total_revenue) {
    return (
      <div className="py-2">
        <p className="text-muted-foreground text-sm">No prior year data for comparison</p>
      </div>
    );
  }

  const sleAbs = yoy.sle_revenue.delta_abs;
  const intAbs = yoy.interline_revenue.delta_abs;
  const netAbs = yoy.total_revenue.delta_abs;
  const maxAbs = Math.max(Math.abs(sleAbs), Math.abs(intAbs), Math.abs(netAbs), 1);

  const sleUp = sleAbs >= 0;
  const intDown = intAbs < 0;
  let caption = "";
  if (sleUp && intDown) caption = "SLE growth offset interline decline";
  else if (sleUp && !intDown) caption = "Both SLE and interline grew";
  else if (!sleUp && intDown) caption = "Both SLE and interline declined";
  else caption = "Interline growth offset SLE decline";

  return (
    <div className="py-2 px-4">
      <Bar label="SLE" delta_abs={sleAbs} delta_pct={yoy.sle_revenue.delta_pct} maxAbs={maxAbs} color="growth" />
      <Bar label="Interline" delta_abs={intAbs} delta_pct={yoy.interline_revenue.delta_pct} maxAbs={maxAbs} color="decline" />
      <Bar label="Net Change" delta_abs={netAbs} delta_pct={yoy.total_revenue.delta_pct} maxAbs={maxAbs} color="sle-blue" />
      <p className="text-[11px] text-muted-foreground text-center mt-1">{caption}</p>
    </div>
  );
}
