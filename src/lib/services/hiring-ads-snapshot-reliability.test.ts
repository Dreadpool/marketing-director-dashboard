import { describe, expect, it, vi } from "vitest";

const metaHarness = vi.hoisted(() => ({
  active: 0,
  maxActive: 0,
  failures: new Set<string>(),
}));

async function trackedMetaCall(label: string): Promise<[]> {
  metaHarness.active += 1;
  metaHarness.maxActive = Math.max(metaHarness.maxActive, metaHarness.active);
  await new Promise((resolve) => setTimeout(resolve, 1));
  metaHarness.active -= 1;
  if (metaHarness.failures.has(label)) {
    throw new Error("The request was made but no response was received");
  }
  return [];
}

vi.mock("@/lib/services/meta-ads", () => ({
  getInsightsForDateRange: () => trackedMetaCall("campaign insights"),
  getAdSetInsightsForDateRange: () => trackedMetaCall("ad set insights"),
  getAdInsightsForDateRange: () => trackedMetaCall("ad insights"),
  getAdInventory: () => trackedMetaCall("ad inventory"),
}));

vi.mock("@/lib/services/google-ads", () => ({
  gaqlQuery: vi.fn().mockResolvedValue([]),
}));

vi.mock("node:child_process", () => {
  const customPromisify = Symbol.for("nodejs.util.promisify.custom");
  const execFile = Object.assign(vi.fn(), {
    [customPromisify]: async (_file: string, args: string[]) => {
      if (args[0] === "drive") {
        return {
          stdout: JSON.stringify({ modifiedTime: "2026-07-20T12:00:00.000Z" }),
          stderr: "",
        };
      }
      return {
        stdout: JSON.stringify({
          values: [[
            "Job title",
            "Status",
            "Cost",
            "Impressions",
            "Clicks",
            "Apply starts",
            "Applies",
            "Company name",
            "City",
            "State/Region",
          ]],
        }),
        stderr: "",
      };
    },
  });
  return { execFile };
});
import {
  collectHiringAdSnapshot,
  getBlockingHiringSourceFailures,
} from "@/lib/services/hiring-ads-snapshot";

describe("hiring ads snapshot source reliability", () => {
  it("runs all weekly and month-to-date Meta requests one at a time", async () => {
    metaHarness.active = 0;
    metaHarness.maxActive = 0;
    metaHarness.failures.clear();

    await collectHiringAdSnapshot({ now: new Date("2026-07-20T15:00:00.000Z") });

    expect(metaHarness.maxActive).toBe(1);
  });

  it("groups identical Meta failures once and names the failed requests", async () => {
    metaHarness.active = 0;
    metaHarness.maxActive = 0;
    metaHarness.failures.clear();
    metaHarness.failures.add("campaign insights");
    metaHarness.failures.add("ad set insights");
    metaHarness.failures.add("ad insights");

    const snapshot = await collectHiringAdSnapshot({
      now: new Date("2026-07-20T15:00:00.000Z"),
    });
    const metaFetches = snapshot.sourceFetches.filter((fetch) => fetch.source.startsWith("Meta Ads"));

    expect(metaFetches).toHaveLength(2);
    for (const fetch of metaFetches) {
      expect(fetch.message).toContain("campaign insights, ad set insights, ad insights");
      expect(fetch.message?.match(/no response was received/g)).toHaveLength(1);
    }
  });

  it("blocks incomplete platform data but allows an Indeed freshness warning", () => {
    const fetchedAt = "2026-07-20T15:00:00.000Z";
    const failures = getBlockingHiringSourceFailures([
      { source: "Meta Ads", status: "warning", fetchedAt, message: "ad insights failed" },
      { source: "Google Ads MTD", status: "error", fetchedAt, message: "query failed" },
      { source: "Indeed sheet", status: "warning", fetchedAt, message: "sheet is stale" },
      { source: "GA4 diagnostics", status: "skipped", fetchedAt },
    ]);

    expect(failures.map((failure) => failure.source)).toEqual([
      "Meta Ads",
      "Google Ads MTD",
    ]);
  });
});
