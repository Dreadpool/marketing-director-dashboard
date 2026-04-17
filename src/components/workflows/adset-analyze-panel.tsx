"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Area,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type {
  MetaAdsAdSetRow,
  MetaAdsCampaignRow,
  MetaAdsAdRow,
  AdSetDailyTrendResponse,
} from "@/lib/schemas/sources/meta-ads-metrics";
import {
  diagnoseAdSet,
  type DiagnosticScenario,
} from "@/lib/workflows/classifiers/meta-ads-diagnostic";
import { cpaColor } from "@/lib/utils/meta-ads-formatting";
import { median } from "@/lib/utils/stats";

// ─── Chart colors (oklch to match dashboard theme) ─────────────────────────

const GOLD = "oklch(0.78 0.12 85)";
const RED = "oklch(0.65 0.2 25)";
const GREEN = "oklch(0.65 0.15 160)";
const MUTED = "oklch(0.35 0 0)";
const GRID = "oklch(0.22 0 0)";

// ─── Weekly aggregation ─────────────────────────────────────────────────────

type WeeklyPoint = {
  week: string;
  ctr: number;
  cpa: number;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
};

function aggregateWeekly(dailyAds: AdSetDailyTrendResponse["ads"]): WeeklyPoint[] {
  const dayMap = new Map<string, { spend: number; impressions: number; clicks: number; purchases: number }>();

  for (const ad of dailyAds) {
    for (const d of ad.daily) {
      const existing = dayMap.get(d.date) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0 };
      existing.spend += d.spend;
      existing.impressions += d.impressions;
      existing.clicks += d.clicks;
      existing.purchases += d.purchases;
      dayMap.set(d.date, existing);
    }
  }

  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  const weeks: WeeklyPoint[] = [];
  let bucket: typeof days = [];

  for (const day of days) {
    bucket.push(day);
    if (bucket.length === 7) {
      flushBucket(bucket, weeks);
      bucket = [];
    }
  }
  if (bucket.length > 0) flushBucket(bucket, weeks);

  return weeks;
}

function flushBucket(
  bucket: [string, { spend: number; impressions: number; clicks: number; purchases: number }][],
  weeks: WeeklyPoint[],
) {
  const totals = bucket.reduce(
    (acc, [, d]) => ({
      spend: acc.spend + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      purchases: acc.purchases + d.purchases,
    }),
    { spend: 0, impressions: 0, clicks: 0, purchases: 0 },
  );

  const date = new Date(bucket[0][0]);
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  weeks.push({
    week: label,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    cpa: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
    spend: totals.spend,
    impressions: totals.impressions,
    clicks: totals.clicks,
    purchases: totals.purchases,
  });
}

// ─── Diagnostic card definitions ────────────────────────────────────────────

const DIAGNOSTIC_CARDS: {
  scenario: DiagnosticScenario;
  signal: string;
  problem: string;
  actionHint: string;
}[] = [
  {
    scenario: "audience_or_creative",
    signal: "Low CTR + Low Frequency",
    problem: "Audience or creative mismatch. They see it and ignore it.",
    actionHint: "Compare creative across ad sets to isolate the variable.",
  },
  {
    scenario: "exhaustion",
    signal: "Low CTR + High Frequency",
    problem: "Audience exhaustion. They\u2019ve seen it too many times.",
    actionHint: "Refresh creative or expand the audience.",
  },
  {
    scenario: "post_click",
    signal: "Good CTR + Low Conversions",
    problem: "Post-click problem. The ad works but the landing page doesn\u2019t.",
    actionHint: "Check landing page. The creative isn\u2019t the issue.",
  },
  {
    scenario: "auction_competition",
    signal: "Rising CPA + Stable Metrics",
    problem: "Auction competition. Someone else is bidding on this audience.",
    actionHint: "Ride it out or find a less competitive audience.",
  },
];

// ─── Formatters ─────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pctFmt = (v: number) => `${(v * 100).toFixed(2)}%`;

// ─── Sparkline SVG ──────────────────────────────────────────────────────────

function Sparkline({ points, color, fillColor }: { points: number[]; color: string; fillColor: string }) {
  if (points.length < 2) return null;

  const width = 280;
  const height = 36;
  const padding = 2;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => ({
    x: padding + (i / (points.length - 1)) * (width - padding * 2),
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
  }));

  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPath = `M${coords[0].x},${coords[0].y} ${coords.map((c) => `L${c.x},${c.y}`).join(" ")} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[36px]" preserveAspectRatio="none">
      <path d={areaPath} fill={fillColor} />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2" fill={color} />
    </svg>
  );
}

// ─── Ad row computation ────────────────────────────────────────────────────

type AdRowData = {
  ad_id: string;
  ad_name: string;
  spend: number;
  purchases: number;
  ctr: number;
  cpa: number;
  dailyCtrs: number[];
  image_url: string | null;
};

function computeAdRows(
  trendAds: AdSetDailyTrendResponse["ads"],
  ads: MetaAdsAdRow[] | undefined,
): AdRowData[] {
  return trendAds
    .map((adTrend) => {
      const totalSpend = adTrend.daily.reduce((s, d) => s + d.spend, 0);
      const totalImpressions = adTrend.daily.reduce((s, d) => s + d.impressions, 0);
      const totalClicks = adTrend.daily.reduce((s, d) => s + d.clicks, 0);
      const totalPurchases = adTrend.daily.reduce((s, d) => s + d.purchases, 0);
      const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
      const cpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
      const dailyCtrs = adTrend.daily.map((d) =>
        d.impressions > 0 ? d.clicks / d.impressions : 0,
      );
      const adMatch = ads?.find((a) => a.ad_id === adTrend.ad_id);
      return {
        ad_id: adTrend.ad_id,
        ad_name: adTrend.ad_name,
        spend: totalSpend,
        purchases: totalPurchases,
        ctr,
        cpa,
        dailyCtrs,
        image_url: adMatch?.image_url ?? adMatch?.thumbnail_url ?? null,
      };
    })
    .sort((a, b) => b.ctr - a.ctr);
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface AdSetAnalyzePanelProps {
  adSet: MetaAdsAdSetRow;
  trendData: AdSetDailyTrendResponse;
  campaignAdSets: MetaAdsAdSetRow[];
  campaign: MetaAdsCampaignRow;
  ads?: MetaAdsAdRow[];
  onCollapse: () => void;
}

export function AdSetAnalyzePanel({
  adSet,
  trendData,
  campaignAdSets,
  campaign,
  ads,
  onCollapse,
}: AdSetAnalyzePanelProps) {
  const weeklyData = aggregateWeekly(trendData.ads);
  const diagnosis = diagnoseAdSet(adSet, campaignAdSets, {
    campaignCpaPct: campaign.mom?.cpa_pct,
  });

  const medianCtr = diagnosis.context.medianCtr;
  const medianCpa = median(
    campaignAdSets.filter((a) => a.purchases > 0).map((a) => a.cpa)
  );

  const peerBars = [...campaignAdSets]
    .filter((a) => a.impressions > 0)
    .map((a) => ({
      adset_id: a.adset_id,
      name: a.adset_name,
      ctr: a.clicks / a.impressions,
      isCurrent: a.adset_id === adSet.adset_id,
    }))
    .sort((a, b) => b.ctr - a.ctr);

  const maxPeerCtr = peerBars.length > 0 ? peerBars[0].ctr : 0;

  const allDates = trendData.ads.flatMap((a) => a.daily.map((d) => d.date));
  const uniqueDates = new Set(allDates);
  const daysRunning = uniqueDates.size;

  const totalCampaignSpend = campaignAdSets.reduce((s, a) => s + a.spend, 0);
  const spendPct = totalCampaignSpend > 0 ? Math.round((adSet.spend / totalCampaignSpend) * 100) : 0;

  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="mx-4 mb-2 rounded-lg border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-border/50">
            <div className="max-w-[600px]">
              <h3 className="font-heading text-sm font-semibold text-foreground">
                {adSet.adset_name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {diagnosis.diagnosis}
              </p>
            </div>
            <div className="flex gap-5 shrink-0 ml-6">
              {[
                { value: adSet.frequency.toFixed(1), label: "Frequency", warn: adSet.frequency >= 3.5 },
                { value: `${daysRunning}d`, label: "Running", warn: false },
                { value: usd.format(adSet.spend), label: "Spend", warn: false },
                { value: `${spendPct}%`, label: "of Campaign", warn: false },
              ].map((pill) => (
                <div key={pill.label} className="text-center">
                  <div className={`font-mono text-sm font-medium ${pill.warn ? "text-amber-400" : "text-foreground"}`}>
                    {pill.value}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mt-0.5">
                    {pill.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 divide-x divide-border/50">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  CTR Over Time
                </span>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 rounded bg-gold" /> This ad set
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 rounded border-t border-dashed border-muted-foreground/40" /> Campaign median
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={42} />
                  <RechartsTooltip
                    formatter={(v) => [`${(Number(v) * 100).toFixed(2)}%`, "CTR"]}
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "#71717a" }}
                  />
                  <ReferenceLine y={medianCtr} stroke={MUTED} strokeDasharray="6 4" strokeWidth={1.5} />
                  <defs>
                    <linearGradient id="ctrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GOLD} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={GOLD} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="ctr" fill="url(#ctrFill)" stroke="none" />
                  <Line type="monotone" dataKey="ctr" stroke={GOLD} strokeWidth={2} dot={{ r: 3, fill: GOLD }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  CPA Over Time
                </span>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 rounded bg-red-500" /> This ad set
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 rounded border-t border-dashed border-muted-foreground/40" /> Campaign median
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => `$${v.toFixed(0)}`} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={36} />
                  <RechartsTooltip
                    formatter={(v) => [`$${Number(v).toFixed(2)}`, "CPA"]}
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "#71717a" }}
                  />
                  <ReferenceLine y={medianCpa} stroke={MUTED} strokeDasharray="6 4" strokeWidth={1.5} />
                  <ReferenceLine y={9} stroke={GREEN} strokeDasharray="3 6" strokeWidth={0.8} label={{ value: "$9 target", position: "right", fill: GREEN, fontSize: 9, opacity: 0.5 }} />
                  <defs>
                    <linearGradient id="cpaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={RED} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={RED} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="cpa" fill="url(#cpaFill)" stroke="none" />
                  <Line type="monotone" dataKey="cpa" stroke={RED} strokeWidth={2} dot={{ r: 3, fill: RED }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Peer Comparison */}
          <div className="px-5 py-4 border-t border-border/50">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-3">
              CTR — Campaign Peers
            </div>
            <div className="space-y-1.5">
              {peerBars.map((peer) => (
                <div key={peer.adset_id} className="flex items-center gap-3">
                  <div
                    className={`w-40 text-xs truncate shrink-0 ${peer.isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}
                    title={peer.name}
                  >
                    {peer.name}
                    {peer.isCurrent && <span className="ml-1 text-muted-foreground/50">&#x25C0;</span>}
                  </div>
                  <div className="flex-1 h-[18px] bg-muted/20 rounded-sm relative overflow-hidden">
                    <div
                      className={`h-full rounded-sm ${peer.isCurrent ? "bg-amber-500/25" : "bg-emerald-500/20"}`}
                      style={{ width: `${maxPeerCtr > 0 ? (peer.ctr / maxPeerCtr) * 100 : 0}%` }}
                    />
                    {peer === peerBars[0] && medianCtr > 0 && maxPeerCtr > 0 && (
                      <div
                        className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-muted-foreground/40 rounded"
                        style={{ left: `${(medianCtr / maxPeerCtr) * 100}%` }}
                      >
                        <span className="absolute -top-3.5 -translate-x-1/2 text-[9px] text-muted-foreground/40 whitespace-nowrap">
                          median
                        </span>
                      </div>
                    )}
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] ${peer.isCurrent ? "text-amber-400" : "text-muted-foreground/60"}`}>
                      {pctFmt(peer.ctr)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic Framework */}
          <div className="px-5 py-4 border-t border-border/50">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-3">
              What&apos;s the problem?
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DIAGNOSTIC_CARDS.map((card) => {
                const isActive = card.scenario === diagnosis.scenario;
                return (
                  <div
                    key={card.scenario}
                    className={`rounded-md border p-3 transition-opacity ${
                      isActive
                        ? "border-gold/25 bg-gold/[0.06] opacity-100"
                        : "border-border/30 bg-background opacity-40"
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-1 ${isActive ? "text-gold" : "text-foreground"}`}>
                      {card.signal}
                      {isActive && <span className="ml-1.5 text-gold/60">&#10003;</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mb-1">{card.problem}</div>
                    <div className="text-[11px] font-medium text-gold/80">{card.actionHint}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ads in this set */}
          {trendData.ads.length > 0 && (
            <div className="px-5 py-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                  Ads in this set
                </span>
                <span className="text-[10px] text-muted-foreground/30">
                  Ranked by CTR. Sparklines show daily CTR over the period.
                </span>
              </div>
              <div className="space-y-0">
                {(() => {
                  const adRows = computeAdRows(trendData.ads, ads);
                  const showTags = adRows.length >= 3;

                  return adRows.map((ad, idx) => {
                    const isBest = idx === 0;
                    const isWorst = showTags && idx === adRows.length - 1;

                    const sparkColor = isBest ? GREEN : isWorst ? "oklch(0.65 0.2 25 / 0.6)" : MUTED;
                    const sparkFill = isBest ? "oklch(0.65 0.15 160 / 0.08)" : isWorst ? "oklch(0.65 0.2 25 / 0.05)" : "oklch(0.35 0 0 / 0.05)";

                    return (
                      <div
                        key={ad.ad_id}
                        className={`grid items-center gap-3 py-2.5 px-3 rounded-md transition-colors hover:bg-muted/10 ${
                          isBest ? "bg-emerald-500/[0.03] border-l-2 border-l-emerald-500/40 pl-2.5" :
                          isWorst ? "bg-red-500/[0.02]" : ""
                        }`}
                        style={{ gridTemplateColumns: "40px 1fr 240px 70px 70px" }}
                      >
                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded bg-muted/20 border border-border/30 overflow-hidden flex items-center justify-center">
                          {ad.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-muted-foreground/30">IMG</span>
                          )}
                        </div>

                        {/* Name + meta */}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate" title={ad.ad_name}>
                            {ad.ad_name}
                          </div>
                          <div className="flex gap-2 text-[10px] text-muted-foreground/50 mt-0.5">
                            <span>{usd.format(ad.spend)} spend</span>
                            <span>{ad.purchases} purchases</span>
                            {isBest && <span className="text-emerald-400 font-medium">Best in set</span>}
                            {isWorst && <span className="text-red-400/70 font-medium">Lowest CTR</span>}
                          </div>
                        </div>

                        {/* Sparkline */}
                        <div className="relative">
                          <Sparkline points={ad.dailyCtrs} color={sparkColor} fillColor={sparkFill} />
                        </div>

                        {/* CTR */}
                        <div className="text-right">
                          <div className={`font-mono text-[11px] ${isBest ? "text-emerald-400" : isWorst ? "text-red-400" : "text-muted-foreground"}`}>
                            {pctFmt(ad.ctr)}
                          </div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/30 mt-0.5">CTR</div>
                        </div>

                        {/* CPA */}
                        <div className="text-right">
                          <div className={`font-mono text-[11px] ${
                            ad.purchases === 0 ? "text-muted-foreground/30" : cpaColor(ad.cpa)
                          }`}>
                            {ad.purchases > 0 ? `$${ad.cpa.toFixed(2)}` : "\u2014"}
                          </div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/30 mt-0.5">CPA</div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-background">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center text-sm">
                &#8635;
              </div>
              <div>
                <div className="text-xs font-medium text-foreground">
                  {DIAGNOSTIC_CARDS.find((c) => c.scenario === diagnosis.scenario)?.actionHint}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 max-w-xl">
                  {diagnosis.action}
                </div>
              </div>
            </div>
            <button
              onClick={onCollapse}
              className="text-[11px] text-muted-foreground/50 border border-border/50 rounded px-3 py-1 hover:border-muted-foreground/30 hover:text-muted-foreground transition-colors"
            >
              Collapse
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
