import { describe, expect, it } from "vitest";
import {
  __hiringAdsSnapshotTest,
  escapeHtml,
  getPreviousMondaySunday,
  renderHiringAdsEmail,
  renderHiringAdsEml,
  renderHiringAdsText,
  shouldRunWeeklySnapshot,
} from "@/lib/services/hiring-ads-snapshot";
import { typeOnlyPreviewSnapshot } from "@/lib/services/hiring-ads-snapshot-preview";

describe("hiring ads snapshot scheduling", () => {
  it("uses the previous Monday-Sunday period in Mountain Time", () => {
    const schedule = getPreviousMondaySunday(new Date("2026-06-15T15:00:00.000Z"));

    expect(schedule.period).toEqual({ start: "2026-06-08", end: "2026-06-14" });
    expect(schedule.periodKey).toBe("2026-06-08_to_2026-06-14");
  });

  it("waits until Monday 9 AM Mountain Time", () => {
    const before = shouldRunWeeklySnapshot({}, { now: new Date("2026-06-15T14:59:00.000Z") });
    const atDue = shouldRunWeeklySnapshot({}, { now: new Date("2026-06-15T15:00:00.000Z") });

    expect(before.shouldRun).toBe(false);
    expect(before.reason).toContain("before Monday 9 AM");
    expect(atDue.shouldRun).toBe(true);
  });

  it("does not run twice for the same report period", () => {
    const due = shouldRunWeeklySnapshot(
      { lastSuccessPeriodKey: "2026-06-08_to_2026-06-14" },
      { now: new Date("2026-06-16T15:00:00.000Z") },
    );

    expect(due.shouldRun).toBe(false);
    expect(due.reason).toContain("already sent");
  });

  it("still runs after the Monday 9 AM window if the period has not been sent", () => {
    const late = shouldRunWeeklySnapshot({}, { now: new Date("2026-06-17T15:00:00.000Z") });

    expect(late.shouldRun).toBe(true);
    expect(late.periodKey).toBe("2026-06-08_to_2026-06-14");
  });
});

describe("hiring ads snapshot rendering", () => {
  it("escapes untrusted ad-platform text", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    );
  });

  it("renders preview email without fake performance numbers", () => {
    const html = renderHiringAdsEmail(typeOnlyPreviewSnapshot(new Date("2026-06-18T12:00:00.000Z")));

    expect(html).toContain("Preview only");
    expect(html).toContain("Unknown");
    expect(html).not.toContain("$457.91");
    expect(html).not.toContain("3,052");
  });

  it("renders email as a Gmail-safe HTML fragment", () => {
    const html = renderHiringAdsEmail(typeOnlyPreviewSnapshot(new Date("2026-06-18T12:00:00.000Z")));

    expect(html).not.toContain("<style");
    expect(html).not.toContain("<html");
    expect(html).not.toContain("<body");
    expect(html).toContain("style=");
  });

  it("renders raw email with plain-text fallback, HTML, and attachment", () => {
    const snapshot = typeOnlyPreviewSnapshot(new Date("2026-06-18T12:00:00.000Z"));
    const eml = renderHiringAdsEml({
      from: "Brady Price <brady.price@saltlakeexpress.com>",
      to: "Greg Hendricks <greg.hendricks@saltlakeexpress.com>",
      cc: "Brady Price <brady.price@saltlakeexpress.com>",
      subject: "Weekly hiring ads snapshot",
      text: renderHiringAdsText(snapshot),
      html: renderHiringAdsEmail(snapshot),
      attachment: {
        filename: "full-report.html",
        contentType: "text/html; charset=UTF-8",
        base64: Buffer.from("<html>report</html>", "utf8").toString("base64"),
      },
    });

    expect(eml).toContain("Content-Type: multipart/mixed");
    expect(eml).toContain("Content-Type: multipart/alternative");
    expect(eml).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(eml).toContain("Content-Type: text/html; charset=UTF-8");
    expect(eml).toContain("Content-Disposition: attachment; filename=\"full-report.html\"");
  });

  it("links to the full report when reportUrl is available", () => {
    const snapshot = {
      ...typeOnlyPreviewSnapshot(new Date("2026-06-18T12:00:00.000Z")),
      reportUrl: "https://share-artifacts.vercel.app/sle-hiring-ads/example/",
    };
    const html = renderHiringAdsEmail(snapshot);
    const text = renderHiringAdsText(snapshot);
    const eml = renderHiringAdsEml({
      from: "Brady Price <brady.price@saltlakeexpress.com>",
      to: "Greg Hendricks <greg.hendricks@saltlakeexpress.com>",
      cc: "Brady Price <brady.price@saltlakeexpress.com>",
      subject: "Weekly hiring ads snapshot",
      text,
      html,
    });

    expect(html).toContain("Open full report");
    expect(html).toContain(snapshot.reportUrl);
    expect(text).toContain(`Open full report: ${snapshot.reportUrl}`);
    expect(eml).toContain("Content-Type: multipart/alternative");
    expect(eml).not.toContain("Content-Disposition: attachment");
  });

  it("shows unknown mapped spend and clicks when a platform fetch fails", () => {
    const snapshot = {
      ...typeOnlyPreviewSnapshot(new Date("2026-06-18T12:00:00.000Z")),
      sourceFetches: [
        {
          source: "Google Ads" as const,
          status: "error" as const,
          fetchedAt: "2026-06-18T12:00:00.000Z",
          message: "API unavailable",
        },
      ],
      rows: [
        {
          market: "Omak, WA",
          platform: "Google Ads" as const,
          status: "Needs review" as const,
          reason: "fetch_failed" as const,
          spend: null,
          impressions: null,
          clicks: null,
          hiringConversionRate: "Unknown" as const,
          notes: "Google Ads fetch failed: API unavailable",
          sourceIds: [],
        },
      ],
    };

    const text = renderHiringAdsText(snapshot);

    expect(text).toContain("Mapped spend: Unknown");
    expect(text).toContain("Mapped clicks: Unknown");
    expect(text).not.toContain("Mapped spend: $0");
  });

  it("keeps confidently detected active hiring markets outside the requested list", () => {
    const rows = __hiringAdsSnapshotTest.aggregateRows([
      {
        platform: "Google Ads",
        market: "Boise, ID",
        name: "Boise Driver Hiring",
        entityStatus: "ENABLED",
        eligible: true,
        spend: 12.34,
        impressions: 456,
        clicks: 7,
        destinationUrl: "https://example.com/apply",
        sourceId: "ad:boise",
        notes: ["Matched by ad text."],
      },
    ], [
      {
        source: "Google Ads",
        status: "ok",
        fetchedAt: "2026-06-18T12:00:00.000Z",
      },
      {
        source: "Meta Ads",
        status: "ok",
        fetchedAt: "2026-06-18T12:00:00.000Z",
      },
    ]);

    expect(rows.some((row) => row.market === "Boise, ID" && row.platform === "Google Ads" && row.status === "Active")).toBe(true);
    expect(rows.some((row) => row.market === "Boise, ID" && row.platform === "Meta Ads" && row.status === "Inactive")).toBe(true);
  });

  it("does not add inactive non-requested markets to the weekly report", () => {
    const rows = __hiringAdsSnapshotTest.aggregateRows([
      {
        platform: "Google Ads",
        market: "Boise, ID",
        name: "Boise Driver Hiring",
        entityStatus: "ENABLED",
        eligible: true,
        spend: 0,
        impressions: 0,
        clicks: 0,
        destinationUrl: "https://example.com/apply",
        sourceId: "ad:boise",
        notes: ["Enabled but no delivery."],
      },
    ], [
      {
        source: "Google Ads",
        status: "ok",
        fetchedAt: "2026-06-18T12:00:00.000Z",
      },
      {
        source: "Meta Ads",
        status: "ok",
        fetchedAt: "2026-06-18T12:00:00.000Z",
      },
    ]);

    expect(rows.some((row) => row.market === "Boise, ID")).toBe(false);
    expect(rows.some((row) => row.market === "Omak, WA")).toBe(true);
    expect(rows.some((row) => row.market === "St. George, UT")).toBe(true);
    expect(rows.some((row) => row.market === "Pocatello, ID")).toBe(true);
  });

  it("detects known hiring-market city names without state abbreviations", () => {
    expect(__hiringAdsSnapshotTest.detectMarket("Hiring Campaign / Great Falls Drivers")).toBe("Great Falls, MT");
    expect(__hiringAdsSnapshotTest.detectMarket("SLE-Hiring-SLC / Salt Lake City - M")).toBe("Salt Lake City, UT");
    expect(__hiringAdsSnapshotTest.detectMarket("Drivers Wanted Rexburg Aug Sep Oct")).toBe("Rexburg, ID");
    expect(__hiringAdsSnapshotTest.detectMarket("S | Hiring / WA / Drive For Northwest Stagelines")).toBe("Omak, WA");
    expect(__hiringAdsSnapshotTest.detectMarket("S | Hiring / ID / Drive For Salt Lake Express")).toBe("Pocatello, ID");
    expect(__hiringAdsSnapshotTest.detectMarket("Salt Lake Express is hiring drivers")).toBe(null);
    expect(__hiringAdsSnapshotTest.detectMarket("All Hiring ID drivers")).toBe(null);
  });
});
