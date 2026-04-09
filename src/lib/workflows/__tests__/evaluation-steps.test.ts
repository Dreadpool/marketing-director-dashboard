import { describe, it, expect } from "vitest";
import {
  META_ADS_EVALUATION_STEPS,
  SLE_THRESHOLDS,
  resolveActiveSteps,
  getStepDef,
  getMainSpineSteps,
  getDiagnosticSteps,
} from "@/lib/workflows/evaluations/meta-ads-monthly";

describe("SLE Thresholds", () => {
  it("CPA on-target threshold is $9", () => {
    expect(SLE_THRESHOLDS.cpa_on_target).toBe(9);
  });

  it("CPA elevated threshold is $14", () => {
    expect(SLE_THRESHOLDS.cpa_elevated).toBe(14);
  });

  it("ROAS floor is 3.0x", () => {
    expect(SLE_THRESHOLDS.roas_floor).toBe(3.0);
  });

  it("over-attribution factor is 1.3x", () => {
    expect(SLE_THRESHOLDS.over_attribution).toBe(1.3);
  });

  it("gross margin is 43%", () => {
    expect(SLE_THRESHOLDS.gross_margin).toBe(0.43);
  });

  it("GP per order is $35.23", () => {
    expect(SLE_THRESHOLDS.gp_per_order).toBe(35.23);
  });

  it("CPA target derives correctly from unit economics", () => {
    // $35.23 GP / 3 (3:1 ratio) / 1.3 (over-attribution) = $9.03
    const derivedCpa =
      SLE_THRESHOLDS.gp_per_order /
      3 /
      SLE_THRESHOLDS.over_attribution;
    expect(Math.round(derivedCpa)).toBe(SLE_THRESHOLDS.cpa_on_target);
  });
});

describe("Evaluation step definitions", () => {
  it("has 11 total steps (1 spine + 5 diagnostic + 4 placeholder + 1 summary)", () => {
    expect(META_ADS_EVALUATION_STEPS.length).toBe(11);
  });

  it("Step 1 (decision-metrics) is always active", () => {
    const step = getStepDef("step1-decision-metrics");
    expect(step).toBeDefined();
    expect(step!.condition.type).toBe("always");
    expect(step!.spineStep).toBe(1);
  });

  it("Step 4 (creative-health) is always active", () => {
    const step = getStepDef("step4-creative-health");
    expect(step).toBeDefined();
    expect(step!.condition.type).toBe("always");
    expect(step!.spineStep).toBe(4);
  });

  it("Step 6 (action-summary) is always active", () => {
    const step = getStepDef("step6-action-summary");
    expect(step).toBeDefined();
    expect(step!.condition.type).toBe("always");
    expect(step!.spineStep).toBe(6);
  });

  it("diagnostic steps D1-D5 are conditional on CPA off-target", () => {
    const diagnosticIds = [
      "d1-frequency",
      "d2-cpm-trend",
      "d3-ctr-trend",
      "d4-conversion-rate",
      "d5-pattern-match",
    ];
    for (const id of diagnosticIds) {
      const step = getStepDef(id);
      expect(step).toBeDefined();
      expect(step!.condition.type).toBe("cpa-off-target");
      expect(step!.spineStep).toBeNull();
      expect(step!.parentStepId).toBe("step1-decision-metrics");
    }
  });

  it("Steps 2, 3, and 5 are phase2 placeholders", () => {
    const placeholderIds = [
      "step2-backend-verification",
      "step3-campaign-structure",
      "step5-audience-check",
    ];
    for (const id of placeholderIds) {
      const step = getStepDef(id);
      expect(step).toBeDefined();
      expect(step!.condition.type).toBe("phase2-placeholder");
    }
  });

  it("steps are ordered sequentially by the order field", () => {
    const orders = META_ADS_EVALUATION_STEPS.map((s) => s.order);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThan(orders[i - 1]);
    }
  });
});

describe("resolveActiveSteps", () => {
  it("healthy account gets Step 1 + Step 4 + Step 6 (skip diagnostics and remaining placeholders)", () => {
    const steps = resolveActiveSteps(false);
    expect(steps).toEqual([
      "step1-decision-metrics",
      "step4-creative-health",
      "step6-action-summary",
    ]);
  });

  it("unhealthy CPA gets Step 1 + D1-D5 + Step 4 + Step 6", () => {
    const steps = resolveActiveSteps(true);
    expect(steps).toEqual([
      "step1-decision-metrics",
      "d1-frequency",
      "d2-cpm-trend",
      "d3-ctr-trend",
      "d4-conversion-rate",
      "d5-pattern-match",
      "step4-creative-health",
      "step6-action-summary",
    ]);
  });

  it("phase2 placeholders are never included", () => {
    const healthySteps = resolveActiveSteps(false);
    const unhealthySteps = resolveActiveSteps(true);
    const placeholders = [
      "step2-backend-verification",
      "step3-campaign-structure",
      "step5-audience-check",
    ];
    for (const id of placeholders) {
      expect(healthySteps).not.toContain(id);
      expect(unhealthySteps).not.toContain(id);
    }
  });
});

describe("step helper functions", () => {
  it("getMainSpineSteps returns 6 spine steps", () => {
    const spine = getMainSpineSteps();
    expect(spine.length).toBe(6);
    expect(spine.map((s) => s.spineStep)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("getDiagnosticSteps returns 5 diagnostic steps", () => {
    const diag = getDiagnosticSteps();
    expect(diag.length).toBe(5);
    expect(diag.every((s) => s.spineStep === null)).toBe(true);
  });

  it("getStepDef returns undefined for unknown step", () => {
    expect(getStepDef("nonexistent")).toBeUndefined();
  });
});
