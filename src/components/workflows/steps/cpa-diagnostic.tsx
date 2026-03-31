// src/components/workflows/steps/cpa-diagnostic.tsx

"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── D1: Frequency Check ────────────────────────────────────────────────────

interface FrequencyRow {
  campaign_id: string;
  campaign_name: string;
  frequency: number;
  impressions: number;
  reach: number;
}

export function D1FrequencyViz({ data }: { data: Record<string, unknown> }) {
  const d = data as { weekly_frequency: FrequencyRow[]; threshold: number };
  const flagged = d.weekly_frequency.filter(
    (r) => r.frequency > d.threshold,
  );

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        7-day rolling frequency by campaign. Above {d.threshold.toFixed(1)} = fatigue risk.
      </p>

      {d.weekly_frequency.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campaign data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4">Campaign</th>
                <th className="pb-2 pr-3 text-right">7-Day Freq</th>
                <th className="pb-2 pr-3 text-right">Impressions</th>
                <th className="pb-2 text-right">Reach</th>
              </tr>
            </thead>
            <tbody>
              {d.weekly_frequency.map((row) => (
                <tr
                  key={row.campaign_id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-2 pr-4 max-w-[200px] truncate" title={row.campaign_name}>
                    {row.campaign_name}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${row.frequency > d.threshold ? "text-red-400 font-medium" : ""}`}
                  >
                    {row.frequency.toFixed(1)}
                    {row.frequency > d.threshold && (
                      <AlertTriangle className="inline-block ml-1 h-3 w-3 text-red-400" />
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {num.format(row.impressions)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {num.format(row.reach)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {flagged.length === 0 && d.weekly_frequency.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          All campaigns below frequency threshold.
        </div>
      )}
    </div>
  );
}

// ─── D2: CPM Trend ──────────────────────────────────────────────────────────

interface CpmComparison {
  campaign_id: string;
  campaign_name: string;
  current_cpm: number;
  prior_cpm: number | null;
  change_pct: number | null;
  flagged: boolean;
}

export function D2CpmTrendViz({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    cpm_comparisons: CpmComparison[];
    threshold_pct: number;
  };
  const flaggedCount = d.cpm_comparisons.filter((c) => c.flagged).length;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        CPM comparison: current month vs prior month. Flag if &gt;{d.threshold_pct}% increase.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-4">Campaign</th>
              <th className="pb-2 pr-3 text-right">Current CPM</th>
              <th className="pb-2 pr-3 text-right">Prior CPM</th>
              <th className="pb-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {d.cpm_comparisons.map((row) => (
              <tr
                key={row.campaign_id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 pr-4 max-w-[200px] truncate" title={row.campaign_name}>
                  {row.campaign_name}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {usd2.format(row.current_cpm)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                  {row.prior_cpm !== null ? usd2.format(row.prior_cpm) : "\u2014"}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${row.flagged ? "text-red-400 font-medium" : ""}`}
                >
                  {row.change_pct !== null ? (
                    <>
                      {row.change_pct > 0 ? "+" : ""}
                      {pct(row.change_pct)}
                      {row.flagged && (
                        <AlertTriangle className="inline-block ml-1 h-3 w-3 text-red-400" />
                      )}
                    </>
                  ) : (
                    "\u2014"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {flaggedCount === 0 && d.cpm_comparisons.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          No significant CPM increases detected.
        </div>
      )}
    </div>
  );
}

// ─── D3: CTR Trend ──────────────────────────────────────────────────────────

interface CtrComparison {
  campaign_id: string;
  campaign_name: string;
  current_ctr: number;
  prior_ctr: number | null;
  change_pct: number | null;
  flagged: boolean;
}

export function D3CtrTrendViz({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    ctr_comparisons: CtrComparison[];
    threshold_pct: number;
  };
  const flaggedCount = d.ctr_comparisons.filter((c) => c.flagged).length;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        CTR comparison: current month vs prior month. Flag if &gt;{d.threshold_pct}% decrease.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-4">Campaign</th>
              <th className="pb-2 pr-3 text-right">Current CTR</th>
              <th className="pb-2 pr-3 text-right">Prior CTR</th>
              <th className="pb-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {d.ctr_comparisons.map((row) => (
              <tr
                key={row.campaign_id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 pr-4 max-w-[200px] truncate" title={row.campaign_name}>
                  {row.campaign_name}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {row.current_ctr.toFixed(2)}%
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                  {row.prior_ctr !== null ? `${row.prior_ctr.toFixed(2)}%` : "\u2014"}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${row.flagged ? "text-red-400 font-medium" : ""}`}
                >
                  {row.change_pct !== null ? (
                    <>
                      {row.change_pct > 0 ? "+" : ""}
                      {pct(row.change_pct)}
                      {row.flagged && (
                        <AlertTriangle className="inline-block ml-1 h-3 w-3 text-red-400" />
                      )}
                    </>
                  ) : (
                    "\u2014"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {flaggedCount === 0 && d.ctr_comparisons.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          No significant CTR declines detected.
        </div>
      )}
    </div>
  );
}

// ─── D4: Conversion Rate ────────────────────────────────────────────────────

interface ConversionCampaign {
  campaign_name: string;
  clicks: number;
  purchases: number;
  conversion_rate: number;
}

export function D4ConversionRateViz({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const d = data as {
    account_clicks: number;
    account_purchases: number;
    conversion_rate: number;
    campaigns: ConversionCampaign[];
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        Click volume vs purchase volume. If clicks are stable but purchases drop, the problem is downstream (landing page, booking flow), not the ads.
      </p>

      {/* Account-level summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md bg-muted/50 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Total Clicks</p>
          <p className="text-lg font-heading font-semibold tabular-nums">
            {num.format(d.account_clicks)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Total Purchases</p>
          <p className="text-lg font-heading font-semibold tabular-nums">
            {num.format(d.account_purchases)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-4 py-3">
          <p className="text-[11px] text-muted-foreground">Conversion Rate</p>
          <p className="text-lg font-heading font-semibold tabular-nums">
            {pct(d.conversion_rate)}
          </p>
        </div>
      </div>

      {/* Per-campaign breakdown */}
      {d.campaigns.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4">Campaign</th>
                <th className="pb-2 pr-3 text-right">Clicks</th>
                <th className="pb-2 pr-3 text-right">Purchases</th>
                <th className="pb-2 text-right">CVR</th>
              </tr>
            </thead>
            <tbody>
              {d.campaigns.map((row, i) => (
                <tr
                  key={`${row.campaign_name}-${i}`}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-2 pr-4 max-w-[200px] truncate" title={row.campaign_name}>
                    {row.campaign_name}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {num.format(row.clicks)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {num.format(row.purchases)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {row.clicks > 0 ? pct(row.conversion_rate) : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── D5: Pattern Match ──────────────────────────────────────────────────────

interface PatternSignals {
  frequency_7d: number;
  frequency_flagged: boolean;
  cpm_current: number;
  cpm_prior: number;
  cpm_change_pct: number | null;
  cpm_flagged: boolean;
  ctr_current: number;
  ctr_prior: number;
  ctr_change_pct: number | null;
  ctr_flagged: boolean;
  conversion_rate: number;
  prospecting_cpa: number;
  retargeting_cpa: number;
}

export function D5PatternMatchViz({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const d = data as { signals: PatternSignals };
  const s = d.signals;

  const signals = [
    {
      label: "7-Day Frequency",
      value: s.frequency_7d.toFixed(1),
      flagged: s.frequency_flagged,
      direction: s.frequency_flagged ? "high" : "normal",
    },
    {
      label: "CPM Change",
      value:
        s.cpm_change_pct !== null
          ? `${(s.cpm_change_pct * 100).toFixed(1)}%`
          : "N/A",
      flagged: s.cpm_flagged,
      direction: s.cpm_flagged ? "up" : "stable",
    },
    {
      label: "CTR Change",
      value:
        s.ctr_change_pct !== null
          ? `${(s.ctr_change_pct * 100).toFixed(1)}%`
          : "N/A",
      flagged: s.ctr_flagged,
      direction: s.ctr_flagged ? "down" : "stable",
    },
    {
      label: "Conversion Rate",
      value: pct(s.conversion_rate),
      flagged: false,
      direction: "info",
    },
    {
      label: "Prospecting CPA",
      value: s.prospecting_cpa > 0 ? usd2.format(s.prospecting_cpa) : "N/A",
      flagged: s.prospecting_cpa > 9,
      direction: s.prospecting_cpa > 9 ? "high" : "normal",
    },
    {
      label: "Retargeting CPA",
      value: s.retargeting_cpa > 0 ? usd2.format(s.retargeting_cpa) : "N/A",
      flagged: s.retargeting_cpa > s.prospecting_cpa && s.retargeting_cpa > 0,
      direction:
        s.retargeting_cpa > s.prospecting_cpa ? "high" : "normal",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground/60">
        Combined signals from D1-D4. The AI will match these against known
        patterns to diagnose the root cause of elevated CPA.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {signals.map((sig) => (
          <div
            key={sig.label}
            className={`rounded-md border px-3 py-2 ${sig.flagged ? "border-red-500/20 bg-red-500/5" : "border-border bg-muted/30"}`}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {sig.label}
            </p>
            <p
              className={`text-sm font-semibold tabular-nums ${sig.flagged ? "text-red-400" : ""}`}
            >
              {sig.value}
              {sig.flagged && (
                <AlertTriangle className="inline-block ml-1 h-3 w-3" />
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
