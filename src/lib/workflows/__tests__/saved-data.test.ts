import { describe, expect, it } from "vitest";
import { latestPeriodRun, getDataRetrievedAt } from "../saved-data";

const runs = [
  { id: "old", periodYear: 2026, periodMonth: 10, status: "completed", startedAt: "2026-11-01T12:00:00Z" },
  { id: "new", periodYear: 2026, periodMonth: 10, status: "completed", startedAt: "2026-11-02T12:00:00Z" },
  { id: "september", periodYear: 2026, periodMonth: 9, status: "completed", startedAt: "2026-11-03T12:00:00Z" },
];
describe("saved data selection", () => {
  it("opens newest saved results only for the selected month and year", () => {
    expect(latestPeriodRun(runs, 2026, 10)?.id).toBe("new");
    expect(latestPeriodRun(runs, 2026, 9)?.id).toBe("september");
    expect(latestPeriodRun(runs, 2025, 10)).toBeUndefined();
    expect(runs[0].id).toBe("old");
  });
  it("resumes a running retrieval, then prefers completed data over failed updates", () => {
    const update = { ...runs[1], id: "update", startedAt: "2026-11-04T12:00:00Z", status: "running" };
    expect(latestPeriodRun([...runs, update], 2026, 10)?.id).toBe("update");
    expect(latestPeriodRun([...runs, { ...update, status: "failed" }], 2026, 10)?.id).toBe("new");
  });
  it("uses source retrieval timestamps, including older cached reports", () => {
    expect(getDataRetrievedAt({ metadata: { generated_at: "2026-10-01T12:00:00Z" }, completedAt: "2026-11-01T12:00:00Z" })).toBe("2026-10-01T12:00:00Z");
    expect(getDataRetrievedAt({ dataRetrievedAt: "2026-11-02T12:00:00Z" })).toBe("2026-11-02T12:00:00Z");
    expect(getDataRetrievedAt({ completedAt: "2026-11-01T12:00:00Z" })).toBeNull();
    expect(getDataRetrievedAt({ metadata: { generated_at: "bad" } })).toBeNull();
  });
});
