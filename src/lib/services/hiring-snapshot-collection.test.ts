import { beforeEach, describe, expect, it, vi } from "vitest";
const harness = vi.hoisted(() => ({
  values: [] as string[][],
  metaAds: [] as Record<string, unknown>[],
  metaInventory: [] as Record<string, unknown>[],
  metaParents: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/services/meta-ads", () => ({
  getInsightsForDateRange: async () => harness.metaParents,
  getAdSetInsightsForDateRange: async () => [],
  getAdInsightsForDateRange: async () => harness.metaAds,
  getAdInventory: async () => harness.metaInventory,
}));
vi.mock("@/lib/services/google-ads", () => ({ gaqlQuery: vi.fn() }));
vi.mock("node:child_process", () => ({
  execFile: Object.assign(vi.fn(), {
    [Symbol.for("nodejs.util.promisify.custom")]: async (
      _file: string,
      args: string[],
    ) => ({
      stdout: JSON.stringify(
        args[0] === "drive"
          ? { modifiedTime: new Date().toISOString() }
          : { values: harness.values },
      ),
      stderr: "",
    }),
  }),
}));
import { gaqlQuery } from "./google-ads";
import {
  __hiringAdsSnapshotTest,
  getBlockingHiringSourceFailures,
} from "./hiring-ads-snapshot";
const query = vi.mocked(gaqlQuery);
const period = { start: "2026-08-31", end: "2026-09-06" };
const campaigns = [
  {
    campaign: {
      id: "23506774948",
      name: "S | Hiring | UT/ID",
      status: "ENABLED",
      geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE" },
    },
  },
  {
    campaign: {
      id: "24043574614",
      name: "S | Hiring | WASH",
      status: "ENABLED",
      geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE" },
    },
  },
];
const inventory = [
  ["195277974653", "St. George", 0, "PAUSED"],
  ["195319893794", "Pocatello", 0, "PAUSED"],
  ["197915916605", "Salt Lake City", 0, "ENABLED"],
  ["199165553660", "Spokane", 1, "ENABLED"],
  ["199165553700", "Omak", 1, "PAUSED"],
  ["100", "Mechanic", 0, "ENABLED"],
].map(([id, name, campaign, status]) => ({
  ...campaigns[Number(campaign)],
  adGroup: { id, name, status },
}));
const performance = [inventory[2], inventory[3], inventory[5]].map((r) => ({
  ...r,
  metrics: { costMicros: "1000000", clicks: "1", impressions: "10" },
}));
const campaignPerformance = campaigns.map((r, i) => ({
  ...r,
  metrics: {
    costMicros: i === 0 ? "2000000" : "1000000",
    clicks: i === 0 ? "2" : "1",
    impressions: i === 0 ? "20" : "10",
  },
}));
function answer(q: string): Record<string, unknown>[] {
  if (q.includes("FROM customer"))
    return [
      {
        customer: {
          id: "7716669181",
          currencyCode: "USD",
          timeZone: "America/Denver",
        },
      },
    ];
  if (q.includes("FROM campaign WHERE"))
    return q.includes("metrics.") ? campaignPerformance : campaigns;
  if (q.includes("FROM ad_group WHERE"))
    return q.includes("metrics.") ? performance : inventory;
  return [];
}
beforeEach(() => {
  query.mockReset().mockImplementation(async (q) => answer(q));
});

describe("Google collector and send gate", () => {
  it("reconciles actual IDs, accounts for excluded spend, and queries radius settings", async () => {
    const result = await __hiringAdsSnapshotTest.fetchGoogleRecords(period);
    expect(result.fetch.status).toBe("ok");
    expect(result.records).toHaveLength(5);
    expect(result.audit?.campaignSpend).toBe(3);
    expect(result.audit?.reportedSpend).toBe(2);
    expect(result.audit?.excluded[0]).toMatchObject({
      adGroup: "Mechanic",
      spend: 1,
    });
    expect(
      query.mock.calls.some(
        ([q]) =>
          q.includes("campaign_criterion.type IN ('LOCATION','PROXIMITY')") &&
          q.includes("latitude_in_micro_degrees"),
      ),
    ).toBe(true);
    const metricsQueries = query.mock.calls.filter(([q]) =>
      q.includes("metrics."),
    );
    expect(
      metricsQueries.every(([q]) =>
        q.includes("BETWEEN '2026-08-31' AND '2026-09-06'"),
      ),
    ).toBe(true);
  });
  it.each(["account", "campaign", "group", "metrics", "partial response"])(
    "blocks a report with incomplete or wrong %s",
    async (failure) => {
      query.mockImplementation(async (q) => {
        if (failure === "account" && q.includes("FROM customer"))
          return [{ customer: { id: "wrong" } }];
        if (
          failure === "campaign" &&
          q.includes("FROM campaign WHERE") &&
          !q.includes("metrics.")
        )
          return [];
        if (
          failure === "group" &&
          q.includes("FROM ad_group WHERE") &&
          !q.includes("metrics.")
        )
          return inventory.slice(1);
        if (
          failure === "metrics" &&
          q.includes("FROM ad_group WHERE") &&
          q.includes("metrics.")
        )
          return [];
        if (
          failure === "partial response" &&
          q.includes("FROM campaign_criterion")
        )
          throw new Error("Page failed");
        return answer(q);
      });
      const result = await __hiringAdsSnapshotTest.fetchGoogleRecords(period);
      expect(result.fetch.status).toBe("error");
      expect(result.records).toEqual([]);
      expect(getBlockingHiringSourceFailures([result.fetch])).toHaveLength(1);
    },
  );
});

describe("Indeed source parsing", () => {
  it("keeps source labels, unknown status, blank city, and rows past 200 without merging Google markets", async () => {
    harness.values = [
      [
        "Source",
        "Job Type",
        "Job",
        "Job status",
        "City",
        "State/Region",
        "Company name",
        "Spend",
        "Impressions",
        "Clicks",
        "Apply starts",
        "Applies",
      ],
      ["Indeed", "Driver", "CDL driver", "", "BOI", "", "", "", "", "", "", ""],
      ...Array.from({ length: 200 }, () => [] as string[]),
      [
        " Indeed ",
        "Driver",
        "CDL driver",
        " closed ",
        "",
        "",
        "NWL",
        "0",
        "0",
        "0",
        "0",
        "0",
      ],
    ];
    const result = await __hiringAdsSnapshotTest.fetchIndeedRows(period);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      market: "BOI",
      status: "Needs review",
      spend: null,
      applications: null,
    });
    expect(result.rows[1]).toMatchObject({
      market: "Location not entered",
      company: "NWL",
      status: "Inactive",
      spend: 0,
    });
    expect(result.fetch.status).toBe("warning");
    expect(getBlockingHiringSourceFailures([result.fetch])).toEqual([]);
  });
});

describe("Meta metric ownership", () => {
  it("counts ad metrics once, never repeats campaign totals per ad", async () => {
    harness.metaParents = [
      { campaign_id: "c", campaign_name: "S | Hiring", spend: "10" },
    ];
    harness.metaAds = ["a", "b"].map((ad_id) => ({
      ad_id,
      campaign_id: "c",
      campaign_name: "S | Hiring",
      ad_name: "Salt Lake City Driver",
      spend: "5",
    }));
    harness.metaInventory = harness.metaAds.map((r) => ({
      ...r,
      adset_id: "set",
      adset_name: "Salt Lake City Drivers",
      ad_status: "PAUSED",
    }));
    const result = await __hiringAdsSnapshotTest.fetchMetaRecords(period);
    expect(result.records).toHaveLength(2);
    expect(result.records.reduce((n, r) => n + r.spend, 0)).toBe(10);
    expect(result.fetch.status).toBe("ok");
    harness.metaAds = [];
    const missing = await __hiringAdsSnapshotTest.fetchMetaRecords(period);
    expect(missing.records.every((r) => r.spend === 0)).toBe(true);
    expect(getBlockingHiringSourceFailures([missing.fetch])).toHaveLength(1);
  });
});
