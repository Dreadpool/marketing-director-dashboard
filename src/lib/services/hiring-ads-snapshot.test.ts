import { describe, expect, it } from "vitest";
import {
  type HiringAdSnapshot,
  __hiringAdsSnapshotTest,
  escapeHtml,
  getBlockingHiringSourceFailures,
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

describe("hiring ads snapshot Indeed sheet tabs", () => {
  it("uses the report month's MM-YYYY tab first", () => {
    const ranges = __hiringAdsSnapshotTest.indeedSheetRangesForPeriod({
      start: "2026-07-01",
      end: "2026-07-14",
    });

    expect(ranges[0]).toEqual({
      label: "07-2026",
      range: "'07-2026'!A:AF",
      legacy: false,
    });
  });

  it("does not substitute a stale legacy tab when the report month is missing", () => {
    const ranges = __hiringAdsSnapshotTest.indeedSheetRangesForPeriod({
      start: "2026-07-01",
      end: "2026-07-14",
    });

    expect(ranges).toHaveLength(1);
  });
});

describe("hiring ads snapshot rendering", () => {
  const preview = () => typeOnlyPreviewSnapshot(new Date("2026-09-07T16:00:00Z"));
  const live = (): HiringAdSnapshot => ({ ...preview(), sourceFetches: [
    { source: "Google Ads" as const, status: "ok" as const, fetchedAt: "2026-09-07T16:00:00Z" },
    { source: "Google Ads MTD" as const, status: "ok" as const, fetchedAt: "2026-09-07T16:00:00Z" },
    { source: "Indeed sheet" as const, status: "ok" as const, fetchedAt: "2026-09-07T16:00:00Z" },
  ] });
  it("escapes untrusted ad-platform text", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
  });
  it("renders a Gmail-safe preview without fake cities or performance numbers", () => {
    const html = renderHiringAdsEmail(preview());
    expect(html).toContain("Preview only");
    expect(html).not.toContain("$0.00");
    expect(html).not.toContain("Omak");
    expect(html).not.toMatch(/<style|<html|<body/);
    expect(html).toContain("style=");
  });
  it("separates current settings from weekly delivery and Indeed's own markets", () => {
    const snapshot = live();
snapshot.rows = [{ market: "Boise <script>", platform: "Google Ads", status: "Active", reason: "active_delivery", spend: 25, impressions: 100, clicks: 5, hiringConversionRate: "Not tracked", notes: "", sourceIds: ["a"], google: { campaignId: "1", campaignName: "S | Hiring", adGroupId: "a", adGroupName: "Boise", currentState: "Ad group paused", locationInterests: ["Boise (city)"], presence: "Presence", deliveryStatus: "Paused", coverageCheck: "No approved rule", campaignTargets: ["Boise (DMA region)"], issues: [] } }];
    snapshot.indeedRows = [{ market: "Missoula, MT", company: "NWL", platform: "Indeed", jobType: "Driver", status: "Active", periodLabel: "Sep 2026", spend: 60, impressions: 100, clicks: 20, applyStarts: 8, applications: 4, sourceRows: 1, notes: "" }];
    const html = renderHiringAdsEmail(snapshot);
    expect(html).toContain("Paused");
    expect(html).toContain("Ads now");
    expect(html).toContain("Last week: 100 impressions");
    expect(html).not.toContain("Now / last week");
    expect(html).not.toContain("On (settings)");
    expect(html).not.toContain("Off (");
    expect(html).not.toContain("overflow:hidden");
    expect(renderHiringAdsFullReport(snapshot)).toContain("Ad group paused");
    expect(renderHiringAdsFullReport(snapshot)).toContain("Boise (DMA region)");
    expect(html).toContain("Missoula, MT");
    expect(html).toContain("$15.00");
    expect(html).toContain("Boise &lt;script&gt;");
    expect(html).not.toContain("Market economics");
    expect(html).not.toContain("Needs attention");
    expect(html).not.toContain("<script>");
    const text = renderHiringAdsText(snapshot);
    expect(text).toContain("Missoula, MT / NWL");
    expect(text).toContain("Paused now; Delivered during week");
    expect(renderHiringAdsFullReport(snapshot)).not.toContain("Optional AI commentary");
    expect(html).not.toContain("Optional AI commentary");
  });
  it.each([
    ["Enabled", "On"],
    ["Ad group paused", "Paused"],
    ["Campaign paused", "Paused"],
    ["Removed", "Removed"],
    ["Unknown", "Unknown"],
  ] as const)("labels %s as %s without inferring current delivery from weekly spend", (state, label) => {
    const snapshot = live();
    snapshot.rows = [{ market: "Test market", platform: "Google Ads", status: "Inactive", reason: "no_delivery", spend: 0, impressions: 0, clicks: 0, hiringConversionRate: "Not tracked", notes: "", sourceIds: ["test"], google: { campaignId: "1", campaignName: "Hiring", adGroupId: "test", adGroupName: "Test market", currentState: state, locationInterests: [], presence: "Presence", deliveryStatus: "Unknown", coverageCheck: "No approved rule", campaignTargets: [], issues: [] } }];
    const html = renderHiringAdsEmail(snapshot);
    expect(html).toContain(`>${label}</strong>`);
    expect(html).toContain("Weekly clicks");
    expect(html).not.toContain("On (settings)");
    expect(html).not.toContain("Off (");
    expect(renderHiringAdsText(snapshot)).toContain(`Test market: ${label} now; No delivery during week`);
    snapshot.rows[0].spend = 20;
    snapshot.rows[0].clicks = 4;
    expect(renderHiringAdsEmail(snapshot)).toContain(`>${label}</strong>`);
    expect(renderHiringAdsText(snapshot)).toContain(`Test market: ${label} now; Delivered during week`);
    snapshot.rows[0].spend = null;
    snapshot.rows[0].clicks = null;
    expect(renderHiringAdsEmail(snapshot)).toContain("Unavailable per click");
    snapshot.rows[0].google = undefined;
    expect(renderHiringAdsEmail(snapshot)).toContain(">Unknown</strong>");
  });
  it("shows source failures as unavailable, never zero spend", () => {
    const snapshot = live();
    snapshot.sourceFetches[0] = { source: "Google Ads", status: "error", fetchedAt: snapshot.generatedAt, message: "API unavailable" };
    const html = renderHiringAdsEmail(snapshot);
    expect(html).toContain("API unavailable");
    expect(html).toContain("Unavailable");
    expect(html).not.toContain("Weekly spend: <strong style=\"color:#0f172a;\">$0.00");
  });
  it("keeps a missing Indeed month nonblocking and does not substitute prior-month data", () => {
    const snapshot = live();
    snapshot.sourceFetches[2] = { source: "Indeed sheet", status: "error", fetchedAt: snapshot.generatedAt, message: "Monthly tab 09-2026 missing" };
    expect(getBlockingHiringSourceFailures(snapshot.sourceFetches)).toEqual([]);
    expect(renderHiringAdsEmail(snapshot)).toContain("September 2026 sheet could not be read");
    expect(renderHiringAdsFullReport(snapshot)).toContain("Monthly tab 09-2026 missing");
    expect(renderHiringAdsText(snapshot)).toContain("Indeed spend: Unavailable");
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

});

describe("platform-specific location naming", () => {
  it("does not translate generic Google state abbreviations into cities", () => {
    expect(__hiringAdsSnapshotTest.detectMarket("S | Hiring / WA")).toBeNull();
    expect(__hiringAdsSnapshotTest.detectMarket("S | Hiring / ID")).toBeNull();
  });
  it("preserves Indeed's own city and state", () => {
    expect(__hiringAdsSnapshotTest.cityMarket("Missoula", "MT")).toBe("Missoula, MT");
    expect(__hiringAdsSnapshotTest.cityMarket("St. George", "Utah")).toBe("St. George, UT");
    expect(__hiringAdsSnapshotTest.cityMarket("BOI", "")).toBe("BOI");
    expect(__hiringAdsSnapshotTest.cityMarket("SLC", "")).toBe("SLC");
  });
  it("distinguishes blank Indeed metrics from explicit zeros and preserves missing totals", () => {
    expect(__hiringAdsSnapshotTest.sheetMetric("")).toBeNull();
    expect(__hiringAdsSnapshotTest.sheetMetric("pending")).toBeNull();
    expect(__hiringAdsSnapshotTest.sheetMetric("$0.00")).toBe(0);
    expect(__hiringAdsSnapshotTest.sheetMetric("1,230")).toBe(1230);
    const row = { market: "BOI", company: "Unknown", platform: "Indeed" as const, jobType: "Driver", status: "Active" as const, periodLabel: "September", spend: null, impressions: null, clicks: null, applyStarts: null, applications: null, sourceRows: 1, notes: "" };
    const combined = __hiringAdsSnapshotTest.aggregateIndeedRows([row, { ...row, spend: 10 }]);
    expect(combined[0].spend).toBeNull();
    const snapshot = typeOnlyPreviewSnapshot();
    snapshot.indeedRows = combined;
    snapshot.sourceFetches = [{ source: "Indeed sheet", status: "ok", fetchedAt: snapshot.generatedAt }];
    expect(renderHiringAdsEmail(snapshot)).toContain("BOI");
    expect(renderHiringAdsEmail(snapshot)).not.toContain("$0.00");
  });
  it("keeps non-driver and ticket-sales ads out of driver reporting", () => {
    expect(__hiringAdsSnapshotTest.hasDriverHiringIntent("Mechanic job apply now")).toBe(false);
    expect(__hiringAdsSnapshotTest.hasDriverHiringIntent("CDL driver hiring")).toBe(true);
  });
});
