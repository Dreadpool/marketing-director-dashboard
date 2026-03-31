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
} from "lucide-react";
import type {
  MetaAdsMetrics,
  MetaAdsCampaignRow,
  MetaAdsAdRow,
  MetaAdsBreakdownRow,
  MetaAdsSourceDetail,
} from "@/lib/schemas/sources/meta-ads-metrics";

// ─── Type guard ──────────────────────────────────────────────────────────────

export function isMetaAdsMetrics(data: unknown): data is MetaAdsMetrics {
  return (
    typeof data === "object" &&
    data !== null &&
    "account_health" in data &&
    "campaigns" in data &&
    "metadata" in data
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

function cpaColor(cpa: number): string {
  if (cpa <= 0) return "";
  if (cpa < 50) return "text-emerald-400";
  if (cpa < 75) return "text-amber-400";
  return "text-red-400";
}

function roasColor(roas: number): string {
  return roas >= 2.0 ? "text-emerald-400" : "text-red-400";
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Total Spend"
        value={usd.format(health.total_spend)}
        secondary={`${num.format(health.total_impressions)} impressions`}
      />
      <MetricCard
        label="CPA"
        value={usd2.format(health.cpa)}
        secondary={health.cpa_status === "on-target" ? "On target (<$50)" : health.cpa_status === "elevated" ? "Elevated ($50-75)" : "High (>$75)"}
        tooltip="Cost Per Acquisition. CTC primary decision metric. TOF target: <$50, Retargeting: <$75"
        statusColor={cpaColor(health.cpa)}
      />
      <MetricCard
        label="ROAS"
        value={`${health.roas.toFixed(2)}x`}
        secondary={health.roas_status === "above-target" ? "Above target (>2.0x)" : "Below target (<2.0x)"}
        tooltip="Return on Ad Spend. Target: >2.0x"
        statusColor={roasColor(health.roas)}
      />
      <MetricCard
        label="Purchases"
        value={num.format(health.total_purchases)}
        secondary={`${usd.format(health.total_attributed_revenue)} revenue`}
        tooltip="Meta-attributed purchases (28d click window)"
      />
    </div>
  );
}

// ─── Campaign Table ──────────────────────────────────────────────────────────

function CampaignTable({ campaigns }: { campaigns: MetaAdsCampaignRow[] }) {
  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No campaign data available.</p>
    );
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
          {campaigns.map((c) => (
            <tr
              key={c.campaign_id}
              className="border-b border-border/50 last:border-0"
            >
              <td className="py-2 pr-4 max-w-[200px] truncate" title={c.campaign_name}>
                {c.campaign_name}
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
          ))}
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
        <CampaignTable campaigns={data.campaigns} />
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
