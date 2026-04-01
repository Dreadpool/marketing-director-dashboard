import { describe, it, expect } from "vitest";
import type {
  CampaignSegment,
  CpaStatus,
  RoasStatus,
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
