import { describe, it, expect } from "vitest";
import type {
  CampaignSegment,
  CpaStatus,
  RoasStatus,
  GoogleAdsSegmentTrend,
} from "@/lib/schemas/sources/google-ads-metrics";
import {
  classifySegment,
  getCpaStatus,
  getRoasStatus,
  GOOGLE_ADS_THRESHOLDS,
} from "@/lib/workflows/executors/fetch-google-ads";

describe("Google Ads metrics types", () => {
  it("CampaignSegment covers all SLE campaign types", () => {
    const segments: CampaignSegment[] = [
      "brand", "non-brand", "competitor", "pmax", "video", "other",
    ];
    expect(segments).toHaveLength(6);
  });

  it("CpaStatus matches SLE thresholds", () => {
    const statuses: CpaStatus[] = ["on-target", "elevated", "high"];
    expect(statuses).toHaveLength(3);
  });

  it("RoasStatus includes watch tier", () => {
    const statuses: RoasStatus[] = ["above-target", "watch", "below-target"];
    expect(statuses).toHaveLength(3);
  });

  it("GoogleAdsSegmentTrend has required fields", () => {
    const trend: GoogleAdsSegmentTrend = {
      segment: "non-brand",
      cpa: { current: 6, prior_month: 5, prior_year: 7, mom_change: 0.2, yoy_change: -0.14 },
      avg_cpc: { current: 1.89, prior_month: 1.80, prior_year: 1.85, mom_change: 0.05, yoy_change: 0.02 },
      cvr: { current: 0.032, prior_month: 0.035, prior_year: 0.041, mom_change: -0.086, yoy_change: -0.22 },
      conversions: { current: 572, prior_month: 620, prior_year: 650, mom_change: -0.077, yoy_change: -0.12 },
    };
    expect(trend.segment).toBe("non-brand");
    expect(trend.cpa.current).toBe(6);
    expect(trend.cvr.yoy_change).toBe(-0.22);
  });
});

describe("GOOGLE_ADS_THRESHOLDS", () => {
  it("matches SLE unit economics", () => {
    expect(GOOGLE_ADS_THRESHOLDS.cpa_on_target).toBe(9);
    expect(GOOGLE_ADS_THRESHOLDS.cpa_elevated).toBe(14);
    expect(GOOGLE_ADS_THRESHOLDS.roas_floor).toBe(3.0);
    expect(GOOGLE_ADS_THRESHOLDS.gp_per_order).toBe(35.23);
    expect(GOOGLE_ADS_THRESHOLDS.gross_margin).toBe(0.43);
    expect(GOOGLE_ADS_THRESHOLDS.over_attribution).toBe(1.3);
  });
});

describe("classifySegment", () => {
  it("classifies brand campaigns", () => {
    expect(classifySegment("SLE | Search | Brand")).toBe("brand");
  });

  it("classifies non-brand campaigns", () => {
    expect(classifySegment("SLE | Search | Non-Branded")).toBe("non-brand");
    expect(classifySegment("STGEO | Search | Non-Branded")).toBe("non-brand");
    expect(classifySegment("NWS | Search | Non-Branded")).toBe("non-brand");
    expect(classifySegment("SLE Charters")).toBe("non-brand");
  });

  it("classifies competitor campaigns", () => {
    expect(classifySegment("SLE | Search | Competitors")).toBe("competitor");
  });

  it("classifies PMax campaigns", () => {
    expect(classifySegment("Charters - P-Max")).toBe("pmax");
    expect(classifySegment("SLE - Performance Max")).toBe("pmax");
  });

  it("classifies video campaigns", () => {
    expect(classifySegment("GMA | Video Remarketing")).toBe("video");
    expect(classifySegment("SLE | Video | Brand")).toBe("video");
  });

  it("falls back to other for unknown patterns", () => {
    expect(classifySegment("Unknown Campaign Name")).toBe("other");
  });
});

describe("getCpaStatus", () => {
  it("returns on-target for CPA <= $9", () => {
    expect(getCpaStatus(5)).toBe("on-target");
    expect(getCpaStatus(9)).toBe("on-target");
  });

  it("returns elevated for CPA $9-$14", () => {
    expect(getCpaStatus(9.01)).toBe("elevated");
    expect(getCpaStatus(14)).toBe("elevated");
  });

  it("returns high for CPA > $14", () => {
    expect(getCpaStatus(14.01)).toBe("high");
    expect(getCpaStatus(50)).toBe("high");
  });
});

describe("getRoasStatus", () => {
  it("returns above-target for ROAS >= 3.0x", () => {
    expect(getRoasStatus(3.0)).toBe("above-target");
    expect(getRoasStatus(5.0)).toBe("above-target");
  });

  it("returns watch for ROAS 2.0x-3.0x", () => {
    expect(getRoasStatus(2.0)).toBe("watch");
    expect(getRoasStatus(2.99)).toBe("watch");
  });

  it("returns below-target for ROAS < 2.0x", () => {
    expect(getRoasStatus(1.99)).toBe("below-target");
    expect(getRoasStatus(0)).toBe("below-target");
  });
});

import { isGoogleAdsMetrics } from "@/components/workflows/google-ads-fetch-summary";

describe("isGoogleAdsMetrics type guard", () => {
  it("returns true for valid GoogleAdsMetrics data", () => {
    const data = {
      account_health: {},
      campaigns: [],
      ground_truth: {},
      segment_trends: [],
      metadata: {},
    };
    expect(isGoogleAdsMetrics(data)).toBe(true);
  });

  it("returns false for Meta Ads data (has signals, no ground_truth)", () => {
    const data = {
      account_health: {},
      campaigns: [],
      metadata: {},
      signals: {},
      audience: {},
    };
    expect(isGoogleAdsMetrics(data)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isGoogleAdsMetrics(null)).toBe(false);
  });

  it("returns false for string", () => {
    expect(isGoogleAdsMetrics("hello")).toBe(false);
  });
});

import { googleAdsPrompts } from "@/lib/workflows/prompts/google-ads";
import { getExecutor } from "@/lib/workflows/executors/index";
import { getDefaultPrompt } from "@/lib/workflows/prompts/index";
import { getWorkflowBySlug } from "@/lib/workflows";

describe("Google Ads prompts", () => {
  it("has analyze and recommend prompts", () => {
    expect(googleAdsPrompts.analyze).toBeDefined();
    expect(googleAdsPrompts.recommend).toBeDefined();
  });

  it("analyze prompt contains SLE unit economics", () => {
    const p = googleAdsPrompts.analyze;
    expect(p).toContain("$9");
    expect(p).toContain("$14");
    expect(p).toContain("$35.23");
    expect(p).toContain("1.3x");
    expect(p).toContain("3.0x");
  });

  it("analyze prompt references brand vs non-brand segmentation", () => {
    const p = googleAdsPrompts.analyze;
    expect(p).toContain("brand");
    expect(p).toContain("non-brand");
  });

  it("analyze prompt references ground truth comparison", () => {
    const p = googleAdsPrompts.analyze;
    expect(p).toContain("BigQuery");
    expect(p).toContain("ground truth");
  });

  it("recommend prompt uses ACTION/PRIORITY/CATEGORY format", () => {
    const p = googleAdsPrompts.recommend;
    expect(p).toContain("ACTION:");
    expect(p).toContain("PRIORITY:");
    expect(p).toContain("CATEGORY:");
  });

  it("prompts are substantial (>100 chars each)", () => {
    expect(googleAdsPrompts.analyze.length).toBeGreaterThan(100);
    expect(googleAdsPrompts.recommend.length).toBeGreaterThan(100);
  });
});

describe("Google Ads workflow registration", () => {
  it("executor is registered", () => {
    const executor = getExecutor("google-ads-analysis");
    expect(executor).toBeDefined();
    expect(typeof executor).toBe("function");
  });

  it("analyze prompt is registered", () => {
    const prompt = getDefaultPrompt("google-ads-analysis", "analyze");
    expect(prompt).not.toBeNull();
    expect(prompt!.length).toBeGreaterThan(100);
  });

  it("recommend prompt is registered", () => {
    const prompt = getDefaultPrompt("google-ads-analysis", "recommend");
    expect(prompt).not.toBeNull();
    expect(prompt!.length).toBeGreaterThan(100);
  });

  it("workflow is active", () => {
    const wf = getWorkflowBySlug("google-ads-analysis");
    expect(wf).toBeDefined();
    expect(wf!.status).toBe("active");
  });
});
