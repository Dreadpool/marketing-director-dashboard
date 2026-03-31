import { describe, it, expect } from "vitest";
import { getWorkflowBySlug, workflows } from "@/lib/workflows";

describe("Workflow registry", () => {
  it("meta-ads-evaluation is not in the registry", () => {
    const wf = getWorkflowBySlug("meta-ads-evaluation");
    expect(wf).toBeUndefined();
  });

  it("meta-ads-analysis is active with steps", () => {
    const wf = getWorkflowBySlug("meta-ads-analysis");
    expect(wf).toBeDefined();
    expect(wf!.status).toBe("active");
    expect(wf!.steps.length).toBeGreaterThan(0);
  });

  it("active workflows have non-empty steps", () => {
    const active = workflows.filter((w) => w.status === "active");
    for (const wf of active) {
      expect(wf.steps.length).toBeGreaterThan(0);
    }
  });

  it("all workflows have unique slugs", () => {
    const slugs = workflows.map((w) => w.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
