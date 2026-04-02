"use client";

import { useState } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";
import type {
  SeoRankingMetrics,
  SeoSiteData,
  SeoSourceDetail,
} from "@/lib/schemas/sources/seo-ranking-metrics";

// ─── Type guard ──────────────────────────────────────────────────────────────

export function isSeoRankingMetrics(data: unknown): data is SeoRankingMetrics {
  return (
    typeof data === "object" &&
    data !== null &&
    "sites" in data &&
    "metadata" in data &&
    Array.isArray((data as SeoRankingMetrics).sites)
  );
}

// ─── Chart colors ───────────────────────────────────────────────────────────

const GOLD = "oklch(0.78 0.12 85)";
const EMERALD = "oklch(0.65 0.15 160)";
const ORANGE = "oklch(0.7 0.15 50)";
const SKY = "oklch(0.65 0.12 230)";
const MUTED = "oklch(0.4 0 0)";
const FOREGROUND = "oklch(0.95 0 0)";
const MUTED_FG = "oklch(0.65 0 0)";

const chartTooltipStyle = {
  contentStyle: {
    background: "oklch(0.18 0.004 285)",
    border: "1px solid oklch(1 0 0 / 8%)",
    borderRadius: "6px",
    fontSize: "12px",
    color: FOREGROUND,
  },
  itemStyle: { color: FOREGROUND },
  labelStyle: { color: MUTED_FG },
};

// ─── Shared sub-components ──────────────────────────────────────────────────

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

function SourceBadges({
  sourceDetails,
}: {
  sourceDetails: Record<string, SeoSourceDetail>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(sourceDetails).map(([key, detail]) => {
        const Icon =
          detail.status === "ok"
            ? CheckCircle2
            : detail.status === "warning"
              ? AlertTriangle
              : XCircle;
        const color =
          detail.status === "ok"
            ? "text-emerald-400"
            : detail.status === "warning"
              ? "text-amber-400"
              : "text-red-400";
        return (
          <TooltipProvider key={key}>
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant="outline"
                  className="gap-1 text-[10px] font-normal"
                >
                  <Icon className={`h-3 w-3 ${color}`} />
                  {detail.displayName}
                </Badge>
              </TooltipTrigger>
              {detail.message && (
                <TooltipContent className="text-xs">
                  {detail.message}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// ─── Per-site section ───────────────────────────────────────────────────────

function changeColor(n: number): string {
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "";
}

function signedNum(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function SiteSection({
  site,
  defaultOpen,
}: {
  site: SeoSiteData;
  defaultOpen: boolean;
}) {
  const latestTier = site.tiers.length > 0 ? site.tiers[site.tiers.length - 1] : null;
  const latestVisibility = site.visibility.length > 0 ? site.visibility[site.visibility.length - 1] : null;

  // Short month label: "Apr 25" — keeps year context, avoids duplicate "Apr"
  const shortMonth = (m: string) => m.replace(/\s\d{2}(\d{2})$/, " '$1");

  // Visibility chart data
  const visData = site.visibility.map((v) => ({
    month: shortMonth(v.month),
    score: v.score,
    keywords: v.keywords_tracked,
  }));

  // Tier chart data: compute non-overlapping segments for stacking
  const tierData = site.tiers.map((t) => ({
    month: shortMonth(t.month),
    "#1": t.first_place ?? 0,
    "2-3": t.top_3 - (t.first_place ?? 0),
    "4-5": t.top_5 - t.top_3,
    "6-10": t.top_10 - t.top_5,
    "Below 10": t.below_10,
  }));

  return (
    <CollapsibleSection title={site.site_name} defaultOpen={defaultOpen}>
      <div className="space-y-5">
        {/* Headline KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard
            label="Net Change"
            value={signedNum(site.net_change)}
            secondary={`across ${site.aggregate_change.length} transitions`}
            tooltip="Sum of month-over-month rank changes across all keywords. Positive means ranks improved (lower rank number = higher position)."
            statusColor={changeColor(site.net_change)}
          />
          <MetricCard
            label="Visibility Score"
            value={latestVisibility ? latestVisibility.score.toFixed(1) : "—"}
            secondary={
              site.visibility_change_pct != null
                ? `${site.visibility_change_pct > 0 ? "+" : ""}${site.visibility_change_pct.toFixed(1)}% from start`
                : undefined
            }
            tooltip="Sum of 1/rank for all tracked keywords. Rank 1 = 1.0, rank 10 = 0.1. Higher is better. Exponentially weights top positions."
            statusColor={
              site.visibility_change_pct != null
                ? changeColor(site.visibility_change_pct)
                : undefined
            }
          />
          <MetricCard
            label="Top 10 Keywords"
            value={latestTier ? `${latestTier.top_10}` : "—"}
            secondary={`of ${site.keyword_count} tracked`}
            tooltip="Keywords ranking in positions 1-10 (first page of Google) in the latest month."
          />
          <MetricCard
            label="Top 3 Keywords"
            value={latestTier ? `${latestTier.top_3}` : "—"}
            secondary={latestTier ? `${latestTier.top_5} in top 5` : undefined}
            tooltip="Keywords ranking in positions 1-3 in the latest month. These positions receive the majority of clicks."
          />
        </div>

        {/* Visibility Trend Chart */}
        {visData.length > 1 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Visibility Trend
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={visData}>
                <XAxis
                  dataKey="month"
                  tick={{ fill: MUTED_FG, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: MUTED_FG, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <RechartsTooltip
                  {...chartTooltipStyle}
                  formatter={(val) => [Number(val).toFixed(3), "Visibility"]}
                />
                <Line
                  type="linear"
                  dataKey="score"
                  stroke={EMERALD}
                  strokeWidth={2}
                  dot={{ fill: EMERALD, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tier Distribution Chart */}
        {tierData.length > 1 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Tier Distribution
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={tierData}>
                <XAxis
                  dataKey="month"
                  tick={{ fill: MUTED_FG, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: MUTED_FG, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <RechartsTooltip {...chartTooltipStyle} />
                <Bar dataKey="Below 10" stackId="tiers" fill={MUTED} radius={[0, 0, 0, 0]} />
                <Bar dataKey="6-10" stackId="tiers" fill={ORANGE} />
                <Bar dataKey="4-5" stackId="tiers" fill={SKY} />
                <Bar dataKey="2-3" stackId="tiers" fill={EMERALD} />
                <Bar dataKey="#1" stackId="tiers" fill={GOLD} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-1.5">
              {[
                { label: "#1", color: GOLD },
                { label: "2-3", color: EMERALD },
                { label: "4-5", color: SKY },
                { label: "6-10", color: ORANGE },
                { label: "Below 10", color: MUTED },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aggregate Change Table */}
        {site.aggregate_change.length > 0 && (
          <CollapsibleSection title="Aggregate Change Details" defaultOpen={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Transition</th>
                    <th className="text-right py-1.5 px-4 font-medium text-muted-foreground">Change</th>
                    <th className="text-right py-1.5 pl-4 font-medium text-muted-foreground">Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {site.aggregate_change.map((row) => (
                    <tr key={row.transition} className="border-b border-border/30">
                      <td className="py-1.5 pr-4">{row.transition}</td>
                      <td className={`text-right py-1.5 px-4 tabular-nums font-medium ${changeColor(row.change)}`}>
                        {signedNum(row.change)}
                      </td>
                      <td className="text-right py-1.5 pl-4 tabular-nums text-muted-foreground">
                        {row.keywords_measured}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}

        {/* Biggest Movers */}
        {(site.movers.improved.length > 0 || site.movers.declined.length > 0) && (
          <CollapsibleSection title="Biggest Movers" defaultOpen>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Improved */}
              {site.movers.improved.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Improved</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-1 pr-2 font-medium text-muted-foreground">Keyword</th>
                        <th className="text-right py-1 px-2 font-medium text-muted-foreground">Start</th>
                        <th className="text-right py-1 px-2 font-medium text-muted-foreground">End</th>
                        <th className="text-right py-1 pl-2 font-medium text-muted-foreground">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {site.movers.improved.map((m) => (
                        <tr key={m.keyword} className="border-b border-border/30">
                          <td className="py-1 pr-2 truncate max-w-[180px]" title={m.keyword}>{m.keyword}</td>
                          <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">{m.start_rank}</td>
                          <td className="text-right py-1 px-2 tabular-nums">{m.end_rank}</td>
                          <td className="text-right py-1 pl-2 tabular-nums font-medium text-emerald-400">+{m.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Declined */}
              {site.movers.declined.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-xs font-medium text-red-400">Declined</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-1 pr-2 font-medium text-muted-foreground">Keyword</th>
                        <th className="text-right py-1 px-2 font-medium text-muted-foreground">Start</th>
                        <th className="text-right py-1 px-2 font-medium text-muted-foreground">End</th>
                        <th className="text-right py-1 pl-2 font-medium text-muted-foreground">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {site.movers.declined.map((m) => (
                        <tr key={m.keyword} className="border-b border-border/30">
                          <td className="py-1 pr-2 truncate max-w-[180px]" title={m.keyword}>{m.keyword}</td>
                          <td className="text-right py-1 px-2 tabular-nums text-muted-foreground">{m.start_rank}</td>
                          <td className="text-right py-1 px-2 tabular-nums">{m.end_rank}</td>
                          <td className="text-right py-1 pl-2 tabular-nums font-medium text-red-400">{m.change}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </CollapsibleSection>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function SeoRankingFetchSummary({ data }: { data: SeoRankingMetrics }) {
  const { metadata } = data;
  const periodLabel = data.period.month;
  const dateRange = `${data.period.date_range.start} – ${data.period.date_range.end}`;

  return (
    <div className="space-y-5">
      {/* Period Header + Source Badges */}
      <div className="space-y-2">
        <div>
          <p className="text-sm font-heading font-semibold">{periodLabel}</p>
          <span className="text-[11px] text-muted-foreground">{dateRange}</span>
        </div>
        <SourceBadges sourceDetails={metadata.source_details} />
      </div>

      {/* Methodology */}
      <CollapsibleSection title="Methodology" defaultOpen>
        <div className="rounded-md bg-muted/30 border border-border/40 px-4 py-3 space-y-2.5 text-xs text-muted-foreground">
          <div>
            <p className="font-medium text-foreground/80 mb-0.5">Visibility Score</p>
            <p>Sum of 1/rank for all tracked keywords. A #1 ranking contributes 1.0, #10 contributes 0.1, #100 contributes 0.01. Higher is better. This exponentially weights top positions, reflecting how click-through rates concentrate at the top of search results.</p>
          </div>
          <div>
            <p className="font-medium text-foreground/80 mb-0.5">Net Change Score</p>
            <p>For each consecutive month, compares the rank of every keyword that has data in both months. A keyword moving from rank 8 to rank 3 contributes +5. Summed across all keywords and all month transitions. Positive = overall improvement.</p>
          </div>
          <div>
            <p className="font-medium text-foreground/80 mb-0.5">Tier Distribution</p>
            <p>Counts how many keywords fall into each ranking tier per month: #1, ranks 2-3, 4-5, 6-10, and below 10. Shows whether improvements are concentrated at the top or spread throughout.</p>
          </div>
          <div>
            <p className="font-medium text-foreground/80 mb-0.5">Biggest Movers</p>
            <p>Compares each keyword&apos;s first tracked rank to its most recent rank. Keywords with the largest positive change (rank number decreased) are &quot;improved&quot;; largest negative change are &quot;declined.&quot;</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Per-site sections */}
      {data.sites.map((site, idx) => (
        <SiteSection key={site.site_key} site={site} defaultOpen={idx === 0} />
      ))}

      {data.sites.length === 0 && (
        <p className="text-sm text-muted-foreground">No site data available.</p>
      )}
    </div>
  );
}
