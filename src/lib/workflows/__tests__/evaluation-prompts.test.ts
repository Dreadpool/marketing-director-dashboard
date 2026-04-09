import { describe, it, expect } from "vitest";
import { getEvaluationPrompt } from "@/lib/workflows/prompts/meta-ads-evaluation";

describe("Evaluation prompts", () => {
  const stepIds = [
    "step1-decision-metrics",
    "d1-frequency",
    "d2-cpm-trend",
    "d3-ctr-trend",
    "d4-conversion-rate",
    "d5-pattern-match",
  ];

  for (const stepId of stepIds) {
    it(`has a prompt for ${stepId}`, () => {
      const prompt = getEvaluationPrompt(stepId);
      expect(prompt.length).toBeGreaterThan(100);
    });
  }

  it("step1 prompt contains correct CPA thresholds", () => {
    const prompt = getEvaluationPrompt("step1-decision-metrics");
    expect(prompt).toContain("$9");
    expect(prompt).toContain("$14");
    expect(prompt).toContain("$35.23");
    expect(prompt).toContain("1.3x");
    expect(prompt).toContain("3.0x");
    // Should NOT contain old wrong thresholds
    expect(prompt).not.toContain("$12");
    expect(prompt).not.toContain("$51");
    expect(prompt).not.toContain("6.9x");
  });

  it("d5 pattern match prompt contains all 5 diagnosis patterns", () => {
    const prompt = getEvaluationPrompt("d5-pattern-match");
    expect(prompt).toContain("Creative Fatigue");
    expect(prompt).toContain("Audience Saturation");
    expect(prompt).toContain("Landing Page Problem");
    expect(prompt).toContain("Growth Engine Broken");
    expect(prompt).toContain("Attribution Inflation");
  });

  it("action-producing prompts include ACTION/PRIORITY/OWNER format instructions", () => {
    // D1 is a data collection step only. Actions come from D5 pattern match
    // based on compound signals, so D1 is intentionally excluded here.
    const actionProducingStepIds = stepIds.filter((id) => id !== "d1-frequency");
    for (const stepId of actionProducingStepIds) {
      const prompt = getEvaluationPrompt(stepId);
      expect(prompt).toContain("ACTION:");
      expect(prompt).toContain("PRIORITY:");
      expect(prompt).toContain("OWNER:");
    }
  });

  it("d1-frequency is data collection only and does not produce action items", () => {
    const prompt = getEvaluationPrompt("d1-frequency");
    expect(prompt).not.toContain("ACTION:");
    expect(prompt).toContain("Do NOT");
    expect(prompt).toContain("D5");
  });

  it("returns a fallback prompt for unknown step IDs", () => {
    const prompt = getEvaluationPrompt("unknown-step");
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain("ACTION:");
  });
});
