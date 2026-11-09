import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  executor: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  set: vi.fn(),
  values: vi.fn(),
}));
vi.mock("@/db", () => ({ db: { select: mocks.select, update: mocks.update, insert: mocks.insert, delete: mocks.remove } }));
vi.mock("../executors", () => ({ getExecutor: () => mocks.executor }));
import { executeWorkflowSteps, initWorkflowRun, getRunDetails } from "../engine";
import { workflows } from "@/lib/workflows";
import { actionItems } from "@/db/schema";

beforeEach(() => {
  vi.resetAllMocks();
  const result = [{ inputParams: null }, { id: "step-1", stepId: "fetch", status: "completed" }];
  mocks.select.mockImplementation(() => ({ from: () => ({ where: () => Object.assign(Promise.resolve(result), { orderBy: () => Promise.resolve(result) }) }) }));
  mocks.set.mockReturnValue({ where: () => Promise.resolve() });
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.values.mockResolvedValue([]);
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.remove.mockReturnValue({ where: () => Promise.resolve() });
});
describe("data-only execution", () => {
  it("retrieves sources on every explicit run without reading the period cache or generating actions", async () => {
    mocks.executor.mockResolvedValue({ metadata: { missing_sources: [] }, metric: 123 });
    await executeWorkflowSteps("run-1", "meta-ads-analysis", { year: 2026, month: 10 });
    await executeWorkflowSteps("run-2", "meta-ads-analysis", { year: 2026, month: 10 });
    expect(mocks.executor).toHaveBeenCalledTimes(2);
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", outputData: expect.objectContaining({ metric: 123, dataRetrievedAt: expect.any(String) }) }));
    expect(mocks.insert).not.toHaveBeenCalledWith(actionItems);
  });
  it("marks a failed source fetch and does not create a data snapshot", async () => {
    mocks.executor.mockRejectedValue(new Error("Meta unavailable"));
    await executeWorkflowSteps("run-1", "meta-ads-analysis", { year: 2026, month: 10 });
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", error: "Meta unavailable" }));
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("has no model analysis or recommendation steps in reporting workflows", () => {
    for (const workflow of workflows.filter((w) => w.steps.some((s) => s.type === "fetch"))) {
      expect(workflow.steps.map((s) => s.type)).toEqual(["fetch"]);
    }
  });
});

describe("retired TDS reporting", () => {
  it.each(["monthly-analytics-review", "promo-code-analysis"])("blocks %s initialization and delayed execution before IO", async slug => {
    await expect(initWorkflowRun(slug, { year: 2026, month: 10 })).rejects.toThrow();
    await expect(executeWorkflowSteps("old-run", slug, { year: 2026, month: 10 })).rejects.toThrow();
    expect(mocks.executor).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("suppresses a saved report by stored slug before loading private step outputs", async () => {
    mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ id: "retired-run", workflowSlug: "monthly-analytics-review" }] }) }) });
    expect(await getRunDetails("retired-run")).toBeNull();
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});
