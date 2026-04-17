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
import { cpaColor, roasColor } from "@/lib/utils/meta-ads-formatting";
import type {
  GoogleAdsMetrics,
  GoogleAdsSegmentHealth,
  GoogleAdsCampaignMetrics,
  GoogleAdsSegmentTrend,
  GoogleAdsSourceDetail,
  CampaignSegment,
} from "@/lib/schemas/sources/google-ads-metrics";

// ─── Type guard ──────────────────────────────────────────────────────────────

export function isGoogleAdsMetrics(data: unknown): data is GoogleAdsMetrics {
  return (
    typeof data === "object" &&
    data !== null &&
    "account_health" in data &&
    "campaigns" in data &&
    "ground_truth" in data
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

// ─── Color helpers ───────────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<CampaignSegment, string> = {
  brand: "#60a5fa",
  "non-brand": "#4ade80",
  pmax: "#c084fc",
  competitor: "#f97316",
  charters: "#f59e0b",
  video: "#06b6d4",
  other: "#888888",
};

function trendColor(change: number, inverted = false): string {
  const isBad = inverted ? change > 0 : change < 0;
  if (Math.abs(change) < 0.05) return "text-muted-foreground";
  return isBad ? "text-red-400" : "text-emerald-400";
}

function formatChange(change: number | null): string {
  if (change === null) return "—";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${(change * 100).toFixed(0)}%`;
}

// ─── Status badge ────────────────────────────────────────────────────────────

function statusBadge(segment: GoogleAdsSegmentHealth): {
  label: string;
  className: string;
} {
  if (segment.segment === "video") {
    return {
      label: "Awareness",
      className: "bg-muted text-muted-foreground border-border",
    };
  }
  if (segment.cpa_status === "on-target") {
    return {
      label: "Healthy",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  }
  if (segment.cpa_status === "elevated") {
    return {
      label: "Watch",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
  }
  return {
    label: "Bleeding",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  };
}

// ─── Segment label ───────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<CampaignSegment, string> = {
  brand: "BRAND",
  "non-brand": "NON-BRAND",
  charters: "CHARTERS",
  pmax: "PMAX",
  competitor: "COMPETITOR",
  video: "VIDEO",
  other: "OTHER",
};

// Charters are tracked separately (different business unit, not shuttle CAC)
const CHARTER_SEGMENT: CampaignSegment = "charters";

// ─── Collapsible section ─────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-1.5 text-left hover:opacity-80"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {!open && summary && (
          <span className="text-[10px] text-muted-foreground/60">
            {summary}
          </span>
        )}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

// ─── CPA Diagnostic ──────────────────────────────────────────────────────────

function CpaDiagnostic({
  segmentTrend,
  segmentHealth,
}: {
  segmentTrend: GoogleAdsSegmentTrend | undefined;
  segmentHealth: GoogleAdsSegmentHealth;
}) {
  if (segmentHealth.total_conversions === 0 && segmentHealth.total_spend > 0) {
    return (
      <div className="mt-2.5 border-t border-border/40 pt-2">
        <div className="text-[9px] font-bold text-red-400">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          ZOMBIE: Spending with zero conversions
        </div>
        <div className="mt-1 rounded bg-red-500/5 px-2 py-1 text-[9px] text-red-400">
          → Pause or restructure. No conversions to optimize toward.
        </div>
      </div>
    );
  }

  if (!segmentTrend) return null;

  const cpcChange = segmentTrend.avg_cpc.yoy_change ?? segmentTrend.avg_cpc.mom_change;
  const cvrChange = segmentTrend.cvr.yoy_change ?? segmentTrend.cvr.mom_change;
  const trendLabel = segmentTrend.avg_cpc.yoy_change !== null ? "YoY" : "MoM";

  const cpcUp = cpcChange > 0.10;
  const cvrDown = cvrChange < -0.10;
  const cpcStable = Math.abs(cpcChange) <= 0.10;
  const cvrStable = Math.abs(cvrChange) <= 0.10;

  let diagnosis = "";
  let diagColor = "text-muted-foreground";

  if (cpcUp && cvrStable) {
    diagnosis = "CPC is the problem. Competition or Quality Score issue.";
    diagColor = "text-amber-400";
  } else if (cpcStable && cvrDown) {
    diagnosis = "CVR is the problem. Check landing pages and search term relevance.";
    diagColor = "text-amber-400";
  } else if (cpcUp && cvrDown) {
    diagnosis = "Both CPC and CVR degrading. Fix conversion rate first (free, higher leverage).";
    diagColor = "text-red-400";
  } else if (cpcStable && cvrStable) {
    diagnosis = "CPA elevated but components stable. Check if seasonal (compare YoY).";
    diagColor = "text-muted-foreground";
  } else {
    diagnosis = "Mixed signals. Review CPC and CVR trends.";
    diagColor = "text-amber-400";
  }

  const currentCvr = segmentHealth.total_clicks > 0
    ? segmentHealth.total_conversions / segmentHealth.total_clicks
    : 0;

  return (
    <div className="mt-2.5 border-t border-border/40 pt-2">
      <div className="mb-1.5 text-[9px] font-bold text-amber-400">
        <AlertTriangle className="mr-1 inline h-3 w-3" />
        WHY: CPA Decomposition
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded bg-muted/30 px-2 py-1">
          <div className="text-[8px] text-muted-foreground">CPC (cost/click)</div>
          <div className="text-[10px]">
            {usd2.format(segmentHealth.avg_cpc)}{" "}
            <span className={`text-[9px] ${trendColor(cpcChange, true)}`}>
              {formatChange(cpcChange)} {trendLabel}
            </span>
          </div>
        </div>
        <div className="rounded bg-muted/30 px-2 py-1">
          <div className="text-[8px] text-muted-foreground">CVR (conv rate)</div>
          <div className="text-[10px]">
            {pct(currentCvr * 100)}{" "}
            <span className={`text-[9px] ${trendColor(cvrChange, false)}`}>
              {formatChange(cvrChange)} {trendLabel}
            </span>
          </div>
        </div>
      </div>
      <div className={`mt-1.5 rounded px-2 py-1 text-[9px] ${diagColor} bg-muted/20`}>
        → {diagnosis}
      </div>
    </div>
  );
}

// ─── Segment card ────────────────────────────────────────────────────────────

function SegmentCard({
  segment,
  segmentTrend,
}: {
  segment: GoogleAdsSegmentHealth;
  segmentTrend: GoogleAdsSegmentTrend | undefined;
}) {
  const color = SEGMENT_COLORS[segment.segment];
  const badge = statusBadge(segment);
  const isVideo = segment.segment === "video";
  const showDiagnostic =
    !isVideo &&
    (segment.cpa_status === "elevated" || segment.cpa_status === "high");

  const cpaTrend = segmentTrend?.cpa;
  const convTrend = segmentTrend?.conversions;
  const cpaChange = cpaTrend?.yoy_change ?? cpaTrend?.mom_change ?? null;
  const convChange = convTrend?.yoy_change ?? convTrend?.mom_change ?? null;
  const trendLabel = cpaTrend?.yoy_change != null ? "last year" : "last month";

  return (
    <div
      className="rounded-md bg-card p-3"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold" style={{ color }}>
          {SEGMENT_LABELS[segment.segment]}
        </span>
        <Badge variant="outline" className={`text-[9px] ${badge.className}`}>
          {badge.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <div>
          <div className="text-[8px] text-muted-foreground">SPEND</div>
          <div>{usd.format(segment.total_spend)}</div>
        </div>
        {isVideo ? (
          <div>
            <div className="text-[8px] text-muted-foreground">CPV</div>
            <div>
              {usd2.format(
                segment.total_impressions > 0
                  ? segment.total_spend / segment.total_impressions
                  : 0,
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-[8px] text-muted-foreground">CPA</div>
            <div className={cpaColor(segment.cpa)}>
              {segment.total_conversions === 0 && segment.total_spend > 0
                ? "—"
                : usd2.format(segment.cpa)}
            </div>
          </div>
        )}
        {isVideo ? (
          <div>
            <div className="text-[8px] text-muted-foreground">VIEWS</div>
            <div>{num.format(segment.total_impressions)}</div>
          </div>
        ) : (
          <div>
            <div className="text-[8px] text-muted-foreground">ROAS</div>
            <div className={roasColor(segment.roas)}>
              {segment.roas.toFixed(1)}x
            </div>
          </div>
        )}
        {isVideo ? (
          <div>
            <div className="text-[8px] text-muted-foreground">CTR</div>
            <div>{pct(segment.ctr * 100)}</div>
          </div>
        ) : (
          <div>
            <div className="text-[8px] text-muted-foreground">CONV</div>
            <div>{num.format(Math.round(segment.total_conversions))}</div>
          </div>
        )}
      </div>

      {cpaChange !== null && !isVideo && (
        <div className="mt-1.5 text-[9px] text-muted-foreground">
          vs. {trendLabel}: CPA{" "}
          <span className={trendColor(cpaChange, true)}>
            {formatChange(cpaChange)}
          </span>
          {convChange !== null && (
            <>
              {" · Conv "}
              <span className={trendColor(convChange, false)}>
                {formatChange(convChange)}
              </span>
            </>
          )}
        </div>
      )}

      {showDiagnostic && (
        <CpaDiagnostic
          segmentTrend={segmentTrend}
          segmentHealth={segment}
        />
      )}
    </div>
  );
}

// ─── Campaign table for one segment ──────────────────────────────────────────

function SegmentCampaignTable({
  campaigns,
  segment,
}: {
  campaigns: GoogleAdsCampaignMetrics[];
  segment: CampaignSegment;
}) {
  const filtered = campaigns
    .filter((c) => c.segment === segment)
    .sort((a, b) => b.spend - a.spend);

  if (filtered.length === 0) return null;

  const isVideo = segment === "video";

  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="border-b border-border/40 text-[9px] uppercase text-muted-foreground">
          <td className="px-1.5 py-1.5">Campaign</td>
          <td className="px-1.5 py-1.5 text-right">Spend</td>
          {isVideo ? (
            <>
              <td className="px-1.5 py-1.5 text-right">Impr</td>
              <td className="px-1.5 py-1.5 text-right">Clicks</td>
              <td className="px-1.5 py-1.5 text-right">CTR</td>
              <td className="px-1.5 py-1.5 text-right">Avg CPC</td>
            </>
          ) : (
            <>
              <td className="px-1.5 py-1.5 text-right">CPA</td>
              <td className="px-1.5 py-1.5 text-right">ROAS</td>
              <td className="px-1.5 py-1.5 text-right">Clicks</td>
              <td className="px-1.5 py-1.5 text-right">Conv</td>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {filtered.map((c) => {
          const isZombie = c.conversions === 0 && c.spend > 0 && !isVideo;
          return (
            <tr
              key={c.campaign_id}
              className={`border-b border-border/20 ${
                isZombie ? "bg-red-500/5" : ""
              }`}
            >
              <td className="px-1.5 py-1.5">
                <span
                  className={
                    c.status === "PAUSED" ? "text-muted-foreground/60" : ""
                  }
                  title={c.campaign_name}
                >
                  {c.campaign_name.length > 40
                    ? c.campaign_name.slice(0, 40) + "…"
                    : c.campaign_name}
                </span>
                {isZombie && (
                  <Badge
                    variant="outline"
                    className="ml-1.5 border-border bg-muted text-[8px] text-muted-foreground"
                  >
                    ZOMBIE
                  </Badge>
                )}
              </td>
              <td className="px-1.5 py-1.5 text-right tabular-nums">
                {usd.format(c.spend)}
              </td>
              {isVideo ? (
                <>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {num.format(c.impressions)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {num.format(c.clicks)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {pct(c.ctr * 100)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {usd2.format(c.avg_cpc)}
                  </td>
                </>
              ) : (
                <>
                  <td
                    className={`px-1.5 py-1.5 text-right tabular-nums ${cpaColor(c.cpa)}`}
                  >
                    {c.conversions === 0 ? "—" : usd2.format(c.cpa)}
                  </td>
                  <td
                    className={`px-1.5 py-1.5 text-right tabular-nums ${roasColor(c.roas)}`}
                  >
                    {c.spend === 0 ? "—" : `${c.roas.toFixed(1)}x`}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {num.format(c.clicks)}
                  </td>
                  <td
                    className={`px-1.5 py-1.5 text-right tabular-nums ${
                      isZombie ? "text-red-400" : ""
                    }`}
                  >
                    {num.format(Math.round(c.conversions))}
                  </td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Source badges ────────────────────────────────────────────────────────────

function SourceBadges({
  details,
}: {
  details: Record<string, GoogleAdsSourceDetail>;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {Object.entries(details).map(([key, detail]) => {
        const Icon =
          detail.status === "ok"
            ? CheckCircle2
            : detail.status === "warning"
              ? AlertTriangle
              : XCircle;
        const iconColor =
          detail.status === "ok"
            ? "text-emerald-400"
            : detail.status === "warning"
              ? "text-amber-400"
              : "text-red-400";
        return (
          <TooltipProvider key={key}>
            <Tooltip>
              <TooltipTrigger className={`flex items-center gap-1 text-[9px] ${iconColor}`}>
                <Icon className="h-3 w-3" />
                {detail.displayName}
              </TooltipTrigger>
              {detail.message && (
                <TooltipContent>
                  <p className="text-xs">{detail.message}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GoogleAdsFetchSummary({
  data,
}: {
  data: GoogleAdsMetrics;
}) {
  const { period, account_health, campaigns, ground_truth, metadata } = data;
  const segment_trends = data.segment_trends ?? [];
  // Separate charters from main segments (different business unit)
  const mainSegments = account_health.segments.filter(
    (s) => s.segment !== CHARTER_SEGMENT && s.campaign_count > 0,
  );
  const chartersSegment = account_health.segments.find((s) => s.segment === CHARTER_SEGMENT);
  const chartersCampaigns = campaigns.filter((c) => c.segment === CHARTER_SEGMENT);

  const trendBySegment = new Map(
    segment_trends.map((t) => [t.segment, t]),
  );

  const channelContext =
    ground_truth.bigquery_bookings > 0
      ? `Google claims ${num.format(Math.round(ground_truth.google_ads_conversions))} of ${num.format(Math.round(ground_truth.bigquery_bookings))} total bookings (${Math.round((ground_truth.google_ads_conversions / ground_truth.bigquery_bookings) * 100)}%)`
      : null;

  const segmentOrder: CampaignSegment[] = [
    "non-brand",
    "brand",
    "pmax",
    "competitor",
    "video",
    "other",
  ];
  const activeSegments = segmentOrder.filter((s) =>
    campaigns.some((c) => c.segment === s),
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-start justify-between border-b border-border/40 pb-3">
          <div>
            <h2 className="text-base font-semibold">Google Ads Analysis</h2>
            <p className="text-[11px] text-muted-foreground">
              Campaign performance by segment
              (Brand/Non-Brand/Competitor/PMax), CPA/ROAS decision metrics,
              and YoY trends.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground">
              {period.month} {period.year}
            </div>
            <div className="text-sm font-semibold">
              Total Spend: {usd.format(account_health.total_spend)}
            </div>
            {channelContext && (
              <div className="text-[10px] text-muted-foreground">
                {channelContext}
              </div>
            )}
          </div>
        </div>

        <SourceBadges details={metadata.source_details} />

        {/* ── Segment health cards (excludes charters) ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mainSegments.map((seg) => (
            <SegmentCard
              key={seg.segment}
              segment={seg}
              segmentTrend={trendBySegment.get(seg.segment)}
            />
          ))}
        </div>

        {/* ── Campaign tables by segment (excludes charters) ── */}
        <div className="mt-2">
          {activeSegments.map((seg) => {
            const segCampaigns = campaigns.filter((c) => c.segment === seg);
            const segHealth = mainSegments.find((s) => s.segment === seg);
            const segSpend = segCampaigns.reduce((s, c) => s + c.spend, 0);
            const segCpa = segHealth?.cpa ?? 0;
            const summary = `${segCampaigns.length} campaigns · ${usd.format(segSpend)} spend${seg !== "video" ? ` · CPA ${usd2.format(segCpa)}` : ""}`;

            return (
              <CollapsibleSection
                key={seg}
                title={`${SEGMENT_LABELS[seg]} Campaigns`}
                summary={summary}
                defaultOpen={seg === "non-brand"}
              >
                <SegmentCampaignTable campaigns={campaigns} segment={seg} />
              </CollapsibleSection>
            );
          })}
        </div>

        {/* ── Charters (separate business unit) ── */}
        {chartersCampaigns.length > 0 && chartersSegment && (
          <div className="mt-4 border-t border-border/40 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Charters
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Separate business unit. Not included in shuttle acquisition metrics above.
                </p>
              </div>
              <div className="text-right text-[10px]">
                <span className="text-muted-foreground">Spend: </span>
                <span className="font-semibold">{usd.format(chartersSegment.total_spend)}</span>
                <span className="text-muted-foreground"> · CPA: </span>
                <span className={`font-semibold ${cpaColor(chartersSegment.cpa)}`}>
                  {chartersSegment.total_conversions === 0
                    ? "—"
                    : usd2.format(chartersSegment.cpa)}
                </span>
                <span className="text-muted-foreground"> · Conv: </span>
                <span>{num.format(Math.round(chartersSegment.total_conversions))}</span>
              </div>
            </div>
            <SegmentCampaignTable campaigns={campaigns} segment={CHARTER_SEGMENT} />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
