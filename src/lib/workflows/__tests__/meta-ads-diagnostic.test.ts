import { describe, it, expect } from "vitest";
import { diagnoseAdSet } from "../classifiers/meta-ads-diagnostic";
import type { MetaAdsAdSetRow } from "@/lib/schemas/sources/meta-ads-metrics";

function makeAdSet(
  overrides: Partial<MetaAdsAdSetRow> & { adset_id: string; campaign_id: string },
): MetaAdsAdSetRow {
  return {
    adset_name: "Test Ad Set",
    spend: 500,
    impressions: 10000,
    reach: 5000,
    clicks: 100,
    frequency: 2,
    purchases: 10,
    attributed_revenue: 500,
    cpa: 50,
    roas: 1,
    ...overrides,
  };
}

describe("diagnoseAdSet", () => {
  const peers = [
    makeAdSet({ adset_id: "a1", campaign_id: "c1", clicks: 120, impressions: 10000, frequency: 2 }),
    makeAdSet({ adset_id: "a2", campaign_id: "c1", clicks: 100, impressions: 10000, frequency: 2.5 }),
    makeAdSet({ adset_id: "a3", campaign_id: "c1", clicks: 50, impressions: 10000, frequency: 2 }),
  ];

  it("diagnoses exhaustion: low CTR + high frequency", () => {
    const adset = makeAdSet({
      adset_id: "a3",
      campaign_id: "c1",
      clicks: 50,
      impressions: 10000,
      frequency: 4.5,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.scenario).toBe("exhaustion");
    expect(result.action).toContain("Refresh");
  });

  it("diagnoses audience/creative: low CTR + low frequency", () => {
    const adset = makeAdSet({
      adset_id: "a3",
      campaign_id: "c1",
      clicks: 50,
      impressions: 10000,
      frequency: 1.5,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.scenario).toBe("audience_or_creative");
  });

  it("diagnoses post-click: good CTR + low conversions", () => {
    const adset = makeAdSet({
      adset_id: "a1",
      campaign_id: "c1",
      clicks: 120,
      impressions: 10000,
      frequency: 2,
      purchases: 0,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.scenario).toBe("post_click");
    expect(result.action).toContain("landing page");
  });

  it("diagnoses auction competition: rising CPA + good CTR", () => {
    const adset = makeAdSet({
      adset_id: "a1",
      campaign_id: "c1",
      clicks: 120,
      impressions: 10000,
      frequency: 2,
      purchases: 10,
      mom: { spend_pct: 5, cpa_pct: 40, roas_pct: -30, purchases_pct: -10 },
    });
    const result = diagnoseAdSet(adset, peers, { campaignCpaPct: 5 });
    expect(result.scenario).toBe("auction_competition");
  });

  it("includes median CTR in diagnosis text", () => {
    const adset = makeAdSet({
      adset_id: "a3",
      campaign_id: "c1",
      clicks: 50,
      impressions: 10000,
      frequency: 4.5,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.diagnosis).toContain("campaign median");
  });

  it("returns context values", () => {
    const adset = makeAdSet({
      adset_id: "a3",
      campaign_id: "c1",
      clicks: 50,
      impressions: 10000,
      frequency: 4.5,
      spend: 950,
    });
    const result = diagnoseAdSet(adset, peers);
    expect(result.context.frequency).toBe(4.5);
    expect(result.context.spend).toBe(950);
  });
});
