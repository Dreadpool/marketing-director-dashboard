import { describe, it, expect } from "vitest";
import {
  buildBenchmarks,
  classifyAdHealth,
  type AccountBenchmarks,
} from "@/lib/workflows/classifiers/meta-ads-health";
import type {
  MetaAdsAdRow,
  MetaAdsCampaignRow,
  MetaAdsAccountHealth,
} from "@/lib/schemas/sources/meta-ads-metrics";

// ─── Fixture factories ────────────────────────────────────────────────────

function makeAd(overrides: Partial<MetaAdsAdRow> = {}): MetaAdsAdRow {
  return {
    ad_id: "ad_1",
    ad_name: "Test Ad",
    adset_id: "adset_1",
    campaign_id: "campaign_1",
    campaign_name: "Test Campaign",
    adset_name: "Test Ad Set",
    spend: 100,
    impressions: 10000,
    clicks: 150,
    purchases: 10,
    cpa: 10,
    roas: 3.5,
    hook_rate: null,
    hold_rate: null,
    video_3s_views: 0,
    video_thruplay: 0,
    ...overrides,
  };
}

function makeCampaign(
  overrides: Partial<MetaAdsCampaignRow> = {},
): MetaAdsCampaignRow {
  return {
    campaign_id: "campaign_1",
    campaign_name: "Test Campaign",
    objective: "OUTCOME_SALES",
    status: "ACTIVE",
    funnel_stage: "tof",
    spend: 1000,
    impressions: 50000,
    reach: 25000,
    clicks: 500,
    frequency: 2,
    cpm: 20,
    ctr: 1,
    purchases: 100,
    attributed_revenue: 3500,
    cpa: 10,
    roas: 3.5,
    ...overrides,
  };
}

function makeAccountHealth(
  overrides: Partial<MetaAdsAccountHealth> = {},
): MetaAdsAccountHealth {
  return {
    total_spend: 5000,
    total_purchases: 500,
    total_attributed_revenue: 17500,
    cpa: 10,
    roas: 3.5,
    cpm: 20,
    ctr: 1.2, // 1.2% (stored as percent per the type docs)
    total_impressions: 250000,
    total_clicks: 3000,
    total_reach: 125000,
    avg_frequency: 2,
    cpa_status: "elevated",
    roas_status: "above-target",
    ...overrides,
  };
}

function makeBenchmarks(
  overrides: Partial<AccountBenchmarks> = {},
): AccountBenchmarks {
  return {
    cpa: 10,
    ctr: 0.012, // 1.2% as ratio
    cpm: 20,
    campaignCpas: new Map([["campaign_1", 10]]),
    campaignFrequencies: new Map([["campaign_1", 2]]),
    ...overrides,
  };
}

// ─── buildBenchmarks ──────────────────────────────────────────────────────

describe("buildBenchmarks", () => {
  it("returns account-level cpa, cpm, and converts ctr from percent to ratio", () => {
    const accountHealth = makeAccountHealth({ cpa: 12, cpm: 25, ctr: 1.5 });
    const campaigns: MetaAdsCampaignRow[] = [];
    const benchmarks = buildBenchmarks(accountHealth, campaigns);

    expect(benchmarks.cpa).toBe(12);
    expect(benchmarks.cpm).toBe(25);
    // 1.5% stored as 1.5 converts to ratio 0.015
    expect(benchmarks.ctr).toBeCloseTo(0.015, 5);
  });

  it("builds campaign CPA and frequency maps", () => {
    const accountHealth = makeAccountHealth();
    const campaigns: MetaAdsCampaignRow[] = [
      makeCampaign({ campaign_id: "c_a", cpa: 8, frequency: 1.5 }),
      makeCampaign({ campaign_id: "c_b", cpa: 15, frequency: 3.2 }),
    ];
    const benchmarks = buildBenchmarks(accountHealth, campaigns);

    expect(benchmarks.campaignCpas.get("c_a")).toBe(8);
    expect(benchmarks.campaignCpas.get("c_b")).toBe(15);
    expect(benchmarks.campaignFrequencies.get("c_a")).toBe(1.5);
    expect(benchmarks.campaignFrequencies.get("c_b")).toBe(3.2);
  });

  it("returns empty maps when no campaigns supplied", () => {
    const benchmarks = buildBenchmarks(makeAccountHealth(), []);
    expect(benchmarks.campaignCpas.size).toBe(0);
    expect(benchmarks.campaignFrequencies.size).toBe(0);
  });
});

// ─── classifyAdHealth ─────────────────────────────────────────────────────

describe("classifyAdHealth", () => {
  it("returns learning for ads with <1000 impressions", () => {
    const ad = makeAd({ impressions: 500, spend: 50, purchases: 0 });
    const result = classifyAdHealth(ad, makeBenchmarks());
    expect(result.status).toBe("learning");
    expect(result.action).toMatch(/leave it alone/i);
  });

  it("returns learning for ads with <$27 spend", () => {
    const ad = makeAd({ impressions: 2000, spend: 20, purchases: 0 });
    const result = classifyAdHealth(ad, makeBenchmarks());
    expect(result.status).toBe("learning");
  });

  it("returns kill for ad with $30 spend and 0 purchases (Stage 3)", () => {
    const ad = makeAd({
      impressions: 2000,
      spend: 30,
      purchases: 0,
      clicks: 40, // keeps CTR above 0.5% so the CTR rule doesn't fire first
      cpa: 0,
    });
    const result = classifyAdHealth(ad, makeBenchmarks());
    expect(result.status).toBe("kill");
    expect(result.reason).toMatch(/3x/);
    expect(result.signals).toContain("0 purchases");
  });

  it("returns kill for CTR < 0.5% after 1000+ impressions", () => {
    // Need to pass the learning gate: impressions >= 1000 AND spend >= 27,
    // and either have purchases (to skip the zero-conversion kill) so we
    // reach the CTR rule.
    const ad = makeAd({
      impressions: 2000,
      spend: 30,
      clicks: 5, // CTR = 0.25%
      purchases: 1,
      cpa: 30,
    });
    const result = classifyAdHealth(ad, makeBenchmarks());
    expect(result.status).toBe("kill");
    expect(result.reason).toMatch(/nobody is clicking/i);
  });

  it("returns kill for video ad with hook_rate = 0.10", () => {
    // Must pass learning gate, survive zero-conversion kill (has purchases),
    // have healthy CTR so the CTR rule doesn't trip, then hook rate fires.
    const ad = makeAd({
      impressions: 2000,
      spend: 30,
      clicks: 30, // 1.5% CTR
      purchases: 2,
      cpa: 15,
      hook_rate: 0.1,
      hold_rate: 0.4,
      video_3s_views: 200,
      video_thruplay: 80,
    });
    const result = classifyAdHealth(ad, makeBenchmarks());
    expect(result.status).toBe("kill");
    expect(result.reason).toMatch(/past 3 seconds/i);
  });

  it("returns underperforming for ad with 2 purchases and CPA $20", () => {
    const ad = makeAd({
      impressions: 5000,
      spend: 40,
      clicks: 60, // 1.2% CTR
      purchases: 2,
      cpa: 20,
    });
    const result = classifyAdHealth(ad, makeBenchmarks());
    expect(result.status).toBe("underperforming");
    expect(result.reason).toMatch(/\$14/);
  });

  it("returns watch when ad CPA is 2x its campaign CPA", () => {
    const ad = makeAd({
      impressions: 5000,
      spend: 40,
      clicks: 60, // 1.2% CTR - healthy
      purchases: 4,
      cpa: 10, // 2x the campaign CPA of $5
    });
    const benchmarks = makeBenchmarks({
      campaignCpas: new Map([["campaign_1", 5]]),
    });
    const result = classifyAdHealth(ad, benchmarks);
    expect(result.status).toBe("watch");
    expect(result.reason).toMatch(/dragging down/i);
  });

  it("returns watch when ad CTR is 0.5x account average", () => {
    const ad = makeAd({
      impressions: 5000,
      spend: 40,
      clicks: 30, // 0.6% CTR - healthy enough to pass kill (>0.5%)
      purchases: 4,
      cpa: 10,
    });
    // Account avg CTR = 1.2% → 70% threshold = 0.84%
    // Ad CTR 0.6% is under that so it's a watch
    const benchmarks = makeBenchmarks({ ctr: 0.012 });
    const result = classifyAdHealth(ad, benchmarks);
    expect(result.status).toBe("watch");
    expect(result.reason).toMatch(/engagement/i);
  });

  it("returns healthy for ad with all good metrics", () => {
    const ad = makeAd({
      impressions: 5000,
      spend: 40,
      clicks: 75, // 1.5% CTR
      purchases: 5,
      cpa: 8,
    });
    const benchmarks = makeBenchmarks({ ctr: 0.012 });
    const result = classifyAdHealth(ad, benchmarks);
    expect(result.status).toBe("healthy");
    expect(result.action).toMatch(/leave it running/i);
  });
});

