import { describe, expect, it } from "vitest";
import {
  __hiringAdsSnapshotTest,
  escapeHtml,
  getMonthToDatePeriod,
  getPreviousMondaySunday,
  renderHiringAdsEmail,
  renderHiringAdsEml,
  renderHiringAdsFullReport,
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

  it("uses the Mountain Time calendar month for MTD comparison", () => {
    const schedule = getMonthToDatePeriod(new Date("2026-06-30T03:00:00.000Z"));

    expect(schedule.period).toEqual({ start: "2026-06-01", end: "2026-06-29" });
    expect(schedule.label).toBe("Jun 1, 2026 - Jun 29, 2026");
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
    expect(html).toContain("Pending");
    expect(html).toContain("Live ad-platform data has not been fetched yet.");
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

  it("renders one market coverage section instead of duplicating active markets", () => {
    const snapshot = {
      ...typeOnlyPreviewSnapshot(new Date("2026-06-18T12:00:00.000Z")),
      activeMarkets: ["St. George, UT", "Pocatello, ID"],
      actionSummary: [
        "Omak, WA needs review. St. George, UT and Pocatello, ID have active hiring ads.",
      ],
      sourceFetches: [
        {
          source: "Google Ads" as const,
          status: "ok" as const,
          fetchedAt: "2026-06-18T12:00:00.000Z",
        },
        {
          source: "Meta Ads" as const,
          status: "ok" as const,
          fetchedAt: "2026-06-18T12:00:00.000Z",
        },
      ],
      rows: [
        {
          market: "Omak, WA",
          platform: "Google Ads" as const,
          status: "Needs review" as const,
          reason: "enabled_no_delivery" as const,
          spend: 0,
          impressions: 0,
          clicks: 0,
          hiringConversionRate: "Not tracked" as const,
          notes: "Enabled but no delivery.",
          sourceIds: ["ad:omak"],
        },
        {
          market: "Omak, WA",
          platform: "Meta Ads" as const,
          status: "Inactive" as const,
          reason: "inactive_no_delivery" as const,
          spend: 0,
          impressions: 0,
          clicks: 0,
          hiringConversionRate: "Not tracked" as const,
          notes: "Inactive.",
          sourceIds: ["meta:omak"],
        },
        {
          market: "St. George, UT",
          platform: "Google Ads" as const,
          status: "Active" as const,
          reason: "active_delivery" as const,
          spend: 136.61,
          impressions: 2136,
          clicks: 181,
          hiringConversionRate: "Not tracked" as const,
          notes: "Active.",
          sourceIds: ["ad:stg"],
        },
        {
          market: "Pocatello, ID",
          platform: "Google Ads" as const,
          status: "Active" as const,
          reason: "active_delivery" as const,
          spend: 26.83,
          impressions: 28,
          clicks: 3,
          hiringConversionRate: "Not tracked" as const,
          notes: "Active.",
          sourceIds: ["ad:poc"],
        },
      ],
      mtdRows: [
        {
          market: "Omak, WA",
          platform: "Google Ads" as const,
          status: "Needs review" as const,
          reason: "enabled_no_delivery" as const,
          spend: 0,
          impressions: 0,
          clicks: 0,
          hiringConversionRate: "Not tracked" as const,
          notes: "Enabled but no delivery.",
          sourceIds: ["ad:omak"],
        },
        {
          market: "Omak, WA",
          platform: "Meta Ads" as const,
          status: "Inactive" as const,
          reason: "inactive_no_delivery" as const,
          spend: 0,
          impressions: 0,
          clicks: 0,
          hiringConversionRate: "Not tracked" as const,
          notes: "Inactive.",
          sourceIds: ["meta:omak"],
        },
        {
          market: "St. George, UT",
          platform: "Google Ads" as const,
          status: "Active" as const,
          reason: "active_delivery" as const,
          spend: 136.61,
          impressions: 2136,
          clicks: 181,
          hiringConversionRate: "Not tracked" as const,
          notes: "Active.",
          sourceIds: ["ad:stg"],
        },
        {
          market: "Pocatello, ID",
          platform: "Google Ads" as const,
          status: "Active" as const,
          reason: "active_delivery" as const,
          spend: 26.83,
          impressions: 28,
          clicks: 3,
          hiringConversionRate: "Not tracked" as const,
          notes: "Active.",
          sourceIds: ["ad:poc"],
        },
      ],
    };

    const html = renderHiringAdsEmail(snapshot);
    const text = renderHiringAdsText(snapshot);

    expect(html).toContain("Market economics");
    expect(html).toContain("Weekly Google check");
    expect(html).toContain("Google MTD");
    expect(html).toContain("Indeed MTD");
    expect(html).toContain("Google CPA");
    expect(html).toContain("Google is enabled but had no weekly delivery.");
    expect(html).toContain("Spend: <strong>$136.61</strong>");
    expect(html).toContain("Clicks: 181 · CPC: $0.75");
    expect(html).toContain("Delivering");
    expect(html).toContain("Meta is not currently running in these requested markets.");
    expect(html).toContain("Data limits");
    expect(html).not.toContain("Same metrics per channel");
    expect(html).not.toContain("Month-to-date channel economics first");
    expect(html).not.toContain("Indeed active");
    expect(html).not.toContain("Google/Meta");
    expect(html).not.toContain("Tiny sample");
    expect(html).not.toContain("Not tracked");
    expect(html).not.toContain("Active hiring markets");
    expect(html).not.toContain("Core and active markets");
    expect(text).toContain("Weekly Driver Hiring Ads Snapshot");
    expect(text).toContain("Market economics:");
    expect(text).toContain("Weekly Google check:");
    expect(text).toContain("Google CPA:");
    expect(text).toContain("CPC $0.75");
    expect(text).toContain("Status Delivering");
    expect(text).toContain("CPA means cost per completed application.");
    expect(text.indexOf("Indeed spend:")).toBeLessThan(text.indexOf("Indeed CPA:"));
    expect(text.indexOf("Indeed CPA:")).toBeLessThan(text.indexOf("Google spend:"));
    expect(text.indexOf("Google spend:")).toBeLessThan(text.indexOf("Google CPA:"));
    expect(text).not.toContain("Google/Meta");
    expect(text).not.toContain("Tiny sample");
    expect(text).not.toContain("Active hiring markets:");
    expect(text).not.toContain("Core and active markets:");
  });

  it("renders the Indeed comparison where application counts exist", () => {
    const snapshot = {
      ...typeOnlyPreviewSnapshot(new Date("2026-06-18T12:00:00.000Z")),
      sourceFetches: [
        {
          source: "Google Ads" as const,
          status: "ok" as const,
          fetchedAt: "2026-06-18T12:00:00.000Z",
        },
        {
          source: "Meta Ads" as const,
          status: "ok" as const,
          fetchedAt: "2026-06-18T12:00:00.000Z",
        },
        {
          source: "Indeed sheet" as const,
          status: "ok" as const,
          fetchedAt: "2026-06-18T12:00:00.000Z",
        },
      ],
      indeedRows: [
        {
          market: "Omak, WA",
          platform: "Indeed" as const,
          jobType: "Driver",
          status: "Active" as const,
          periodLabel: "Current month from Greg's Indeed sheet",
          spend: 372.82,
          impressions: 1432,
          clicks: 129,
          applyStarts: 28,
          applications: 25,
          company: "Northwestern Stagelines",
          sourceRows: 1,
          notes: "Indeed current-month totals. This does not use the weekly Google/Meta report window.",
        },
      ],
    };

    const email = renderHiringAdsEmail(snapshot);
    const fullReport = renderHiringAdsFullReport(snapshot);
    const text = renderHiringAdsText(snapshot);

    expect(email).toContain("Market economics");
    expect(email).toContain("Indeed CPA");
    expect(email).toContain("$14.91");
    expect(email).toContain("Google CPA");
    expect(email.indexOf("Indeed spend")).toBeLessThan(email.indexOf("Indeed CPA"));
    expect(email.indexOf("Indeed CPA")).toBeLessThan(email.indexOf("Google spend"));
    expect(email.indexOf("Google spend")).toBeLessThan(email.indexOf("Google CPA"));
    expect(email).not.toContain("Same metrics per channel");
    expect(email).not.toContain("Google/Meta");
    expect(fullReport).toContain("Month-To-Date Channel Economics");
    expect(fullReport).toContain("Indeed Current-Month Comparison");
    expect(fullReport).toContain("Northwestern Stagelines");
    expect(fullReport).toContain("$14.91");
    expect(fullReport).toContain("CPA is cost per application");
    expect(text).toContain("Market economics:");
    expect(text).toContain("Indeed MTD: Spend $372.82");
    expect(text).toContain("CPA $14.91");
    expect(text).not.toContain("Google/Meta");
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

    expect(text).toContain("Google spend: Unknown");
    expect(text).toContain("Omak, WA: Spend Unknown, Shown Unknown, Clicks Unknown, CPC Unknown, Status Review.");
    expect(text).toContain("Google Ads: API unavailable");
    expect(text).not.toContain("Google spend: $0");
    expect(text).not.toContain("Google/Meta");
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

  it("keeps the weekly report scoped to driver hiring", () => {
    expect(__hiringAdsSnapshotTest.hasDriverHiringIntent("All Hiring / Customer Service Jobs")).toBe(false);
    expect(__hiringAdsSnapshotTest.hasDriverHiringIntent("All Hiring / CDL Driver Jobs")).toBe(true);
    expect(__hiringAdsSnapshotTest.hasDriverHiringIntent("S | Hiring / WA / Drive For Northwest Stagelines")).toBe(true);
  });

  it("uses Google ad rows over campaign rows to avoid double-counting mixed-market campaigns", () => {
    const records = __hiringAdsSnapshotTest.buildGoogleRecords([
      {
        campaign: {
          id: "23506774948",
          name: "S | Hiring | UT/ID",
          status: "ENABLED",
        },
        metrics: {
          costMicros: "41670000",
          impressions: "63",
          clicks: "8",
        },
      },
    ], [
      {
        campaign: {
          id: "23506774948",
          name: "S | Hiring | UT/ID",
          status: "ENABLED",
        },
        adGroup: {
          name: "St. George",
          status: "ENABLED",
        },
        adGroupAd: {
          status: "ENABLED",
          ad: { id: "805165305520" },
        },
        metrics: {
          costMicros: "14840000",
          impressions: "35",
          clicks: "5",
        },
      },
      {
        campaign: {
          id: "23506774948",
          name: "S | Hiring | UT/ID",
          status: "ENABLED",
        },
        adGroup: {
          name: "ID",
          status: "ENABLED",
        },
        adGroupAd: {
          status: "ENABLED",
          ad: { id: "794502836796" },
        },
        metrics: {
          costMicros: "26830000",
          impressions: "28",
          clicks: "3",
        },
      },
    ]);

    expect(records).toHaveLength(2);
    expect(records.some((record) => record.sourceId === "campaign:23506774948")).toBe(false);
    expect(records).toContainEqual(expect.objectContaining({
      market: "St. George, UT",
      sourceId: "ad:805165305520",
      spend: 14.84,
    }));
    expect(records).toContainEqual(expect.objectContaining({
      market: "Pocatello, ID",
      sourceId: "ad:794502836796",
      spend: 26.83,
    }));
  });
});
