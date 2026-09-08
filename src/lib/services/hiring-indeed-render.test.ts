import { describe, expect, it } from "vitest";
import { renderHiringAdsEmail, renderHiringAdsFullReport, type IndeedComparisonRow } from "./hiring-ads-snapshot";
import { typeOnlyPreviewSnapshot } from "./hiring-ads-snapshot-preview";

const row = (market: string): IndeedComparisonRow => ({ market, company: "Unknown", platform: "Indeed", jobType: "Driver", status: "Active", periodLabel: "September", spend: null, impressions: null, clicks: null, applyStarts: null, applications: null, sourceRows: 1, notes: "" });
const fixture = () => ({ ...typeOnlyPreviewSnapshot(new Date("2026-09-07T22:00:00Z")), indeedRows: [row("BOI"), row("SLC"), row("STG")], sourceFetches: [{ source: "Indeed sheet" as const, status: "warning" as const, fetchedAt: "2026-09-07T22:00:00Z", modifiedAt: "2026-09-04T18:54:46Z", message: "Raw sheet metadata and missing company detail" }] });
const section = (html: string) => html.slice(html.indexOf(">Indeed</h2>")).split("All checks are fixed rules")[0];

describe("Indeed email states", () => {
  it("collapses all-missing performance without hiding open jobs", () => {
    const snapshot = fixture();
    const html = renderHiringAdsEmail(snapshot);
    expect(section(html)).toContain("Jobs marked open: BOI, SLC, STG");
    expect(section(html)).toContain("Sheet updated September 4");
    expect(section(html)).toContain("spend, clicks, and applications are unavailable from the sheet");
    expect(section(html)).not.toContain("<table");
    expect(section(html)).not.toContain("Raw sheet metadata");
    expect(section(html)).not.toContain("Company not entered");
    expect(section(html)).not.toContain("$0.00");
    expect(html.indexOf("Paused markets share")).toBeLessThan(html.indexOf(">Indeed</h2>"));
    expect(renderHiringAdsFullReport(snapshot)).toContain("Raw sheet metadata");
  });
  it("renders actual zeros as results and leaves zero-application cost undefined", () => {
    const snapshot = fixture();
    snapshot.indeedRows = [{ ...row("BOI"), spend: 0, clicks: 0, applications: 0 }];
    const html = section(renderHiringAdsEmail(snapshot));
    expect(html).toContain("<table");
    expect(html).toContain("$0.00");
    expect(html).toContain("N/A");
    expect(html).not.toContain("unavailable from the sheet");
  });
  it("calculates totals and weighted cost per application", () => {
    const snapshot = fixture();
    snapshot.indeedRows = [{ ...row("BOI"), spend: 240, clicks: 120, applications: 12 }, { ...row("SLC"), spend: 360, clicks: 180, applications: 18 }, { ...row("STG"), spend: 150, clicks: 75, applications: 10 }];
    const html = section(renderHiringAdsEmail(snapshot));
    expect(html).toContain("$750.00");
    expect(html).toContain("$18.75");
    expect(html).toContain("375");
  });
  it("keeps partial totals unavailable and preserves non-open job statuses", () => {
    const snapshot = fixture();
    snapshot.indeedRows[0] = { ...row("BOI"), spend: 240, applications: 12, status: "Inactive" };
    snapshot.indeedRows[1].status = "Needs review";
    const html = section(renderHiringAdsEmail(snapshot));
    expect(html).toContain("Jobs marked closed or paused: BOI");
    expect(html).toContain("Job status unknown: SLC");
    expect(html).toContain("Jobs marked open: STG");
    expect(html.split("<strong>Total</strong>")[1]).toContain("Unavailable");
  });
  it("does not hide isolated impressions, stale warnings, or source failures", () => {
    const snapshot = fixture();
    snapshot.indeedRows[0].impressions = 50;
    Object.assign(snapshot.sourceFetches[0], { freshnessWarning: "Sheet has not been updated for 20 days." });
    expect(section(renderHiringAdsEmail(snapshot))).toContain("Impressions: 50");
    expect(section(renderHiringAdsEmail(snapshot))).toContain("20 days");
    Object.assign(snapshot.sourceFetches[0], { status: "error" });
    const html = section(renderHiringAdsEmail(snapshot));
    expect(html).toContain("sheet could not be read");
    expect(html).not.toContain("Jobs marked open");
    expect(html).not.toContain("<table");
  });
});
