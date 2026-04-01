"use client";

import { Fragment, useMemo, useState } from "react";
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
} from "lucide-react";
import type {
  MetaAdsMetrics,
  MetaAdsCampaignRow,
  MetaAdsAdSetRow,
  MetaAdsAdRow,
  MetaAdsBreakdownRow,
  MetaAdsFatigueSignal,
  MetaAdsSourceDetail,
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

function funnelBadge(stage: string) {
  const colors: Record<string, string> = {
    tof: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    retargeting: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    other: "bg-muted text-muted-foreground border-border",
  };
  const labels: Record<string, string> = {
    tof: "TOF",
    retargeting: "RT",
    other: "Other",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${colors[stage] ?? ""}`}>
      {labels[stage] ?? stage}
    </Badge>
  );
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

// ─── Ad Diagnostic Tags ─────────────────────────────────────────────────────

type AdDiagnostic = {
  label: string;
  color: string;
  tooltip: string;
};

function diagnoseAd({
  ad,
  campaignCpa,
  signalsByAdId,
  highFreqCampaigns,
  accountCvr,
}: {
  ad: MetaAdsAdRow;
  campaignCpa: number;
  signalsByAdId: Map<string, MetaAdsFatigueSignal[]>;
  highFreqCampaigns: Map<string, number>;
  accountCvr: number;
}): AdDiagnostic | null {
  const adSignals = signalsByAdId.get(ad.ad_id) ?? [];
  const ctrSignal = adSignals.find((s) => s.signal_type === "declining_ctr");
  const cpmSignal = adSignals.find((s) => s.signal_type === "rising_cpm");
  const campaignFreq = highFreqCampaigns.get(ad.campaign_id);
  const campaignHighFreq = campaignFreq !== undefined;

  const adCvr = ad.clicks > 0 ? ad.purchases / ad.clicks : 0;

  // Priority 1: Creative Fatigue (CTC D5 Pattern 1)
  if (ctrSignal && campaignHighFreq) {
    const ctrDrop = ctrSignal.threshold > 0
      ? Math.round((1 - ctrSignal.current_value / ctrSignal.threshold) * 100)
      : 0;
    return {
      label: "Creative Fatigue",
      color: "bg-red-500/10 text-red-400 border-red-500/20",
      tooltip: [
        "CTC Pattern: Creative Fatigue (freq↑ + CTR↓)",
        "",
        `Ad CTR: ${ctrSignal.current_value.toFixed(2)}%`,
        `Account avg: ${ctrSignal.threshold.toFixed(2)}%`,
        `Drop: ${ctrDrop}% below average`,
        `Campaign freq: ${campaignFreq!.toFixed(1)}x (threshold 3.0)`,
        "",
        "Audience has seen this ad too many times and is",
        "ignoring it. Rotate creative or expand audience.",
      ].join("\n"),
    };
  }

  // Priority 2: Low Conversion (CTC D4 — Landing Page Problem)
  if (ad.clicks >= 20 && accountCvr > 0 && adCvr < accountCvr * 0.5 && !ctrSignal) {
    const cvrDrop = Math.round((1 - adCvr / accountCvr) * 100);
    return {
      label: "Low Conversion",
      color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      tooltip: [
        "CTC Pattern: Conversion Drop (CTR ok + CVR↓)",
        "",
        `Ad CVR: ${pct(adCvr * 100)}`,
        `Account avg: ${pct(accountCvr * 100)}`,
        `Drop: ${cvrDrop}% below average`,
        "",
        "Creative is getting clicks but they're not",
        "converting. Check landing page, booking flow,",
        "or offer alignment.",
      ].join("\n"),
    };
  }

  // Priority 3: Underperforming (relative to own campaign)
  if (ad.purchases >= 5 && campaignCpa > 0 && ad.cpa > campaignCpa * 1.5) {
    const cpaPct = Math.round((ad.cpa / campaignCpa - 1) * 100);
    return {
      label: "Underperforming",
      color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      tooltip: [
        "Ad CPA is significantly above its campaign average.",
        "",
        `Ad CPA: ${usd2.format(ad.cpa)}`,
        `Campaign CPA: ${usd2.format(campaignCpa)}`,
        `Difference: ${cpaPct}% higher`,
        "",
        "This ad is dragging down campaign efficiency.",
        "Consider pausing or revising creative/targeting.",
      ].join("\n"),
    };
  }

  // Priority 4: Low Engagement (CTR below avg, but no high freq)
  if (ctrSignal && !campaignHighFreq) {
    const ctrDrop = ctrSignal.threshold > 0
      ? Math.round((1 - ctrSignal.current_value / ctrSignal.threshold) * 100)
      : 0;
    return {
      label: "Low Engagement",
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      tooltip: [
        "CTR is below account average.",
        "",
        `Ad CTR: ${ctrSignal.current_value.toFixed(2)}%`,
        `Account avg: ${ctrSignal.threshold.toFixed(2)}%`,
        `Drop: ${ctrDrop}% below average`,
        "",
        "Creative isn't resonating with this audience.",
        "Test different angles, copy, or imagery.",
      ].join("\n"),
    };
  }

  // Priority 5: Low Hook (video only)
  if (ad.hook_rate != null && ad.hook_rate < 0.25) {
    return {
      label: "Low Hook",
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      tooltip: [
        "Video hook rate below 25%.",
        "",
        `Hook rate: ${pct(ad.hook_rate * 100)}`,
        `Benchmark: 25%+`,
        "",
        "First 3 seconds aren't capturing attention.",
        "Test a stronger opening frame or visual hook.",
      ].join("\n"),
    };
  }

  // Priority 6: Low Hold (video only)
  if (ad.hold_rate != null && ad.hold_rate < 0.30) {
    return {
      label: "Low Hold",
      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      tooltip: [
        "Video hold rate below 30%.",
        "",
        `Hold rate: ${pct(ad.hold_rate * 100)}`,
        `Benchmark: 30%+`,
        "",
        "People are clicking away before the message lands.",
        "Shorten the video or front-load the value prop.",
      ].join("\n"),
    };
  }

  return null;
}

function AdDiagnosticBadge({ diagnostic }: { diagnostic: AdDiagnostic | null }) {
  if (!diagnostic) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="cursor-help">
          <Badge variant="outline" className={`text-[9px] ${diagnostic.color}`}>
            {diagnostic.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs whitespace-pre-line">
          {diagnostic.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Campaign Table ──────────────────────────────────────────────────────────

function CampaignTable({
  campaigns,
  adsets,
  ads,
  fatigueSignals,
  accountHealth,
}: {
  campaigns: MetaAdsCampaignRow[];
  adsets: MetaAdsAdSetRow[];
  ads: MetaAdsAdRow[];
  fatigueSignals: MetaAdsFatigueSignal[];
  accountHealth: MetaAdsMetrics["account_health"];
}) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  const signalsByAdId = useMemo(() => {
    const map = new Map<string, MetaAdsFatigueSignal[]>();
    for (const signal of fatigueSignals) {
      const existing = map.get(signal.ad_id) ?? [];
      existing.push(signal);
      map.set(signal.ad_id, existing);
    }
    return map;
  }, [fatigueSignals]);

  const highFreqCampaigns = useMemo(() => {
    const map = new Map<string, number>();
    for (const signal of fatigueSignals) {
      if (signal.signal_type === "high_frequency") {
        map.set(signal.ad_id, signal.current_value);
      }
    }
    return map;
  }, [fatigueSignals]);

  const accountCvr = accountHealth.total_clicks > 0
    ? accountHealth.total_purchases / accountHealth.total_clicks
    : 0;

  const campaignCpaMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of campaigns) {
      map.set(c.campaign_id, c.cpa);
    }
    return map;
  }, [campaigns]);

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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 pr-4">Campaign</th>
            <th className="pb-2 pr-3">Stage</th>
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
                  <td className="py-2 pr-3">{funnelBadge(c.funnel_stage)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {usd.format(c.spend)}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${cpaColor(c.cpa)}`}
                  >
                    {c.purchases > 0 ? usd2.format(c.cpa) : "—"}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${c.roas > 0 ? roasColor(c.roas) : ""}`}
                  >
                    {c.purchases > 0 ? `${c.roas.toFixed(2)}x` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {num.format(c.purchases)}
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
                          <td
                            className="py-1.5 pr-4 pl-8 max-w-[200px] text-muted-foreground"
                            title={as.adset_name}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              {hasAds ? (
                                isAdSetExpanded ? (
                                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                                )
                              ) : (
                                <span className="w-3 shrink-0" />
                              )}
                              {as.adset_name}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3" />
                          <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                            {usd.format(as.spend)}
                          </td>
                          <td
                            className={`py-1.5 pr-3 text-right tabular-nums ${cpaColor(as.cpa)}`}
                          >
                            {as.purchases > 0 ? usd2.format(as.cpa) : "—"}
                          </td>
                          <td
                            className={`py-1.5 pr-3 text-right tabular-nums ${as.purchases > 0 ? roasColor(as.roas) : ""}`}
                          >
                            {as.purchases > 0 ? `${as.roas.toFixed(2)}x` : "—"}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                            {num.format(as.purchases)}
                          </td>
                          <td
                            className={`py-1.5 text-right tabular-nums ${as.frequency > 3 ? "text-red-400" : ""}`}
                          >
                            {as.frequency.toFixed(1)}
                          </td>
                        </tr>

                        {/* Ad rows */}
                        {isAdSetExpanded &&
                          childAds.map((ad) => (
                            <tr
                              key={ad.ad_id}
                              className="border-b border-border/20 border-l-2 border-l-border/40 bg-muted/5 text-xs"
                            >
                              <td
                                className="py-1.5 pr-4 pl-14 max-w-[200px] truncate text-muted-foreground/80"
                                title={ad.ad_name}
                              >
                                {ad.ad_name}
                              </td>
                              <td className="py-1.5 pr-3">
                                <AdDiagnosticBadge
                                  diagnostic={diagnoseAd({
                                    ad,
                                    campaignCpa: campaignCpaMap.get(ad.campaign_id) ?? 0,
                                    signalsByAdId,
                                    highFreqCampaigns,
                                    accountCvr,
                                  })}
                                />
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground/60">
                                {usd.format(ad.spend)}
                              </td>
                              <td className={`py-1.5 pr-3 text-right tabular-nums ${cpaColor(ad.cpa)}`}>
                                {ad.purchases > 0 ? usd2.format(ad.cpa) : "—"}
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
                                  <span><span className="text-[10px] text-muted-foreground/40">CTR </span>{pct((ad.clicks / ad.impressions) * 100)}</span>
                                ) : "—"}
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
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

// ─── Fatigue Signals ─────────────────────────────────────────────────────────

function FatigueSignals({
  signals,
}: {
  signals: MetaAdsMetrics["signals"];
}) {
  if (signals.fatigued_ads.length === 0) {
    return (
      <p className="text-sm text-emerald-400/70">No fatigue signals detected.</p>
    );
  }

  const labels: Record<string, string> = {
    high_frequency: "High Frequency",
    rising_cpm: "Rising CPM",
    declining_ctr: "Declining CTR",
  };

  return (
    <div className="space-y-1.5">
      {signals.fatigued_ads.map((signal, i) => (
        <div
          key={`${signal.ad_id}-${signal.signal_type}-${i}`}
          className="flex items-center gap-2 text-sm"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="truncate max-w-[200px]" title={signal.ad_name}>
            {signal.ad_name}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20"
          >
            {labels[signal.signal_type] ?? signal.signal_type}
          </Badge>
          <span className="text-muted-foreground text-xs tabular-nums">
            {signal.current_value.toFixed(1)} (threshold: {signal.threshold.toFixed(1)})
          </span>
        </div>
      ))}
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
          fatigueSignals={data.signals.fatigued_ads}
          accountHealth={data.account_health}
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

      {/* Fatigue Signals */}
      <CollapsibleSection title="Fatigue Signals">
        <FatigueSignals signals={data.signals} />
      </CollapsibleSection>

      {/* Audience Breakdowns */}
      <CollapsibleSection title="Audience Breakdowns">
        <AudienceSection audience={data.audience} hasMissing={audienceMissing} />
      </CollapsibleSection>
    </div>
  );
}
