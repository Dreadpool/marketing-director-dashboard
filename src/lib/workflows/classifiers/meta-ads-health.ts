import type {
  MetaAdsAdRow,
  MetaAdsAdSetRow,
  MetaAdsCampaignRow,
  MetaAdsAccountHealth,
  AdHealthClassification,
  AdSetHealthClassification,
} from "@/lib/schemas/sources/meta-ads-metrics";

export type AccountBenchmarks = {
  cpa: number; // Account-level CPA
  ctr: number; // Account-level CTR (as a ratio, e.g. 0.012 for 1.2%)
  cpm: number; // Account-level CPM
  campaignCpas: Map<string, number>; // campaign_id -> campaign CPA
  campaignFrequencies: Map<string, number>; // campaign_id -> frequency
};

export function buildBenchmarks(
  accountHealth: MetaAdsAccountHealth,
  campaigns: MetaAdsCampaignRow[],
): AccountBenchmarks {
  const campaignCpas = new Map<string, number>();
  const campaignFrequencies = new Map<string, number>();
  for (const c of campaigns) {
    campaignCpas.set(c.campaign_id, c.cpa);
    campaignFrequencies.set(c.campaign_id, c.frequency);
  }
  return {
    cpa: accountHealth.cpa,
    // account_health.ctr is already a percent (e.g., 1.2 for 1.2%). Convert to
    // ratio for comparison with ad-level clicks/impressions.
    ctr: accountHealth.ctr / 100,
    cpm: accountHealth.cpm,
    campaignCpas,
    campaignFrequencies,
  };
}

export function classifyAdHealth(
  ad: MetaAdsAdRow,
  benchmarks: AccountBenchmarks,
): AdHealthClassification {
  // Compute ad CTR as ratio (clicks / impressions)
  const adCtr = ad.impressions > 0 ? ad.clicks / ad.impressions : 0;
  const campaignCpa = benchmarks.campaignCpas.get(ad.campaign_id) ?? 0;

  const signals: string[] = [];

  // Priority 1: Learning (not enough data)
  if (ad.impressions < 1000 || ad.spend < 27) {
    return {
      status: "learning",
      reason: `Only ${ad.impressions.toLocaleString()} impressions and $${ad.spend.toFixed(0)} spent. Need at least 1,000 impressions or $27 (3x target CPA) to judge.`,
      action: "Not enough data. Leave it alone.",
      signals: [],
    };
  }

  // Priority 2: Kill - spent 3x target CPA with zero conversions
  if (ad.spend >= 27 && ad.purchases === 0) {
    return {
      status: "kill",
      reason: `Spent $${ad.spend.toFixed(0)} (3x the $9 target CPA) with zero conversions. Statistical confidence 95% this ad will not convert.`,
      action: "Kill. Spent 3x target CPA with zero conversions.",
      signals: ["$27+ spend", "0 purchases"],
    };
  }

  // Priority 3: Kill - nobody clicks (CTR < 0.5% after 1000+ impressions)
  if (adCtr < 0.005) {
    return {
      status: "kill",
      reason: `CTR of ${(adCtr * 100).toFixed(2)}% after ${ad.impressions.toLocaleString()} impressions. Nobody is clicking.`,
      action: "Kill. Nobody is clicking.",
      signals: [`CTR ${(adCtr * 100).toFixed(2)}% < 0.5%`],
    };
  }

  // Priority 4: Kill - video hook rate too low (only if this is a video ad)
  if (ad.hook_rate !== null && ad.hook_rate < 0.15) {
    return {
      status: "kill",
      reason: `Hook rate of ${(ad.hook_rate * 100).toFixed(0)}%. Fewer than 15% of viewers watch past 3 seconds.`,
      action: "Kill. Nobody watches past 3 seconds.",
      signals: [`Hook rate ${(ad.hook_rate * 100).toFixed(0)}% < 15%`],
    };
  }

  // Priority 5: Underperforming - has conversions but CPA > $14
  if (ad.purchases > 0 && ad.cpa > 14) {
    return {
      status: "underperforming",
      reason: `CPA of $${ad.cpa.toFixed(2)} with ${ad.purchases} purchases. Above the $14 high threshold. Losing money after 1.3x Meta over-attribution.`,
      action: "Losing money. Pause or revise creative.",
      signals: [`CPA $${ad.cpa.toFixed(2)} > $14`],
    };
  }

  // Priority 6: Watch - dragging down its campaign
  if (campaignCpa > 0 && ad.cpa > campaignCpa * 1.5) {
    signals.push(
      `CPA $${ad.cpa.toFixed(2)} > 1.5x campaign CPA $${campaignCpa.toFixed(2)}`,
    );
    return {
      status: "watch",
      reason: `CPA of $${ad.cpa.toFixed(2)} is 50%+ higher than its campaign average of $${campaignCpa.toFixed(2)}. Dragging down campaign performance.`,
      action: "Monitor. Consider pausing if pattern continues.",
      signals,
    };
  }

  // Priority 7: Watch - weak engagement (CTR < 70% of account average)
  if (benchmarks.ctr > 0 && adCtr < benchmarks.ctr * 0.7) {
    signals.push(
      `CTR ${(adCtr * 100).toFixed(2)}% < 70% of account avg ${(benchmarks.ctr * 100).toFixed(2)}%`,
    );
    return {
      status: "watch",
      reason: `CTR of ${(adCtr * 100).toFixed(2)}% is below 70% of the account average (${(benchmarks.ctr * 100).toFixed(2)}%). Weak engagement signal.`,
      action: "Monitor. Creative may be losing resonance.",
      signals,
    };
  }

  // Priority 8: Watch - video hook/hold rate weak (but not kill-level)
  if (ad.hook_rate !== null && ad.hook_rate < 0.25) {
    signals.push(`Hook rate ${(ad.hook_rate * 100).toFixed(0)}% < 25%`);
    return {
      status: "watch",
      reason: `Hook rate of ${(ad.hook_rate * 100).toFixed(0)}% is weak. Fewer than 25% of viewers watch past 3 seconds.`,
      action: "Monitor. Consider a stronger hook.",
      signals,
    };
  }
  if (ad.hold_rate !== null && ad.hold_rate < 0.3) {
    signals.push(`Hold rate ${(ad.hold_rate * 100).toFixed(0)}% < 30%`);
    return {
      status: "watch",
      reason: `Hold rate of ${(ad.hold_rate * 100).toFixed(0)}% is weak. Viewers aren't finishing the video.`,
      action: "Monitor. Tighten the middle of the video.",
      signals,
    };
  }

  // Priority 9: Healthy
  return {
    status: "healthy",
    reason: `CPA $${ad.cpa.toFixed(2)}, CTR ${(adCtr * 100).toFixed(2)}%, ${ad.purchases} purchases on $${ad.spend.toFixed(0)} spend.`,
    action: "Performing well. Leave it running.",
    signals: [],
  };
}

export function classifyAdSetHealth(
  adSet: MetaAdsAdSetRow,
): AdSetHealthClassification {
  const LEARNING_BUDGET = 6000;

  // Priority 1: Learning (under learning budget)
  if (adSet.spend < LEARNING_BUDGET) {
    return {
      status: "learning",
      reason: `Spent $${adSet.spend.toFixed(0)} of $${LEARNING_BUDGET} learning budget. Need more data before making decisions.`,
      action: "Still in learning phase. Don't make changes yet.",
      signals: [],
    };
  }

  // Priority 2: Kill - learning budget spent with zero conversions
  if (adSet.spend >= LEARNING_BUDGET && adSet.purchases === 0) {
    return {
      status: "kill",
      reason: `Spent full $${LEARNING_BUDGET} learning budget with zero conversions. Audience or offer is not working.`,
      action: "Kill. Full learning budget spent, zero conversions.",
      signals: [`$${adSet.spend.toFixed(0)} spent`, "0 purchases"],
    };
  }

  // Priority 3: Underperforming - high CPA with enough volume
  if (adSet.cpa > 14 && adSet.purchases >= 3) {
    return {
      status: "underperforming",
      reason: `CPA of $${adSet.cpa.toFixed(2)} with ${adSet.purchases} purchases. Above the $14 high threshold.`,
      action: "Losing money. Review individual ads or kill the set.",
      signals: [`CPA $${adSet.cpa.toFixed(2)} > $14`],
    };
  }

  // Priority 4: Watch - elevated CPA
  if (adSet.cpa > 9 && adSet.cpa <= 14) {
    return {
      status: "watch",
      reason: `CPA of $${adSet.cpa.toFixed(2)} in elevated range ($9-$14).`,
      action: "CPA elevated. Check individual ads and audience targeting.",
      signals: [`CPA $${adSet.cpa.toFixed(2)} > $9`],
    };
  }

  // Priority 5: Healthy
  return {
    status: "healthy",
    reason: `CPA $${adSet.cpa.toFixed(2)}, ${adSet.purchases} purchases on $${adSet.spend.toFixed(0)} spend.`,
    action: "On track. Consider scaling budget if CPA stays stable.",
    signals: [],
  };
}
