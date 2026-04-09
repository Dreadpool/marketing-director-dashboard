import { describe, it, expect } from "vitest";
import {
  computeDailyTrend,
  classifyWithTrends,
} from "@/lib/workflows/classifiers/meta-ads-trends";
import type { DailyPoint } from "@/lib/schemas/sources/meta-ads-metrics";

// ─── Fixture helpers ──────────────────────────────────────────────────────

function makePoint(overrides: Partial<DailyPoint> = {}): DailyPoint {
  return {
    date: "2026-03-01",
    spend: 50,
    impressions: 5000,
    clicks: 75,
    purchases: 5,
    cpa: 10,
    ctr: 0.015,
    ...overrides,
  };
}

/** Build N sequential days starting from a given base date. */
function buildDays(
  count: number,
  base: Partial<DailyPoint> = {},
  startDate = "2026-03-01",
): DailyPoint[] {
  const start = new Date(startDate);
  const days: DailyPoint[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(
      makePoint({
        ...base,
        date: d.toISOString().slice(0, 10),
      }),
    );
  }
  return days;
}

// ─── computeDailyTrend ────────────────────────────────────────────────────

describe("computeDailyTrend", () => {
  it("returns learning for empty daily points", () => {
    const trend = computeDailyTrend([]);
    expect(trend.lifecycle_stage).toBe("learning");
    expect(trend.peak_ctr).toBe(0);
    expect(trend.current_ctr).toBe(0);
    expect(trend.ctr_7d_change_pct).toBeNull();
    expect(trend.cpa_7d_change_pct).toBeNull();
  });

  it("returns learning for 2 days of data", () => {
    const daily = buildDays(2, { ctr: 0.015, cpa: 8 });
    const trend = computeDailyTrend(daily);
    expect(trend.lifecycle_stage).toBe("learning");
  });

  it("returns performing for 10 days of good performance", () => {
    const daily = buildDays(10, {
      ctr: 0.015, // 1.5% - healthy
      cpa: 8, // below $14 threshold
      purchases: 5,
    });
    const trend = computeDailyTrend(daily);
    expect(trend.lifecycle_stage).toBe("performing");
    expect(trend.peak_ctr).toBeCloseTo(0.015, 5);
  });

  it("returns fatiguing for ad with CTR dropped 25% from peak", () => {
    // 7 good days, then 7 days of CTR 25%+ below peak
    const goodDays = buildDays(
      7,
      { ctr: 0.02, cpa: 8, purchases: 5 },
      "2026-03-01",
    );
    const decliningDays = buildDays(
      7,
      { ctr: 0.014, cpa: 10, purchases: 4 }, // 30% drop from peak of 0.02
      "2026-03-08",
    );
    const trend = computeDailyTrend([...goodDays, ...decliningDays]);
    expect(trend.peak_ctr).toBeCloseTo(0.02, 5);
    // current_ctr is avg of last 3 declining days = 0.014
    expect(trend.current_ctr).toBeCloseTo(0.014, 5);
    expect(trend.lifecycle_stage).toBe("fatiguing");
  });

  it("returns fatiguing when CPA rose 30% week-over-week", () => {
    // 7 days with CPA $8 then 7 days with CPA $12 (50% rise)
    const priorDays = buildDays(
      7,
      { ctr: 0.015, cpa: 8, spend: 40, purchases: 5 },
      "2026-03-01",
    );
    const recentDays = buildDays(
      7,
      { ctr: 0.015, cpa: 12, spend: 60, purchases: 5 },
      "2026-03-08",
    );
    const trend = computeDailyTrend([...priorDays, ...recentDays]);
    expect(trend.cpa_7d_change_pct).not.toBeNull();
    expect(trend.cpa_7d_change_pct!).toBeGreaterThanOrEqual(25);
    expect(trend.lifecycle_stage).toBe("fatiguing");
  });

  it("returns dead for CTR dropped 35% AND CPA up 60%", () => {
    const priorDays = buildDays(
      7,
      { ctr: 0.02, cpa: 8, purchases: 5 },
      "2026-03-01",
    );
    const recentDays = buildDays(
      7,
      { ctr: 0.013, cpa: 13, purchases: 3 }, // 35% CTR drop, 62.5% CPA rise
      "2026-03-08",
    );
    const trend = computeDailyTrend([...priorDays, ...recentDays]);
    expect(trend.lifecycle_stage).toBe("dead");
  });

  it("computes ctr_direction rising when CTR went up 15%+", () => {
    const priorDays = buildDays(
      7,
      { ctr: 0.01, cpa: 10, purchases: 5 },
      "2026-03-01",
    );
    const recentDays = buildDays(
      7,
      { ctr: 0.013, cpa: 10, purchases: 5 }, // 30% rise
      "2026-03-08",
    );
    const trend = computeDailyTrend([...priorDays, ...recentDays]);
    expect(trend.ctr_direction).toBe("rising");
  });

  it("computes ctr_direction declining when CTR dropped 15%+", () => {
    const priorDays = buildDays(
      7,
      { ctr: 0.02, cpa: 10, purchases: 5 },
      "2026-03-01",
    );
    const recentDays = buildDays(
      7,
      { ctr: 0.014, cpa: 10, purchases: 5 }, // 30% drop
      "2026-03-08",
    );
    const trend = computeDailyTrend([...priorDays, ...recentDays]);
    expect(trend.ctr_direction).toBe("declining");
  });

  it("computes cpa_direction rising when CPA went up 15%+", () => {
    const priorDays = buildDays(
      7,
      { ctr: 0.015, cpa: 8, purchases: 5 },
      "2026-03-01",
    );
    const recentDays = buildDays(
      7,
      { ctr: 0.015, cpa: 11, purchases: 5 }, // 37.5% rise
      "2026-03-08",
    );
    const trend = computeDailyTrend([...priorDays, ...recentDays]);
    expect(trend.cpa_direction).toBe("rising");
  });

  it("returns flat direction for small changes", () => {
    const priorDays = buildDays(
      7,
      { ctr: 0.015, cpa: 10, purchases: 5 },
      "2026-03-01",
    );
    const recentDays = buildDays(
      7,
      { ctr: 0.0155, cpa: 10.3, purchases: 5 }, // tiny change
      "2026-03-08",
    );
    const trend = computeDailyTrend([...priorDays, ...recentDays]);
    expect(trend.ctr_direction).toBe("flat");
    expect(trend.cpa_direction).toBe("flat");
  });

  it("handles days with 0 purchases without divide-by-zero", () => {
    const daily: DailyPoint[] = [
      makePoint({ date: "2026-03-01", purchases: 0, cpa: 0 }),
      makePoint({ date: "2026-03-02", purchases: 0, cpa: 0 }),
      makePoint({ date: "2026-03-03", purchases: 5, cpa: 10 }),
      makePoint({ date: "2026-03-04", purchases: 5, cpa: 10 }),
    ];
    const trend = computeDailyTrend(daily);
    expect(trend.cpa_7d_change_pct).toBeNull(); // not enough days for a 7d window
    expect(Number.isFinite(trend.current_ctr)).toBe(true);
    expect(Number.isFinite(trend.peak_ctr)).toBe(true);
  });
});

// ─── classifyWithTrends ───────────────────────────────────────────────────

describe("classifyWithTrends", () => {
  it("returns learning for ad with empty daily points", () => {
    const trend = computeDailyTrend([]);
    const result = classifyWithTrends(trend);
    expect(result.status).toBe("learning");
    expect(result.action).toMatch(/leave it alone/i);
  });

  it("returns kill / born_bad for ad with peak CTR below 0.5%", () => {
    // 10 days of terrible CTR (0.3%) and no purchases
    const daily = buildDays(10, {
      ctr: 0.003,
      purchases: 0,
      cpa: 0,
    });
    const trend = computeDailyTrend(daily);
    expect(trend.lifecycle_stage).toBe("born_bad");

    const result = classifyWithTrends(trend);
    expect(result.status).toBe("kill");
    expect(result.reason).toMatch(/never performed/i);
    expect(result.action).toMatch(/born bad/i);
  });

  it("returns kill / born_bad for ad that never achieved CPA < $14", () => {
    // CTR is OK but CPA always above $14
    const daily = buildDays(10, {
      ctr: 0.015,
      cpa: 20, // above $14 target
      purchases: 2,
    });
    const trend = computeDailyTrend(daily);
    expect(trend.lifecycle_stage).toBe("born_bad");

    const result = classifyWithTrends(trend);
    expect(result.status).toBe("kill");
    expect(result.action).toMatch(/born bad/i);
  });

  it("returns underperforming for fatiguing ad", () => {
    const goodDays = buildDays(
      7,
      { ctr: 0.02, cpa: 8, purchases: 5 },
      "2026-03-01",
    );
    const decliningDays = buildDays(
      7,
      { ctr: 0.014, cpa: 11, purchases: 4 },
      "2026-03-08",
    );
    const trend = computeDailyTrend([...goodDays, ...decliningDays]);
    const result = classifyWithTrends(trend);
    expect(result.status).toBe("underperforming");
    expect(result.action).toMatch(/refresh creative/i);
  });

  it("returns kill for dead ad", () => {
    const goodDays = buildDays(
      7,
      { ctr: 0.02, cpa: 8, purchases: 5 },
      "2026-03-01",
    );
    const deadDays = buildDays(
      7,
      { ctr: 0.013, cpa: 13, purchases: 3 },
      "2026-03-08",
    );
    const trend = computeDailyTrend([...goodDays, ...deadDays]);
    expect(trend.lifecycle_stage).toBe("dead");
    const result = classifyWithTrends(trend);
    expect(result.status).toBe("kill");
    expect(result.action).toMatch(/creative is dead/i);
  });

  it("returns healthy for a performing ad", () => {
    const daily = buildDays(10, {
      ctr: 0.015,
      cpa: 8,
      purchases: 5,
    });
    const trend = computeDailyTrend(daily);
    const result = classifyWithTrends(trend);
    expect(result.status).toBe("healthy");
    expect(result.action).toMatch(/leave it running/i);
  });
});
