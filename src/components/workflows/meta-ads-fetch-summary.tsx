"use client";

import { Fragment, useState } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  Minus,
  ImageOff,
  ExternalLink,
} from "lucide-react";
import { AdSetAnalyzePanel } from "@/components/workflows/adset-analyze-panel";
import type {
  MetaAdsMetrics,
  MetaAdsPeriod,
  MetaAdsCampaignRow,
  MetaAdsAdSetRow,
  MetaAdsAdRow,
  MetaAdsBreakdownRow,
  MetaAdsSourceDetail,
  AdHealthStatus,
  AdSetHealthStatus,
  AdHealthClassification,
  AdSetHealthClassification,
  AdSetDailyTrendResponse,
  TrendDirection,
  AdSetFlag,
  AdSetFlagType,
} from "@/lib/schemas/sources/meta-ads-metrics";

// ─── Type guard ──────────────────────────────────────────────────────────────

export function isMetaAdsMetrics(data: unknown): data is MetaAdsMetrics {
  return (
    typeof data === "object" &&
    data !== null &&
    "account_health" in data &&
    "campaigns" in data &&
    "metadata" in data &&
    "signals" in data &&
    "audience" in data
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
const pct = (n: number) => `${n.toFixed(1)}%`;

// ─── Shared sub-components ───────────────────────────────────────────────────

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

// ─── CPA color helper ────────────────────────────────────────────────────────

// CPA thresholds: $35.23 GP/order, 43% margin, 1.3x over-attribution
function cpaColor(cpa: number): string {
  if (cpa <= 0) return "";
  if (cpa < 9) return "text-emerald-400";
  if (cpa < 14) return "text-amber-400";
  return "text-red-400";
}

// ROAS: 3.0x = GP breakeven. No green state — CPA is the decision metric.
function roasColor(roas: number): string {
  return roas >= 3.0 ? "text-muted-foreground" : "text-red-400";
}

function efficiencyColor(index: number): string {
  if (index < 0.8) return "text-emerald-400";
  if (index <= 1.2) return "text-muted-foreground";
  return "text-red-400";
}

// ─── Source badges ────────────────────────────────────────────────────────────

function SourceBadges({
  sourceDetails,
}: {
  sourceDetails: Record<string, MetaAdsSourceDetail>;
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

// ─── Headline KPIs ───────────────────────────────────────────────────────────

function HeadlineKPIs({ health }: { health: MetaAdsMetrics["account_health"] }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        We make $35 profit per booking after operating costs. Meta takes ~30% too much credit for conversions, so a reported $9 CPA is really ~$12. To stay profitable (3:1 return), keep CPA under $9 as reported by Meta.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Total Spend"
        value={usd.format(health.total_spend)}
        secondary={`${num.format(health.total_impressions)} impressions`}
      />
      <MetricCard
        label="CPA"
        value={usd2.format(health.cpa)}
        secondary={health.cpa_status === "on-target" ? "On target (<$9)" : health.cpa_status === "elevated" ? "Elevated ($9-14)" : "High (>$14)"}
        tooltip="Meta-reported CPA. Thresholds account for 1.3x over-attribution and 43% gross margin on regular routes ($35.23 GP/order). True CPA ≈ Meta CPA × 1.3."
        statusColor={cpaColor(health.cpa)}
      />
      <MetricCard
        label="ROAS"
        value={`${health.roas.toFixed(2)}x`}
        secondary={health.roas_status === "above-target" ? "Above breakeven (>3.0x)" : "Below breakeven (<3.0x)"}
        tooltip="Return on Ad Spend (revenue, not profit). Below 3.0x = losing money after COGS and over-attribution. CPA is the primary decision metric, not ROAS."
        statusColor={roasColor(health.roas)}
      />
      <MetricCard
        label="Purchases"
        value={num.format(health.total_purchases)}
        secondary={`${usd.format(health.total_attributed_revenue)} revenue`}
        tooltip="Meta-attributed purchases (28d click window)"
      />
      </div>
    </div>
  );
}

// ─── Health Badge ────────────────────────────────────────────────────────────

const HEALTH_STYLES: Record<
  AdHealthStatus | AdSetHealthStatus,
  { bg: string; label: string }
> = {
  healthy: {
    bg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    label: "Healthy",
  },
  learning: {
    bg: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    label: "Learning",
  },
  watch: {
    bg: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    label: "Watch",
  },
  underperforming: {
    bg: "bg-red-500/10 text-red-400 border border-red-500/20",
    label: "Underperforming",
  },
  kill: {
    bg: "bg-red-700 text-white",
    label: "Kill",
  },
};

function HealthBadge({
  health,
}: {
  health: AdHealthClassification | AdSetHealthClassification | undefined;
}) {
  if (!health) return null;

  const style = HEALTH_STYLES[health.status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="cursor-help">
          <span
            className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${style.bg}`}
          >
            {style.label}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs whitespace-normal"
        >
          <div className="space-y-2 py-1">
            <div className="text-sm font-semibold">{style.label}</div>
            <p className="text-muted-foreground">{health.reason}</p>
            <p className="font-semibold text-gold">{health.action}</p>
            {health.signals.length > 0 && (
              <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                {health.signals.map((signal, i) => (
                  <li key={i}>{signal}</li>
                ))}
              </ul>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Ad Set Flag Badge ──────────────────────────────────────────────────────

const FLAG_STYLES: Record<AdSetFlagType, { label: string; className: string }> =
  {
    ctr_below_peers: {
      label: "Low CTR",
      className: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    },
    cpa_increasing: {
      label: "CPA ↑",
      className: "bg-red-500/10 text-red-400 border border-red-500/20",
    },
  };

function AdSetFlagBadge({ flags }: { flags?: AdSetFlag[] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {flags.map((flag) => {
        const style = FLAG_STYLES[flag.type];
        return (
          <TooltipProvider key={flag.type}>
            <Tooltip>
              <TooltipTrigger className="cursor-help">
                <span
                  className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${style.className}`}
                >
                  {style.label}
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-xs text-xs whitespace-normal"
              >
                {flag.detail}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// ─── Trend Arrow ─────────────────────────────────────────────────────────────

function TrendArrow({
  direction,
  inverse = false,
}: {
  direction: TrendDirection;
  inverse?: boolean;
}) {
  if (direction === "flat") {
    return <Minus className="inline h-3 w-3 text-muted-foreground" />;
  }
  const good = inverse ? direction === "declining" : direction === "rising";
  const Icon = direction === "rising" ? TrendingUp : TrendingDown;
  return (
    <Icon
      className={`inline h-3 w-3 ${good ? "text-growth" : "text-decline"}`}
    />
  );
}

// ─── MoM Delta Label ────────────────────────────────────────────────────────

function MomDeltaLabel({
  pct,
  inverse = false,
  neutral = false,
}: {
  pct: number | null | undefined;
  inverse?: boolean;
  neutral?: boolean;
}) {
  if (pct === null || pct === undefined) return null;
  const flat = Math.abs(pct) < 5;
  const isPositive = pct > 0;
  const arrow = flat ? "→" : isPositive ? "↑" : "↓";

  let colorClass = "text-muted-foreground/60";
  if (!flat && !neutral) {
    const isGood = inverse ? !isPositive : isPositive;
    colorClass = isGood ? "text-growth" : "text-decline";
  }

  return (
    <div className={`text-[10px] leading-tight ${colorClass}`}>
      {arrow} {isPositive ? "+" : ""}{pct.toFixed(0)}%
    </div>
  );
}

// ─── Ad Thumbnail ───────────────────────────────────────────────────────────

function AdThumbnail({
  ad,
  onClick,
}: {
  ad: {
    ad_id: string;
    ad_name: string;
    image_url?: string | null;
    thumbnail_url?: string | null;
  };
  onClick: (ad: {
    ad_name: string;
    ad_id: string;
    image_url: string;
  }) => void;
}) {
  const src = ad.image_url || ad.thumbnail_url;

  if (!src) {
    return (
      <div className="w-10 h-10 rounded bg-muted/30 flex items-center justify-center shrink-0">
        <ImageOff className="h-4 w-4 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick({
          ad_name: ad.ad_name,
          ad_id: ad.ad_id,
          image_url: ad.image_url || ad.thumbnail_url || "",
        });
      }}
      className="w-10 h-10 rounded overflow-hidden shrink-0 hover:ring-2 hover:ring-gold/50 transition-shadow"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external Meta CDN URL */}
      <img
        src={src}
        alt={ad.ad_name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </button>
  );
}

// ─── Campaign Table ──────────────────────────────────────────────────────────

function CampaignTable({
  campaigns,
  adsets,
  ads,
  period,
}: {
  campaigns: MetaAdsCampaignRow[];
  adsets: MetaAdsAdSetRow[];
  ads: MetaAdsAdRow[];
  period: MetaAdsPeriod;
}) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const [trendData, setTrendData] = useState<
    Map<string, AdSetDailyTrendResponse>
  >(new Map());
  const [loadingAdSets, setLoadingAdSets] = useState<Set<string>>(new Set());
  const [errorAdSets, setErrorAdSets] = useState<Map<string, string>>(new Map());
  const [lightboxAd, setLightboxAd] = useState<{
    ad_name: string;
    ad_id: string;
    image_url: string;
  } | null>(null);

  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No campaign data available.</p>
    );
  }

  function toggleCampaign(id: string) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAdSet(id: string) {
    setExpandedAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function adSetsFor(campaignId: string) {
    return adsets.filter((as) => as.campaign_id === campaignId);
  }

  function adsFor(adsetId: string) {
    return ads.filter((ad) => ad.adset_id === adsetId);
  }

  async function handleAnalyze(adsetId: string) {
    setLoadingAdSets((prev) => {
      const next = new Set(prev);
      next.add(adsetId);
      return next;
    });
    setErrorAdSets((prev) => {
      const next = new Map(prev);
      next.delete(adsetId);
      return next;
    });

    try {
      const res = await fetch("/api/workflows/meta-ads-analysis/adset-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adsetId,
          period: { year: period.year, month: period.month_num },
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Failed to analyze");
      }

      const data = (await res.json()) as AdSetDailyTrendResponse;
      setTrendData((prev) => {
        const next = new Map(prev);
        next.set(adsetId, data);
        return next;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to analyze";
      setErrorAdSets((prev) => {
        const next = new Map(prev);
        next.set(adsetId, message);
        return next;
      });
    } finally {
      setLoadingAdSets((prev) => {
        const next = new Set(prev);
        next.delete(adsetId);
        return next;
      });
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 pr-4">Campaign</th>
            <th className="pb-2 pr-3 text-right">Spend</th>
            <th className="pb-2 pr-3 text-right">CPA</th>
            <th className="pb-2 pr-3 text-right">ROAS</th>
            <th className="pb-2 pr-3 text-right">Purchases</th>
            <th className="pb-2 text-right">Freq</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const childAdSets = adSetsFor(c.campaign_id);
            const hasChildren = childAdSets.length > 0;
            const isCampaignExpanded = expandedCampaigns.has(c.campaign_id);

            return (
              <Fragment key={c.campaign_id}>
                {/* Campaign row */}
                <tr
                  className={`border-b border-border/50 last:border-0 ${hasChildren ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
                  onClick={hasChildren ? () => toggleCampaign(c.campaign_id) : undefined}
                >
                  <td className="py-2 pr-4 max-w-[200px]" title={c.campaign_name}>
                    <span className="flex items-center gap-1.5 truncate">
                      {hasChildren ? (
                        isCampaignExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      {c.campaign_name}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {usd.format(c.spend)}
                    <MomDeltaLabel pct={c.mom?.spend_pct} neutral />
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${cpaColor(c.cpa)}`}
                  >
                    {c.purchases > 0 ? usd2.format(c.cpa) : "—"}
                    <MomDeltaLabel pct={c.mom?.cpa_pct} inverse />
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${c.roas > 0 ? roasColor(c.roas) : ""}`}
                  >
                    {c.purchases > 0 ? `${c.roas.toFixed(2)}x` : "—"}
                    <MomDeltaLabel pct={c.mom?.roas_pct} />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {num.format(c.purchases)}
                    <MomDeltaLabel pct={c.mom?.purchases_pct} />
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${c.frequency > 3 ? "text-red-400" : ""}`}
                  >
                    {c.frequency.toFixed(1)}
                  </td>
                </tr>

                {/* Ad set rows */}
                {isCampaignExpanded &&
                  childAdSets.map((as) => {
                    const childAds = adsFor(as.adset_id);
                    const hasAds = childAds.length > 0;
                    const isAdSetExpanded = expandedAdSets.has(as.adset_id);

                    return (
                      <Fragment key={as.adset_id}>
                        <tr
                          className={`border-b border-border/30 bg-muted/20 ${hasAds ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
                          onClick={hasAds ? (e) => { e.stopPropagation(); toggleAdSet(as.adset_id); } : undefined}
                        >
                          <td className="py-1.5 pr-4 max-w-[200px]" title={as.adset_name}>
                            <div className="flex items-center gap-1.5 pl-8">
                              {hasAds ? (
                                isAdSetExpanded ? (
                                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                                )
                              ) : (
                                <span className="w-3 shrink-0" />
                              )}
                              <span className="truncate text-muted-foreground">{as.adset_name}</span>
                            </div>
                            <div className="flex items-center gap-2 pl-8 mt-0.5">
                              <AdSetFlagBadge flags={as.flags} />
                              {hasAds && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAnalyze(as.adset_id);
                                  }}
                                  disabled={loadingAdSets.has(as.adset_id)}
                                  className="text-[10px] text-gold hover:text-gold/80 disabled:opacity-50"
                                >
                                  {loadingAdSets.has(as.adset_id)
                                    ? "Analyzing..."
                                    : trendData.has(as.adset_id)
                                      ? "Refresh"
                                      : "Analyze"}
                                </button>
                              )}
                              {errorAdSets.get(as.adset_id) && (
                                <span className="text-[10px] text-red-400">{errorAdSets.get(as.adset_id)}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                            {usd.format(as.spend)}
                            <MomDeltaLabel pct={as.mom?.spend_pct} neutral />
                          </td>
                          <td
                            className={`py-1.5 pr-3 text-right tabular-nums ${cpaColor(as.cpa)}`}
                          >
                            {as.purchases > 0 ? usd2.format(as.cpa) : "—"}
                            <MomDeltaLabel pct={as.mom?.cpa_pct} inverse />
                          </td>
                          <td
                            className={`py-1.5 pr-3 text-right tabular-nums ${as.purchases > 0 ? roasColor(as.roas) : ""}`}
                          >
                            {as.purchases > 0 ? `${as.roas.toFixed(2)}x` : "—"}
                            <MomDeltaLabel pct={as.mom?.roas_pct} />
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                            {num.format(as.purchases)}
                            <MomDeltaLabel pct={as.mom?.purchases_pct} />
                          </td>
                          <td
                            className={`py-1.5 text-right tabular-nums ${as.frequency > 3 ? "text-red-400" : ""}`}
                          >
                            {as.frequency.toFixed(1)}
                          </td>
                        </tr>

                        {/* Analyze Panel (shows when trend data loaded) */}
                        {trendData.has(as.adset_id) && (
                          <AdSetAnalyzePanel
                            adSet={as}
                            trendData={trendData.get(as.adset_id)!}
                            campaignAdSets={childAdSets}
                            campaign={c}
                            ads={ads.filter((a) => a.adset_id === as.adset_id)}
                            onCollapse={() => {
                              setTrendData((prev) => {
                                const next = new Map(prev);
                                next.delete(as.adset_id);
                                return next;
                              });
                            }}
                          />
                        )}

                        {/* Ad rows (below the analyze panel) */}
                        {isAdSetExpanded &&
                          childAds.map((ad) => {
                            const adTrend = trendData
                              .get(as.adset_id)
                              ?.ads.find((t) => t.ad_id === ad.ad_id);
                            return (
                              <tr
                                key={ad.ad_id}
                                className="border-b border-border/20 border-l-2 border-l-border/40 bg-muted/5 text-xs"
                              >
                                <td
                                  className="py-1.5 pr-4 pl-14 max-w-[200px] text-muted-foreground/80"
                                  title={ad.ad_name}
                                >
                                  <div className="flex items-center gap-2">
                                    <AdThumbnail
                                      ad={ad}
                                      onClick={setLightboxAd}
                                    />
                                    <div className="min-w-0">
                                      <span className="truncate block text-xs">
                                        {ad.ad_name}
                                      </span>
                                      <HealthBadge
                                        health={
                                          adTrend?.revised_health ?? ad.health
                                        }
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground/60">
                                  {usd.format(ad.spend)}
                                </td>
                                <td className={`py-1.5 pr-3 text-right tabular-nums ${cpaColor(ad.cpa)}`}>
                                  {ad.purchases > 0 ? (
                                    <span className="inline-flex items-center gap-1 justify-end">
                                      {adTrend && (
                                        <TrendArrow
                                          direction={adTrend.trend.cpa_direction}
                                          inverse
                                        />
                                      )}
                                      {usd2.format(ad.cpa)}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground/60">
                                  {ad.clicks > 0 ? (
                                    <span><span className="text-[10px] text-muted-foreground/40">CVR </span>{pct((ad.purchases / ad.clicks) * 100)}</span>
                                  ) : "—"}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground/60">
                                  {num.format(ad.purchases)}
                                </td>
                                <td className="py-1.5 text-right tabular-nums text-muted-foreground/60">
                                  {ad.impressions > 0 ? (
                                    <span className="inline-flex items-center gap-1 justify-end">
                                      {adTrend && (
                                        <TrendArrow
                                          direction={adTrend.trend.ctr_direction}
                                        />
                                      )}
                                      <span className="text-[10px] text-muted-foreground/40">CTR </span>
                                      {pct((ad.clicks / ad.impressions) * 100)}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <Dialog open={!!lightboxAd} onOpenChange={() => setLightboxAd(null)}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-card">
          <DialogTitle className="sr-only">
            {lightboxAd?.ad_name ?? "Ad Creative"}
          </DialogTitle>
          {lightboxAd && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- external Meta CDN URL */}
              <img
                src={lightboxAd.image_url}
                alt={lightboxAd.ad_name}
                className="w-full"
              />
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {lightboxAd.ad_name}
                </p>
                <a
                  href={`https://www.facebook.com/adsmanager/manage/ads?act=1599255740369627&selected_ad_ids=${lightboxAd.ad_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold/80"
                >
                  <ExternalLink className="h-3 w-3" />
                  View in Ads Manager
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Hiring Table ────────────────────────────────────────────────────────────

function HiringTable({ campaigns }: { campaigns: MetaAdsCampaignRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 pr-4">Campaign</th>
            <th className="pb-2 pr-3 text-right">Spend</th>
            <th className="pb-2 pr-3 text-right">Impressions</th>
            <th className="pb-2 pr-3 text-right">Clicks</th>
            <th className="pb-2 pr-3 text-right">CTR</th>
            <th className="pb-2 text-right">Freq</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr
              key={c.campaign_id}
              className="border-b border-border/50 last:border-0"
            >
              <td className="py-2 pr-4 max-w-[200px] truncate" title={c.campaign_name}>
                {c.campaign_name}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {usd.format(c.spend)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {num.format(c.impressions)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {num.format(c.clicks)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {pct(c.ctr)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {c.frequency.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Creative Performance ────────────────────────────────────────────────────

function CreativePerformance({ ads }: { ads: MetaAdsAdRow[] }) {
  if (ads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ad-level data unavailable for this period.
      </p>
    );
  }

  const adsWithPurchases = ads.filter((a) => a.purchases > 0);
  const topAds = adsWithPurchases.slice(0, 5);
  const bottomAds = adsWithPurchases.length > 5
    ? [...adsWithPurchases].sort((a, b) => b.cpa - a.cpa).slice(0, 5)
    : [];

  return (
    <div className="space-y-4">
      {topAds.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Top Spending Ads (with conversions)
          </p>
          <AdTable ads={topAds} />
        </div>
      )}
      {bottomAds.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Highest CPA Ads
          </p>
          <AdTable ads={bottomAds} />
        </div>
      )}
    </div>
  );
}

function AdTable({ ads }: { ads: MetaAdsAdRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 pr-4">Ad</th>
            <th className="pb-2 pr-3 text-right">Spend</th>
            <th className="pb-2 pr-3 text-right">CPA</th>
            <th className="pb-2 pr-3 text-right">ROAS</th>
            <th className="pb-2 pr-3 text-right">Hook</th>
            <th className="pb-2 text-right">Hold</th>
          </tr>
        </thead>
        <tbody>
          {ads.map((ad) => (
            <tr
              key={ad.ad_id}
              className="border-b border-border/50 last:border-0"
            >
              <td className="py-2 pr-4 max-w-[200px] truncate" title={ad.ad_name}>
                {ad.ad_name}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {usd.format(ad.spend)}
              </td>
              <td className={`py-2 pr-3 text-right tabular-nums ${cpaColor(ad.cpa)}`}>
                {ad.purchases > 0 ? usd2.format(ad.cpa) : "—"}
              </td>
              <td className={`py-2 pr-3 text-right tabular-nums ${ad.roas > 0 ? roasColor(ad.roas) : ""}`}>
                {ad.purchases > 0 ? `${ad.roas.toFixed(2)}x` : "—"}
              </td>
              <td className={`py-2 pr-3 text-right tabular-nums ${ad.hook_rate != null && ad.hook_rate < 0.25 ? "text-red-400" : ""}`}>
                {ad.hook_rate != null ? pct(ad.hook_rate * 100) : "—"}
              </td>
              <td className={`py-2 text-right tabular-nums ${ad.hold_rate != null && ad.hold_rate < 0.30 ? "text-red-400" : ""}`}>
                {ad.hold_rate != null ? pct(ad.hold_rate * 100) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Audience Breakdowns ─────────────────────────────────────────────────────

function AudienceSection({
  audience,
  hasMissing,
}: {
  audience: MetaAdsMetrics["audience"];
  hasMissing: boolean;
}) {
  if (hasMissing) {
    return (
      <p className="text-sm text-muted-foreground">
        Audience breakdown data unavailable for this period.
      </p>
    );
  }

  const sections: { title: string; rows: MetaAdsBreakdownRow[] }[] = [
    { title: "Age / Gender", rows: audience.age_gender },
    { title: "Geography", rows: audience.geo },
    { title: "Device", rows: audience.device },
    { title: "Platform", rows: audience.platform },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) =>
        section.rows.length > 0 ? (
          <div key={section.title}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              {section.title}
            </p>
            <BreakdownTable rows={section.rows} />
          </div>
        ) : null,
      )}
    </div>
  );
}

function BreakdownTable({ rows }: { rows: MetaAdsBreakdownRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 pr-4">Segment</th>
            <th className="pb-2 pr-3 text-right">Spend</th>
            <th className="pb-2 pr-3 text-right">Purchases</th>
            <th className="pb-2 pr-3 text-right">CPA</th>
            <th className="pb-2 text-right">Efficiency</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.value}-${i}`}
              className="border-b border-border/50 last:border-0"
            >
              <td className="py-1.5 pr-4">{row.value}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {usd.format(row.spend)}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">
                {num.format(row.purchases)}
              </td>
              <td className={`py-1.5 pr-3 text-right tabular-nums ${cpaColor(row.cpa)}`}>
                {row.purchases > 0 ? usd2.format(row.cpa) : "—"}
              </td>
              <td className={`py-1.5 text-right tabular-nums ${efficiencyColor(row.efficiency_index)}`}>
                {row.purchases > 0 ? `${row.efficiency_index.toFixed(2)}x` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function MetaAdsFetchSummary({ data }: { data: MetaAdsMetrics }) {
  const { metadata } = data;
  const periodLabel = `${data.period.month} ${data.period.year}`;
  const dateRange = `${data.period.date_range.start} – ${data.period.date_range.end}`;
  const audienceMissing = metadata.missing_sources.includes("audience");

  return (
    <div className="space-y-5">
      {/* Period Header + Sources */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-heading text-sm font-semibold">{periodLabel}</h3>
          <span className="text-[11px] text-muted-foreground">{dateRange}</span>
        </div>
        <SourceBadges sourceDetails={metadata.source_details} />
      </div>

      {/* Headline KPIs */}
      <HeadlineKPIs health={data.account_health} />

      {/* Funnel stage summary */}
      {data.signals.tof_campaigns.length > 0 ||
      data.signals.retargeting_campaigns.length > 0 ? (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            TOF campaigns: {data.signals.tof_campaigns.length} |{" "}
            Retargeting: {data.signals.retargeting_campaigns.length}
          </span>
          <span>
            Top campaign: {pct(data.signals.top_campaigns_spend_pct * 100)} of spend
          </span>
        </div>
      ) : null}

      {/* Acquisition Campaign Table */}
      <CollapsibleSection title="Acquisition Campaigns" defaultOpen>
        <CampaignTable
          campaigns={data.campaigns}
          adsets={data.adsets ?? []}
          ads={data.ads}
          period={data.period}
        />
      </CollapsibleSection>

      {/* Hiring Campaigns (separate from CAC) */}
      {data.hiring_campaigns && data.hiring_campaigns.length > 0 && (
        <CollapsibleSection title="Hiring / Recruitment Campaigns">
          <p className="text-xs text-muted-foreground mb-3">
            Not included in CPA, ROAS, or purchase metrics above.
          </p>
          <HiringTable campaigns={data.hiring_campaigns} />
        </CollapsibleSection>
      )}

      {/* Creative Performance */}
      <CollapsibleSection title="Creative Performance">
        <CreativePerformance ads={data.ads} />
      </CollapsibleSection>

      {/* Audience Breakdowns */}
      <CollapsibleSection title="Audience Breakdowns">
        <AudienceSection audience={data.audience} hasMissing={audienceMissing} />
      </CollapsibleSection>
    </div>
  );
}
