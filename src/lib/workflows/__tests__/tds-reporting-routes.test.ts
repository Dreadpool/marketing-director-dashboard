import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ init: vi.fn(), execute: vi.fn(), list: vi.fn(), details: vi.fn(), after: vi.fn() }));
vi.mock("../engine", () => ({ initWorkflowRun: mocks.init, executeWorkflowSteps: mocks.execute, getWorkflowRuns: mocks.list, getRunDetails: mocks.details }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", async (original) => ({ ...await original<object>(), after: mocks.after }));
import { POST } from "@/app/api/workflows/[slug]/run/route";
import { GET as runs } from "@/app/api/workflows/[slug]/runs/route";
import { GET as detail } from "@/app/api/workflows/[slug]/runs/[runId]/route";
import { POST as explore } from "@/app/api/interviews/explore/route";
import { POST as preview } from "@/app/api/interviews/wizard/preview/route";
import { MMC_REPORT_URL } from "../tds-reporting";
beforeEach(() => vi.resetAllMocks());
describe("retired reporting endpoints", () => {
  it.each(["monthly-analytics-review", "promo-code-analysis"])("blocks %s before starting or reading a workflow", async slug => {
    const context = { params: Promise.resolve({ slug }) };
    const launched = await POST(new Request("https://test/run", { method: "POST" }), context);
    expect(launched.status).toBe(410);
    expect(await launched.json()).toMatchObject({ url: MMC_REPORT_URL });
    expect((await runs(new Request("https://test/runs"), context)).status).toBe(410);
    expect(mocks.init).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.after).not.toHaveBeenCalled();
  });
  it("rejects a saved run requested through another workflow slug", async () => {
    mocks.details.mockResolvedValue({ workflowSlug: "google-ads-analysis", steps: [] });
    expect((await detail(new Request("https://test/run"), { params: Promise.resolve({ slug: "meta-ads-analysis", runId: "x" }) })).status).toBe(404);
  });
  it("keeps already-closed interview previews closed", async () => {
    expect((await explore()).status).toBe(410); expect((await preview()).status).toBe(410);
  });
});
