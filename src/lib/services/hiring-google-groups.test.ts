import { describe, expect, it } from "vitest";
import {
  buildHiringGoogleGroups,
  reconcileGoogleMetrics,
} from "./hiring-google-groups";
import { __hiringAdsSnapshotTest } from "./hiring-ads-snapshot";

const group = (
  id: string,
  name: string,
  status = "ENABLED",
  campaignStatus = "ENABLED",
) => ({
  campaign: { id: "1", name: "S | Hiring | UT/ID", status: campaignStatus },
  adGroup: { id, name, status },
});
const target = (id: string, geo: string, negative = false) => ({
  ...group(id, ""),
  adGroupCriterion: {
    status: "ENABLED",
    negative,
    location: { geoTargetConstant: `geoTargetConstants/${geo}` },
  },
});
const locations = [
  {
    geoTargetConstant: {
      resourceName: "geoTargetConstants/10",
      name: "Salt Lake City, UT",
      targetType: "DMA Region",
    },
  },
  {
    geoTargetConstant: {
      resourceName: "geoTargetConstants/11",
      name: "St. George",
      targetType: "City",
    },
  },
  {
    geoTargetConstant: {
      resourceName: "geoTargetConstants/12",
      name: "Boise",
      targetType: "City",
    },
  },
];

describe("Google hiring ad-group reporting", () => {
  const approved = () => ({
    campaign: {
      id: "23506774948",
      name: "Renamed hiring campaign",
      status: "ENABLED",
      geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE" },
      primaryStatus: "LIMITED",
    },
    adGroup: {
      id: "197915916605",
      name: "Salt Lake City",
      status: "ENABLED",
      primaryStatus: "ELIGIBLE",
    },
  });
  const shopRadius = () => ({
    campaign: { id: "23506774948" },
    campaignCriterion: {
      type: "PROXIMITY",
      status: "ENABLED",
      negative: false,
      proximity: {
        radius: 50,
        radiusUnits: "MILES",
        geoPoint: {
          latitudeInMicroDegrees: 40753466,
          longitudeInMicroDegrees: -111963574,
        },
        address: {
          streetAddress: "700 Fulton St",
          cityName: "Salt Lake City",
          provinceCode: "UT",
          postalCode: "84104",
        },
      },
    },
  });
  it("verifies the approved center and Presence even when a DMA interest remains", () => {
    const row = approved();
    const interest = {
      ...row,
      adGroupCriterion: target("a", "10").adGroupCriterion,
    };
    const [r] = buildHiringGoogleGroups(
      [row],
      [],
      [interest],
      [shopRadius()],
      locations,
    );
    expect(r.google.issues).toEqual([]);
    expect(r.google.coverageCheck).toContain("Matches approved");
    expect(r.google.currentState).toBe("Enabled");
    expect(r.google.locationInterests[0]).toContain("DMA region");
    expect(r.google.campaignTargets[0]).toContain("50 mi around 700 Fulton St");
  });
  it.each(["radius", "units", "center", "extra DMA", "exclusion", "presence"])(
    "flags a changed approved coverage setting: %s",
    (change) => {
      const row = approved();
      const radius = shopRadius();
      const extra: Record<string, unknown>[] = [];
      if (change === "radius") radius.campaignCriterion.proximity.radius = 30;
      if (change === "units")
        radius.campaignCriterion.proximity.radiusUnits = "KILOMETERS";
      if (change === "center")
        radius.campaignCriterion.proximity.geoPoint.longitudeInMicroDegrees += 100000;
      if (change === "presence")
        row.campaign.geoTargetTypeSetting.positiveGeoTargetType =
          "PRESENCE_OR_INTEREST";
      if (change === "extra DMA" || change === "exclusion")
        extra.push({
          campaign: row.campaign,
          campaignCriterion: {
            status: "ENABLED",
            negative: change === "exclusion",
            location: { geoTargetConstant: "geoTargetConstants/10" },
          },
        });
      const [r] = buildHiringGoogleGroups(
        [row],
        [],
        [],
        [radius, ...extra],
        locations,
      );
      expect(r.google.coverageCheck).toContain("Does not match");
      expect(r.google.currentState).toBe("Enabled");
    },
  );
  it("separates a Google delivery restriction from enabled switches", () => {
    const row = approved();
    row.adGroup.primaryStatus = "NOT_ELIGIBLE";
    const [r] = buildHiringGoogleGroups([row], [], [], [shopRadius()], []);
    expect(r.google.currentState).toBe("Enabled");
    expect(r.google.issues.join(" ")).toContain(
      "Switches are on, but Google reports",
    );
  });
  it("does not call unknown switches off or remove a known deleted market", () => {
    const row = approved();
    row.adGroup.status = "UNKNOWN";
    expect(
      buildHiringGoogleGroups([row], [], [], [], [])[0].google.currentState,
    ).toBe("Unknown");
    row.adGroup.status = "REMOVED";
    expect(
      buildHiringGoogleGroups([row], [], [], [], [])[0].google.currentState,
    ).toBe("Removed");
  });
  it("checks group spend, clicks, and impressions independently against campaign totals", () => {
    const row = {
      ...group("a", "Salt Lake City"),
      metrics: { costMicros: "100", impressions: "2", clicks: "1" },
    };
    expect(() => reconcileGoogleMetrics([row], [row])).not.toThrow();
    expect(() => reconcileGoogleMetrics([row, row], [row])).toThrow(
      "Duplicate",
    );
    expect(() => reconcileGoogleMetrics([], [row])).toThrow("reconcile");
    expect(() =>
      reconcileGoogleMetrics(
        [row],
        [{ ...row, metrics: { ...row.metrics, clicks: "2" } }],
      ),
    ).toThrow("reconcile");
    expect(() =>
      reconcileGoogleMetrics([{ ...row, metrics: { costMicros: "bad" } }], []),
    ).toThrow("Invalid");
  });
  it("reports the physical campaign radius separately from optional location interests", () => {
    const row = group("a", "Salt Lake City");
    const radius = {
      campaign: row.campaign,
      campaignCriterion: {
        type: "PROXIMITY",
        negative: false,
        proximity: {
          radius: 50,
          radiusUnits: "MILES",
          address: { streetAddress: "700 Fulton St, Salt Lake City, UT 84104" },
        },
      },
    };
    const [result] = buildHiringGoogleGroups([row], [], [], [radius], []);
    expect(result.google.campaignTargets).toEqual([
      "50 mi around 700 Fulton St, Salt Lake City, UT 84104",
    ]);
    expect(result.google.issues).not.toContain(
      "0 enabled location targets; expected one.",
    );
  });
  it("retains named markets when a tracked campaign is paused", () => {
    const row = group("a", "Spokane", "PAUSED", "PAUSED");
    row.campaign.id = "24043574614";
    const records = buildHiringGoogleGroups([row], [], [], [], []);
    expect(records).toHaveLength(1);
    expect(records[0].google.currentState).toBe("Campaign paused");
    expect(records[0].spend).toBe(0);
  });
  it("discovers new locations and retains paused city groups without any city roster", () => {
    const rows = buildHiringGoogleGroups(
      [
        group("a", "Salt Lake City"),
        group("b", "St. George", "PAUSED"),
        group("c", "Boise, ID", "PAUSED"),
      ],
      [],
      [target("a", "10"), target("b", "11"), target("c", "12")],
      [],
      locations,
    );
    expect(rows.map((r) => r.market)).toEqual([
      "Boise, ID",
      "Salt Lake City",
      "St. George",
    ]);
    expect(
      rows.find((r) => r.market === "Salt Lake City")?.google.locationInterests,
    ).toEqual(["Salt Lake City, UT (DMA region)"]);
  });
  it("omits dormant generic duplicates and dormant campaigns, but never their weekly spend", () => {
    const idle = [
      group("a", "ID", "PAUSED"),
      group("b", "St. George", "PAUSED", "PAUSED"),
    ];
    idle[1].campaign.id = "974434774";
    expect(buildHiringGoogleGroups(idle, [], [], [], [])).toEqual([]);
    const performance = idle.map((r) => ({
      ...r,
      metrics: { costMicros: "12000000", impressions: "100", clicks: "4" },
    }));
    const records = buildHiringGoogleGroups(idle, performance, [], [], []);
    const rows = __hiringAdsSnapshotTest.aggregateRows(records, []);
    expect(rows).toHaveLength(2);
    expect(rows.reduce((n, r) => n + r.spend!, 0)).toBe(24);
    expect(rows.every((r) => r.reason === "active_delivery")).toBe(true);
    expect(rows[1].google?.currentState).toBe("Campaign paused");
  });
  it("never divides or duplicates spend when targets conflict", () => {
    const inventory = [group("a", "Salt Lake City")];
    const records = buildHiringGoogleGroups(
      inventory,
      [
        {
          ...inventory[0],
          metrics: { costMicros: "183850000", clicks: 64, impressions: 974 },
        },
      ],
      [target("a", "10"), target("a", "11")],
      [],
      locations,
    );
    expect(records).toHaveLength(1);
    expect(records[0].spend).toBe(183.85);
    expect(records[0].google.locationInterests).toHaveLength(2);
    expect(records[0].google.issues.join(" ")).not.toContain("expected one");
  });
  it("does not infer physical geography from a name or location interest", () => {
    const records = buildHiringGoogleGroups(
      [group("a", "Omak"), group("b", "Spokane")],
      [],
      [target("a", "11")],
      [],
      locations,
    );
    expect(records[0].market).toBe("Omak");
    expect(records[0].google.locationInterests).toEqual(["St. George (city)"]);
    expect(records[0].google.issues.join(" ")).not.toContain(
      "Omak / St. George",
    );
    expect(records[1].google.locationInterests).toEqual([]);
  });
  it("does not count exclusions as positive targets", () => {
    const [r] = buildHiringGoogleGroups(
      [group("a", "Salt Lake City")],
      [],
      [target("a", "10"), target("a", "11", true)],
      [],
      locations,
    );
    expect(r.google.locationInterests[1]).toBe("Excluded: St. George (city)");
  });
  it("keeps same-name groups separate by ID and includes removed groups with spend", () => {
    const inventory = [group("a", "St. George"), group("b", "St. George")];
    const performance = [...inventory, group("c", "St. George", "REMOVED")].map(
      (r) => ({ ...r, metrics: { costMicros: 1000000 } }),
    );
    const rows = __hiringAdsSnapshotTest.aggregateRows(
      buildHiringGoogleGroups(inventory, performance, [], [], []),
      [],
    );
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.sourceIds[0])).size).toBe(3);
    expect(rows.reduce((n, r) => n + r.spend!, 0)).toBe(3);
  });
  it("excludes customer and non-driver hiring campaigns", () => {
    const inventory = [
      group("a", "Mechanic Jobs"),
      {
        ...group("b", "Friendly Drivers"),
        campaign: { id: "2", name: "Ticket Sales", status: "ENABLED" },
      },
    ];
    expect(buildHiringGoogleGroups(inventory, [], [], [], [])).toEqual([]);
  });
});
