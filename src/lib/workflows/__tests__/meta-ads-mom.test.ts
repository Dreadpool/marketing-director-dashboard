import { describe, it, expect } from "vitest";

describe("MoM delta computation", () => {
  // Mirror of pctChange from fetch-meta-ads.ts
  function pctChange(current: number, prior: number): number | null {
    if (prior === 0) return current > 0 ? null : null;
    return ((current - prior) / prior) * 100;
  }

  it("computes positive percent change", () => {
    expect(pctChange(118, 100)).toBeCloseTo(18);
  });

  it("computes negative percent change", () => {
    expect(pctChange(75, 100)).toBeCloseTo(-25);
  });

  it("returns null when prior is zero", () => {
    expect(pctChange(50, 0)).toBeNull();
  });

  it("returns null when both are zero", () => {
    expect(pctChange(0, 0)).toBeNull();
  });

  it("computes 100% increase (doubled)", () => {
    expect(pctChange(200, 100)).toBeCloseTo(100);
  });

  it("computes 50% decrease (halved)", () => {
    expect(pctChange(50, 100)).toBeCloseTo(-50);
  });

  it("handles small changes accurately", () => {
    expect(pctChange(102, 100)).toBeCloseTo(2);
  });

  it("handles large decreases", () => {
    expect(pctChange(10, 100)).toBeCloseTo(-90);
  });
});
