import { describe, it, expect } from "vitest";
import {
  META_ADS_EVALUATION_STEPS,
  DIAGNOSTIC_THRESHOLDS,
  resolveActiveSteps,
  getStepDef,
  getMainSpineSteps,
  getDiagnosticSteps,
} from "@/lib/workflows/evaluations/meta-ads-monthly";

describe("Diagnostic thresholds", () => {
  it("contains behavior diagnostics but no retired unit economics", () => {
    expect(DIAGNOSTIC_THRESHOLDS.frequency_fatigue).toBe(3);
    expect(DIAGNOSTIC_THRESHOLDS.cpm_mom_increase).toBe(0.3);
    expect(DIAGNOSTIC_THRESHOLDS.ctr_mom_decrease).toBe(0.2);
    expect(DIAGNOSTIC_THRESHOLDS).not.toHaveProperty("cpa_on_target");
    expect(DIAGNOSTIC_THRESHOLDS).not.toHaveProperty("gp_per_order");
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

  it("diagnostic steps D1-D5 remain available without a profit threshold", () => {
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
      expect(step!.condition.type).toBe("always");
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
  it("includes diagnostics regardless of retired CPA status", () => {
    const steps = resolveActiveSteps(false);
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

  it("ignores the legacy CPA branch input", () => {
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
