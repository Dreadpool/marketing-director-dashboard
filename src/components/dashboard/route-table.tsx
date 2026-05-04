"use client";

import React, { useState } from "react";
import type { RouteWithYoy, YoySummary } from "@/lib/types/mmc-report";
import {
  formatAvgTicket,
  formatCount,
  formatCurrencyCompact,
  formatCurrencyFull,
  formatPct,
} from "@/lib/format";

function fmtDelta(
  d: { delta_abs: number; delta_pct: number } | null,
  isCurrency: boolean = true,
): {
  text: string;
  className: string;
} {
  if (!d || !Number.isFinite(d.delta_abs) || !Number.isFinite(d.delta_pct)) {
    return { text: "N/A", className: "text-muted-foreground" };
  }
  const abs = isCurrency
    ? formatCurrencyCompact(d.delta_abs, { signed: true })
    : formatCount(d.delta_abs, { signed: true });
  const pct = formatPct(d.delta_pct, { signed: true });
  return {
    text: `${abs} ${pct}`,
    className: d.delta_abs >= 0 ? "text-growth" : "text-decline",
  };
}

type SortKey = "name" | "revenue" | "yoy_revenue" | "passengers" | "yoy_passengers";

interface ChannelRow {
  label: string;
  color: string;
  revenue: number;
  passengers: number;
}

function ExpandedDetail({ route }: { route: RouteWithYoy }) {
  const channels: ChannelRow[] = [
    { label: "SLE", color: "#4a8cff", revenue: route.sle_revenue, passengers: route.sle_passengers },
    { label: "FLIX", color: "#f59e0b", revenue: route.flix_revenue, passengers: route.flix_passengers },
    { label: "Other", color: "#888888", revenue: route.other_revenue, passengers: route.other_passengers },
  ];

  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div className="border-l-2 border-border ml-2 bg-background/50">
          <div className="grid grid-cols-[70px_1fr_1fr_1fr] gap-x-3 gap-y-1 px-4 py-3 text-[11px]">
            <div className="text-muted-foreground text-[9px] uppercase tracking-wider" />
            <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Revenue</div>
            <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Passengers</div>
            <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Avg Ticket</div>

            {channels.map((ch) => (
              <React.Fragment key={ch.label}>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ backgroundColor: ch.color }}
                  />
                  {ch.label}
                </div>
                <div className="font-mono text-foreground">{formatCurrencyFull(ch.revenue)}</div>
                <div className="font-mono text-foreground">{formatCount(ch.passengers)}</div>
                <div className="font-mono text-foreground">
                  {ch.passengers > 0 ? formatAvgTicket(ch.revenue / ch.passengers) : "—"}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function RouteTable({ routes, yoy }: { routes: RouteWithYoy[]; yoy?: YoySummary }) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const sorted = [...routes].sort((a, b) => {
    if (sortKey === "name") {
      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    let av: number | null, bv: number | null;
    switch (sortKey) {
      case "revenue": av = a.revenue; bv = b.revenue; break;
      case "yoy_revenue": av = a.yoy_revenue?.delta_pct ?? null; bv = b.yoy_revenue?.delta_pct ?? null; break;
      case "passengers": av = a.passengers; bv = b.passengers; break;
      case "yoy_passengers": av = a.yoy_passengers?.delta_pct ?? null; bv = b.yoy_passengers?.delta_pct ?? null; break;
      default: av = 0; bv = 0;
    }
    // Always sort nulls to the end, regardless of direction.
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return sortAsc ? av - bv : bv - av;
  });

  const totals = routes.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      passengers: acc.passengers + r.passengers,
      sle_revenue: acc.sle_revenue + r.sle_revenue,
      interline_revenue: acc.interline_revenue + r.flix_revenue + r.other_revenue,
    }),
    { revenue: 0, passengers: 0, sle_revenue: 0, interline_revenue: 0 },
  );

  const thClass = "text-left px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground select-none";

  return (
    <div className="overflow-hidden">
      <table className="w-full text-base">
        <thead>
          <tr className="border-b border-border">
            <th className={thClass} onClick={() => handleSort("name")}>Route</th>
            <th className={thClass} onClick={() => handleSort("revenue")}>Revenue</th>
            <th className={`${thClass} w-32`}>SLE / Interline</th>
            <th className={thClass} onClick={() => handleSort("yoy_revenue")}>YoY Rev</th>
            <th className={thClass} onClick={() => handleSort("passengers")}>Passengers</th>
            <th className={thClass} onClick={() => handleSort("yoy_passengers")}>YoY Pax</th>
            <th className={thClass}>Avg Ticket</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const interlineRevenue = r.flix_revenue + r.other_revenue;
            const total = r.sle_revenue + interlineRevenue;
            const slePct = total > 0 ? (r.sle_revenue / total) * 100 : 100;
            const revDelta = fmtDelta(r.yoy_revenue);
            const paxDelta = fmtDelta(r.yoy_passengers, false);
            const avgTicket = r.passengers > 0 ? r.revenue / r.passengers : 0;
            const isExpanded = expanded.has(r.name);

            return (
              <React.Fragment key={r.name}>
                <tr
                  className="border-b border-border/50 hover:bg-background/50 cursor-pointer"
                  onClick={() => toggleExpand(r.name)}
                >
                  <td className="px-2 py-2 font-medium text-foreground">
                    <span className="text-muted-foreground text-[10px] mr-1.5 inline-block w-3">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    {r.name}
                  </td>
                  <td className="px-2 py-2 font-mono text-foreground">{formatCurrencyFull(r.revenue)}</td>
                  <td className="px-2 py-2">
                    <div className="h-[7px] rounded-full bg-border overflow-hidden flex">
                      <div className="bg-sle-blue" style={{ width: `${slePct}%` }} />
                      <div className="bg-interline-amber" style={{ width: `${100 - slePct}%` }} />
                    </div>
                  </td>
                  <td className={`px-2 py-2 font-mono font-semibold ${revDelta.className}`}>
                    {revDelta.text}
                  </td>
                  <td className="px-2 py-2 font-mono text-foreground">
                    {formatCount(r.passengers)}
                  </td>
                  <td className={`px-2 py-2 font-mono font-semibold ${paxDelta.className}`}>
                    {paxDelta.text}
                  </td>
                  <td className="px-2 py-2 font-mono text-foreground">
                    {formatAvgTicket(avgTicket)}
                  </td>
                </tr>
                {isExpanded && <ExpandedDetail route={r} />}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-bold">
            <td className="px-2 py-2 text-foreground">Totals</td>
            <td className="px-2 py-2 font-mono text-foreground">{formatCurrencyFull(totals.revenue)}</td>
            <td className="px-2 py-2">
              <div className="h-[7px] rounded-full bg-border overflow-hidden flex">
                <div className="bg-sle-blue" style={{ width: `${totals.revenue > 0 ? (totals.sle_revenue / totals.revenue) * 100 : 100}%` }} />
                <div className="bg-interline-amber" style={{ width: `${totals.revenue > 0 ? (totals.interline_revenue / totals.revenue) * 100 : 0}%` }} />
              </div>
            </td>
            {(() => {
              const totalRevDelta = fmtDelta(yoy?.total_revenue ?? null);
              return (
                <td className={`px-2 py-2 font-mono font-semibold ${totalRevDelta.className}`}>
                  {totalRevDelta.text}
                </td>
              );
            })()}
            <td className="px-2 py-2 font-mono text-foreground">{formatCount(totals.passengers)}</td>
            {(() => {
              const totalPaxDelta = fmtDelta(yoy?.total_passengers ?? null, false);
              return (
                <td className={`px-2 py-2 font-mono font-semibold ${totalPaxDelta.className}`}>
                  {totalPaxDelta.text}
                </td>
              );
            })()}
            <td className="px-2 py-2 font-mono text-foreground">
              {totals.passengers > 0 ? formatAvgTicket(totals.revenue / totals.passengers) : "—"}
            </td>
          </tr>
        </tfoot>
      </table>
      <div className="flex gap-4 justify-end px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-sle-blue mr-1 align-middle" />SLE</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-interline-amber mr-1 align-middle" />Interline</span>
      </div>
    </div>
  );
}
