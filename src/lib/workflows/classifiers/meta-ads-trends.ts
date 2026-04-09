import type {
  DailyPoint,
  TrendSummary,
  TrendDirection,
  AdHealthClassification,
} from "@/lib/schemas/sources/meta-ads-metrics";

/**
 * Compute a 7-day trend summary from daily points.
 * Compares the last 7 days vs the prior 7 days to detect direction.
 * For ads with < 14 days of data, uses whatever is available.
 *
 * Pure function. No side effects.
 */
export function computeDailyTrend(dailyPoints: DailyPoint[]): TrendSummary {
  // Sort ascending by date
  const sorted = [...dailyPoints].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  if (sorted.length === 0) {
    return {
      ctr_direction: "flat",
      cpa_direction: "flat",
      ctr_7d_change_pct: null,
      cpa_7d_change_pct: null,
      peak_ctr: 0,
      current_ctr: 0,
      lifecycle_stage: "learning",
    };
  }

  // Peak CTR observed
  const peak_ctr = Math.max(...sorted.map((d) => d.ctr));

  // Current CTR = average of last 3 days (smoothing)
  const lastN = sorted.slice(-3);
  const current_ctr = avg(lastN.map((d) => d.ctr));

  // 7-day windows
  const last7 = sorted.slice(-7);
  const prior7 = sorted.length >= 14 ? sorted.slice(-14, -7) : [];

  let ctr_7d_change_pct: number | null = null;
  let cpa_7d_change_pct: number | null = null;

  if (prior7.length >= 3 && last7.length >= 3) {
    const avgCtrLast = avg(last7.map((d) => d.ctr));
    const avgCtrPrior = avg(prior7.map((d) => d.ctr));
    if (avgCtrPrior > 0) {
      ctr_7d_change_pct = ((avgCtrLast - avgCtrPrior) / avgCtrPrior) * 100;
    }

    // CPA: only use days with purchases to avoid Infinity
    const last7Cpa = last7.filter((d) => d.purchases > 0);
    const prior7Cpa = prior7.filter((d) => d.purchases > 0);
    if (prior7Cpa.length > 0 && last7Cpa.length > 0) {
      const avgCpaLast = avg(last7Cpa.map((d) => d.cpa));
      const avgCpaPrior = avg(prior7Cpa.map((d) => d.cpa));
      if (avgCpaPrior > 0) {
        cpa_7d_change_pct = ((avgCpaLast - avgCpaPrior) / avgCpaPrior) * 100;
      }
    }
  }

  const ctr_direction = classifyDirection(ctr_7d_change_pct);
  const cpa_direction = classifyDirection(cpa_7d_change_pct);

  const lifecycle_stage = classifyLifecycle(
    sorted,
    peak_ctr,
    current_ctr,
    cpa_7d_change_pct,
  );

  return {
    ctr_direction,
    cpa_direction,
    ctr_7d_change_pct,
    cpa_7d_change_pct,
    peak_ctr,
    current_ctr,
    lifecycle_stage,
  };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

/** 10% change threshold. Positive = rising, negative = declining. */
function classifyDirection(changePct: number | null): TrendDirection {
  if (changePct === null) return "flat";
  const threshold = 10;
  if (Math.abs(changePct) < threshold) return "flat";
  return changePct > 0 ? "rising" : "declining";
}

function classifyLifecycle(
  sorted: DailyPoint[],
  peak_ctr: number,
  current_ctr: number,
  cpa_change_pct: number | null,
): TrendSummary["lifecycle_stage"] {
  // Insufficient data
  if (sorted.length < 3) return "learning";

  // "Performing" = at least 3 days with CPA < $14 AND CTR > 0.5%
  const performingDays = sorted.filter((d) => {
    const hadConversions = d.purchases > 0 && d.cpa > 0;
    return hadConversions && d.cpa < 14 && d.ctr > 0.005;
  });
  const hadPerformingPeriod = performingDays.length >= 3;

  // Born bad: peak CTR below 0.5% OR never had a performing period
  if (peak_ctr < 0.005) return "born_bad";
  if (!hadPerformingPeriod) return "born_bad";

  // Dead: CTR declined 30%+ from peak AND CPA up 50%+ week-over-week
  const ctrDropFromPeak =
    peak_ctr > 0 ? ((peak_ctr - current_ctr) / peak_ctr) * 100 : 0;
  if (
    ctrDropFromPeak >= 30 &&
    cpa_change_pct !== null &&
    cpa_change_pct >= 50
  ) {
    return "dead";
  }

  // Fatiguing: CTR declined 20%+ from peak OR CPA rising 25%+ WoW
  if (ctrDropFromPeak >= 20) return "fatiguing";
  if (cpa_change_pct !== null && cpa_change_pct >= 25) return "fatiguing";

  return "performing";
}

/**
 * Generate a trend-aware health classification for an ad.
 * Runs AFTER classifyAdHealth (which uses monthly aggregates).
 * With daily data we can distinguish "born bad" from "dying."
 *
 * Pure function. Only depends on the trend summary; the caller does not
 * need to pass the ad row or account benchmarks.
 */
export function classifyWithTrends(
  trend: TrendSummary,
): AdHealthClassification {
  // Learning: insufficient data
  if (trend.lifecycle_stage === "learning") {
    return {
      status: "learning",
      reason: "Less than 3 days of data. Too early to judge.",
      action: "Not enough data. Leave it alone.",
      signals: [],
    };
  }

  // Born bad: ad never had a performing period
  if (trend.lifecycle_stage === "born_bad") {
    return {
      status: "kill",
      reason: `Ad never performed. Peak CTR ${(trend.peak_ctr * 100).toFixed(2)}% is below the 0.5% floor, or never achieved CPA < $14 during its run.`,
      action: "Kill. This ad was born bad. Test a different creative concept.",
      signals: [
        `Peak CTR ${(trend.peak_ctr * 100).toFixed(2)}%`,
        "Never had a performing period",
      ],
    };
  }

  // Dead: multiple signals confirm no recovery
  if (trend.lifecycle_stage === "dead") {
    const ctrDropPct =
      trend.peak_ctr > 0
        ? ((trend.peak_ctr - trend.current_ctr) / trend.peak_ctr) * 100
        : 0;
    return {
      status: "kill",
      reason: `CTR declined ${ctrDropPct.toFixed(0)}% from peak of ${(trend.peak_ctr * 100).toFixed(2)}%. CPA up ${trend.cpa_7d_change_pct?.toFixed(0) ?? "?"}% over last 7 days. No recovery.`,
      action: "Kill. Creative is dead. Launch a replacement.",
      signals: [
        `CTR down from peak ${(trend.peak_ctr * 100).toFixed(2)}%`,
        `CPA rising sharply`,
      ],
    };
  }

  // Fatiguing: was performing, now degrading
  if (trend.lifecycle_stage === "fatiguing") {
    const ctrDropFromPeak =
      trend.peak_ctr > 0
        ? ((trend.peak_ctr - trend.current_ctr) / trend.peak_ctr) * 100
        : 0;
    const signals: string[] = [];
    if (ctrDropFromPeak >= 20) {
      signals.push(`CTR down ${ctrDropFromPeak.toFixed(0)}% from peak`);
    }
    if (
      trend.cpa_7d_change_pct !== null &&
      trend.cpa_7d_change_pct >= 25
    ) {
      signals.push(
        `CPA up ${trend.cpa_7d_change_pct.toFixed(0)}% week-over-week`,
      );
    }
    return {
      status: "underperforming",
      reason: `Ad was performing but is now fatiguing. Started strong, now degrading. Likely creative fatigue.`,
      action:
        "Refresh creative. This ad worked once. Iterate on the concept, do not kill it.",
      signals,
    };
  }

  // Performing
  return {
    status: "healthy",
    reason: `Trending ${trend.ctr_direction === "rising" ? "up" : "stable"}. CTR ${(trend.current_ctr * 100).toFixed(2)}%, CPA change ${trend.cpa_7d_change_pct?.toFixed(0) ?? "stable"}% week-over-week.`,
    action: "Performing well. Leave it running.",
    signals: [],
  };
}
