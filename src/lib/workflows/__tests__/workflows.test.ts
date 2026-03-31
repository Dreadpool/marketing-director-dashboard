import { describe, it, expect } from "vitest";
import { getWorkflowBySlug, workflows } from "@/lib/workflows";

describe("Workflow registry", () => {
  it("finds meta-ads-evaluation by slug", () => {
    const wf = getWorkflowBySlug("meta-ads-evaluation");
    expect(wf).toBeDefined();
    expect(wf!.workflowType).toBe("guided-evaluation");
    expect(wf!.status).toBe("active");
  });

  it("meta-ads-evaluation has empty steps array", () => {
    const wf = getWorkflowBySlug("meta-ads-evaluation");
    expect(wf!.steps).toEqual([]);
  });

  it("linear workflows have undefined or 'linear' workflowType", () => {
    const linear = workflows.filter(
      (w) => w.slug !== "meta-ads-evaluation",
    );
    for (const wf of linear) {
      expect(
        wf.workflowType === undefined || wf.workflowType === "linear",
      ).toBe(true);
    }
  });

  it("linear workflows with active status have non-empty steps", () => {
    const active = workflows.filter(
      (w) =>
        w.status === "active" &&
        (w.workflowType === undefined || w.workflowType === "linear"),
    );
    for (const wf of active) {
      expect(wf.steps.length).toBeGreaterThan(0);
    }
  });

  it("all workflows have unique slugs", () => {
    const slugs = workflows.map((w) => w.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
