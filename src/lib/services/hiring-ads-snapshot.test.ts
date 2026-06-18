import { describe, expect, it } from "vitest";
import {
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
});
