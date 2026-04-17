import { describe, it, expect } from "vitest";
import { flagAdSets } from "../classifiers/meta-ads-adset-flags";
import type {
  MetaAdsAdSetRow,
  MetaAdsCampaignRow,
} from "@/lib/schemas/sources/meta-ads-metrics";

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

function makeCampaign(
  overrides: Partial<MetaAdsCampaignRow> & { campaign_id: string },
): MetaAdsCampaignRow {
  return {
    campaign_name: "Test Campaign",
    objective: "CONVERSIONS",
    status: "ACTIVE",
    funnel_stage: "tof",
    spend: 1000,
    impressions: 20000,
    reach: 10000,
    clicks: 200,
    frequency: 2,
    cpm: 50,
    ctr: 1,
    purchases: 20,
    attributed_revenue: 1000,
    cpa: 50,
    roas: 1,
    ...overrides,
  };
}

describe("flagAdSets", () => {
  describe("Flag 1: CTR below campaign peers", () => {
    it("flags ad set with CTR 25%+ below campaign median", () => {
      const adsets = [
        makeAdSet({ adset_id: "a1", campaign_id: "c1", clicks: 120, impressions: 10000 }), // 1.2% CTR
        makeAdSet({ adset_id: "a2", campaign_id: "c1", clicks: 100, impressions: 10000 }), // 1.0% CTR (median)
        makeAdSet({ adset_id: "a3", campaign_id: "c1", clicks: 50, impressions: 10000 }),  // 0.5% CTR → 50% below median
      ];
      const campaigns = [makeCampaign({ campaign_id: "c1" })];

      const flags = flagAdSets(adsets, campaigns);

      expect(flags.has("a3")).toBe(true);
      expect(flags.get("a3")![0].type).toBe("ctr_below_peers");
      expect(flags.has("a1")).toBe(false);
      expect(flags.has("a2")).toBe(false);
    });

    it("does not flag when CTR is within 25% of median", () => {
      const adsets = [
        makeAdSet({ adset_id: "a1", campaign_id: "c1", clicks: 100, impressions: 10000 }), // 1.0%
        makeAdSet({ adset_id: "a2", campaign_id: "c1", clicks: 80, impressions: 10000 }),  // 0.8% → 20% below, under threshold
      ];
      const campaigns = [makeCampaign({ campaign_id: "c1" })];

      const flags = flagAdSets(adsets, campaigns);

      expect(flags.has("a2")).toBe(false);
    });

    it("does not flag when campaign has only 1 ad set", () => {
      const adsets = [
        makeAdSet({ adset_id: "a1", campaign_id: "c1", clicks: 10, impressions: 10000 }), // terrible CTR
      ];
      const campaigns = [makeCampaign({ campaign_id: "c1" })];

      const flags = flagAdSets(adsets, campaigns);

      expect(flags.has("a1")).toBe(false);
    });

    it("compares within campaign, not across campaigns", () => {
      const adsets = [
        // Campaign 1: both ad sets have ~1% CTR
        makeAdSet({ adset_id: "a1", campaign_id: "c1", clicks: 100, impressions: 10000 }),
        makeAdSet({ adset_id: "a2", campaign_id: "c1", clicks: 110, impressions: 10000 }),
        // Campaign 2: one ad set has very low CTR
        makeAdSet({ adset_id: "a3", campaign_id: "c2", clicks: 100, impressions: 10000 }),
        makeAdSet({ adset_id: "a4", campaign_id: "c2", clicks: 30, impressions: 10000 }),
      ];
      const campaigns = [
        makeCampaign({ campaign_id: "c1" }),
        makeCampaign({ campaign_id: "c2" }),
      ];

      const flags = flagAdSets(adsets, campaigns);

      // c1 ad sets should not be flagged (close CTRs)
      expect(flags.has("a1")).toBe(false);
      expect(flags.has("a2")).toBe(false);
      // c2 a4 should be flagged (70% below median)
      expect(flags.has("a4")).toBe(true);
      expect(flags.get("a4")![0].type).toBe("ctr_below_peers");
    });
  });

  describe("Flag 2: CPA increasing", () => {
    it("flags ad set with CPA up 25%+ MoM", () => {
      const adsets = [
        makeAdSet({
          adset_id: "a1",
          campaign_id: "c1",
          mom: { spend_pct: 10, cpa_pct: 30, roas_pct: -20, purchases_pct: -10 },
        }),
      ];
      const campaigns = [makeCampaign({ campaign_id: "c1" })];

      const flags = flagAdSets(adsets, campaigns);

      expect(flags.has("a1")).toBe(true);
      expect(flags.get("a1")![0].type).toBe("cpa_increasing");
    });

    it("does not flag when CPA increase is under 25%", () => {
      const adsets = [
        makeAdSet({
          adset_id: "a1",
          campaign_id: "c1",
          mom: { spend_pct: 10, cpa_pct: 20, roas_pct: -10, purchases_pct: -5 },
        }),
      ];
      const campaigns = [makeCampaign({ campaign_id: "c1" })];

      const flags = flagAdSets(adsets, campaigns);

      expect(flags.has("a1")).toBe(false);
    });

    it("suppresses CPA flag when campaign CPA also rose 25%+", () => {
      const adsets = [
        makeAdSet({
          adset_id: "a1",
          campaign_id: "c1",
          mom: { spend_pct: 10, cpa_pct: 40, roas_pct: -30, purchases_pct: -20 },
        }),
      ];
      const campaigns = [
        makeCampaign({
          campaign_id: "c1",
          mom: { spend_pct: 10, cpa_pct: 35, roas_pct: -25, purchases_pct: -15 },
        }),
      ];

      const flags = flagAdSets(adsets, campaigns);

      expect(flags.has("a1")).toBe(false);
    });

    it("does not suppress CPA flag when campaign CPA rose less than 25%", () => {
      const adsets = [
        makeAdSet({
          adset_id: "a1",
          campaign_id: "c1",
          mom: { spend_pct: 10, cpa_pct: 40, roas_pct: -30, purchases_pct: -20 },
        }),
      ];
      const campaigns = [
        makeCampaign({
          campaign_id: "c1",
          mom: { spend_pct: 10, cpa_pct: 15, roas_pct: -10, purchases_pct: -5 },
        }),
      ];

      const flags = flagAdSets(adsets, campaigns);

      expect(flags.has("a1")).toBe(true);
    });

    it("does not flag when no MoM data", () => {
      const adsets = [
        makeAdSet({ adset_id: "a1", campaign_id: "c1" }), // no mom field
      ];
      const campaigns = [makeCampaign({ campaign_id: "c1" })];

      const flags = flagAdSets(adsets, campaigns);

      expect(flags.has("a1")).toBe(false);
    });
  });

  describe("both flags", () => {
    it("can fire both flags on the same ad set", () => {
      const adsets = [
        makeAdSet({
          adset_id: "a1",
          campaign_id: "c1",
          clicks: 100,
          impressions: 10000,
          mom: { spend_pct: 10, cpa_pct: 50, roas_pct: -30, purchases_pct: -20 },
        }),
        makeAdSet({
          adset_id: "a2",
          campaign_id: "c1",
          clicks: 30,
          impressions: 10000, // 0.3% CTR, well below median
          mom: { spend_pct: 10, cpa_pct: 40, roas_pct: -30, purchases_pct: -20 },
        }),
      ];
      const campaigns = [makeCampaign({ campaign_id: "c1" })];

      const flags = flagAdSets(adsets, campaigns);

      expect(flags.has("a2")).toBe(true);
      const a2Flags = flags.get("a2")!;
      expect(a2Flags).toHaveLength(2);
      expect(a2Flags.map((f) => f.type)).toContain("ctr_below_peers");
      expect(a2Flags.map((f) => f.type)).toContain("cpa_increasing");
    });
  });
});
