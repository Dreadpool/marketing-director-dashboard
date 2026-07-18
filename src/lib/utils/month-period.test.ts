import { describe, expect, it } from "vitest";
import { getMonthDateRange } from "./month-period";

describe("getMonthDateRange", () => {
  it("returns calendar month boundaries without timezone drift", () => {
    expect(getMonthDateRange({ year: 2026, month: 6 })).toEqual({
      start: "2026-06-01",
      end: "2026-06-30",
    });
  });

  it("handles leap-year February", () => {
    expect(getMonthDateRange({ year: 2024, month: 2 })).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
  });
});
