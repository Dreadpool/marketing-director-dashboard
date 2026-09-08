import type {
  HiringAdSnapshot,
  HiringPlatformRow,
  IndeedComparisonRow,
} from "./hiring-ads-snapshot";

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const money = (value: number | null) =>
  value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(value);
const count = (value: number | null) =>
  value === null ? "Unavailable" : value.toLocaleString("en-US");
const ratio = (a: number | null, b: number | null) =>
  a === null || b === null || b === 0 ? null : a / b;
const sum = (rows: HiringPlatformRow[]) =>
  rows.some((r) => r.spend === null)
    ? null
    : rows.reduce((n, r) => n + (r.spend ?? 0), 0);
const googleRows = (snapshot: HiringAdSnapshot) =>
  snapshot.rows.filter((r) => r.platform === "Google Ads");
const current = (r: HiringPlatformRow) =>
  r.google?.currentState === "Enabled"
    ? "On"
    : r.google?.currentState === "Ad group paused" ||
        r.google?.currentState === "Campaign paused"
      ? "Paused"
      : r.google?.currentState === "Removed"
        ? "Removed"
        : "Unknown";
const delivery = (r: HiringPlatformRow) =>
  r.spend === null
    ? "Unavailable"
    : (r.impressions ?? 0) > 0 || (r.clicks ?? 0) > 0 || (r.spend ?? 0) > 0
      ? "Delivered"
      : "No delivery";
const cell =
  "padding:12px 9px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top;";
const monthLabel = (snapshot: HiringAdSnapshot) =>
  new Date(snapshot.mtdReportPeriod.start + "T12:00:00Z").toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric", timeZone: snapshot.timeZone },
  );
const checkedAt = (snapshot: HiringAdSnapshot) =>
  new Date(snapshot.generatedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: snapshot.timeZone,
  });
const small = "font-size:12px;line-height:1.5;color:#64748b;";

function table(headers: string[], rows: string[][]): string {
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>${headers.map((h) => `<th scope="col" style="${cell}background:#f6f9fc;color:#475569;font-size:11px;">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td style="${cell}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

// Keep the email's comparison columns narrow; supporting details span the row.
function emailTable(headers: string[], rows: { cells: string[]; detail: string }[], widths?: number[], numeric = false): string {
  const compactCell = "padding:12px 6px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere;";
  return `<table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:13px;line-height:1.5;"><thead><tr>${headers.map((h, i) => `<th scope="col" style="${compactCell}text-align:${numeric && i > 0 ? "right" : "left"};${widths ? `width:${widths[i]}%;` : ""}padding-bottom:12px;background:#f6f9fc;color:#475569;font-size:11px;">${esc(h)}</th>`).join("")}</tr></thead>${rows.map((row) => `<tbody><tr>${row.cells.map((c, i) => `<td style="${compactCell}text-align:${numeric && i > 0 ? "right" : "left"};">${c}</td>`).join("")}</tr><tr><td colspan="${headers.length}" style="padding:0 6px 14px;border-bottom:1px solid #e2e8f0;${small}overflow-wrap:anywhere;">${row.detail}</td></tr></tbody>`).join("")}</table>`;
}


function indeedSummary(snapshot: HiringAdSnapshot) {
  const source = snapshot.sourceFetches.find((f) => f.source === "Indeed sheet");
  const rows = !source || source.status === "error" || source.status === "skipped" ? [] : snapshot.indeedRows;
  const location = (r: IndeedComparisonRow) => r.company === "Unknown" ? r.market : `${r.market} / ${r.company}`;
  const statuses = [
    ["Active", "Jobs marked open"],
    ["Inactive", "Jobs marked closed or paused"],
    ["Needs review", "Job status unknown"],
  ].flatMap(([status, label]) => {
    const names = rows.filter((r) => r.status === status).map(location);
    return names.length ? [`${label}: ${names.join(", ")}`] : [];
  });
  const hasMetrics = rows.some((r) => [r.spend, r.clicks, r.applications, r.impressions, r.applyStarts].some((v) => v !== null));
  const notice = !source || source.status === "skipped"
    ? "Preview only: no live Indeed data fetched."
    : source.status === "error"
      ? `The ${monthLabel(snapshot)} sheet could not be read. Indeed results and job status are unavailable. See the full report for details.`
      : !rows.length
        ? "No driver jobs are listed in this month's Indeed sheet."
        : !hasMetrics
          ? `${monthLabel(snapshot)} spend, clicks, and applications are unavailable from the sheet.`
          : "";
  const modified = source?.modifiedAt && Number.isFinite(Date.parse(source.modifiedAt))
    ? new Date(source.modifiedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: snapshot.timeZone })
    : null;
  return { rows, statuses, hasMetrics, notice, modified, freshness: source?.freshnessWarning, location };
}

function indeedEmail(snapshot: HiringAdSnapshot): string {
  const summary = indeedSummary(snapshot);
  const total = (key: "spend" | "clicks" | "applications") =>
    summary.rows.some((r) => r[key] === null) ? null : summary.rows.reduce((n, r) => n + (r[key] ?? 0), 0);
  const cpa = (spend: number | null, applications: number | null) =>
    spend === null || applications === null ? "Unavailable" : applications === 0 ? "N/A" : money(spend / applications);
  const cells = (label: string, spend: number | null, applications: number | null, clicks: number | null) =>
    [`<strong>${esc(label)}</strong><div style="${small}">${esc(count(clicks))} clicks</div>`, esc(money(spend)), esc(count(applications)), esc(cpa(spend, applications))];
  return `<h2 style="font-size:17px;margin:26px 0 6px;">Indeed</h2>
    <p style="${small}margin:0 0 20px;">${esc(monthLabel(snapshot))}${summary.modified ? ` &middot; Sheet updated ${esc(summary.modified)}` : " &middot; Sheet update date unavailable"}</p>
    ${summary.statuses.map((line) => `<p style="font-size:13px;line-height:1.6;margin:0 0 16px;">${esc(line)}</p>`).join("")}
    ${summary.notice ? `<p style="font-size:13px;line-height:1.6;">${esc(summary.notice)}</p>` : ""}
    ${summary.hasMetrics ? emailTable(["Location", "Spend", "Applications", "Cost per application"], [
      ...summary.rows.map((r) => ({
        cells: cells(summary.location(r), r.spend, r.applications, r.clicks),
        detail: [r.impressions !== null ? `Impressions: ${esc(count(r.impressions))}` : "", r.applyStarts !== null ? `Apply starts: ${esc(count(r.applyStarts))}` : ""].filter(Boolean).join(" &middot; "),
      })),
      { cells: cells("Total", total("spend"), total("applications"), total("clicks")), detail: "" },
    ], undefined, true) : ""}
    ${summary.freshness ? `<p style="${small}">${esc(summary.freshness)}</p>` : ""}
    <p style="${small}margin:18px 0 0;">Open jobs do not confirm that paid ads are running.</p>`;
}

function sourceNote(snapshot: HiringAdSnapshot, source: string): string {
  const fetch = snapshot.sourceFetches.find((f) => f.source === source);
  if (!fetch || fetch.status === "skipped")
    return "Preview only: no live data fetched.";
  if (fetch.status === "ok") return "";
  return fetch.message ?? `${source}: ${fetch.status}`;
}

function checks(snapshot: HiringAdSnapshot): string[] {
  return [
    ...googleRows(snapshot).flatMap((r) =>
      (r.google?.issues ?? []).map((issue) => `${r.market}: ${issue}`),
    ),
    ...snapshot.sourceFetches
      .filter((f) => f.status === "error" || f.status === "warning")
      .map((f) => `${f.source}: ${f.message ?? f.status}`),
  ];
}

const limits =
  "On means both the campaign and ad-group switches are enabled, not guaranteed delivery. Coverage is the campaign's current geography; ad-group location interests can further restrict matching but do not define physical boundaries. Current settings do not describe last week's targeting. Spend belongs to the ad-group ID, not measured city residents, and includes groups now paused. Google applications and cost per application are not tracked. Indeed uses a separate monthly sheet. All checks are fixed rules, not AI analysis or a complete audit of ad copy and targeting.";

export function snapshotEmail(snapshot: HiringAdSnapshot): string {
  const google = googleRows(snapshot);
  const weeklySpend = sourceNote(snapshot, "Google Ads")
    ? "Unavailable"
    : money(sum(google));
  const issues = google.flatMap((r) =>
    (r.google?.issues ?? []).map((issue) => `${r.market}: ${issue}`),
  );
  const reportUrl = snapshot.reportUrl?.startsWith("https://")
    ? snapshot.reportUrl
    : null;
  const mtd = new Map(
    snapshot.mtdRows
      .filter((r) => r.platform === "Google Ads")
      .map((r) => [r.sourceIds[0], r]),
  );
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:600px;background:#ffffff;border:1px solid #dbe4ee;border-radius:12px;overflow-wrap:anywhere;">
    <div style="padding:20px;background:#f6f9fc;border-bottom:1px solid #dbe4ee;border-radius:12px 12px 0 0;">
      <div style="color:#1e6fad;font-size:11px;letter-spacing:1px;font-weight:700;">SALT LAKE EXPRESS</div>
      <h1 style="font-size:24px;line-height:1.2;margin:8px 0;">Weekly Driver Hiring Ads Snapshot</h1>
      <div style="${small}">${esc(snapshot.reportPeriodLabel)}</div>
    </div>
    <div style="padding:20px;">
      <h2 style="font-size:17px;margin:0 0 6px;">Google Ads</h2>
      <p style="${small}margin:0 0 6px;">Weekly spend: <strong style="color:#0f172a;">${esc(weeklySpend)}</strong> &middot; ${google.length} ad groups</p>
      <p style="${small}margin:0 0 16px;">Ads now: checked ${esc(checkedAt(snapshot))}. On means enabled, not guaranteed to be showing.</p>
      ${sourceNote(snapshot, "Google Ads") ? `<p style="${small}">${esc(sourceNote(snapshot, "Google Ads"))}</p>` : ""}
      ${emailTable(
        [
          "Market",
          "Ads now",
          "Weekly spend",
          "Weekly clicks",
        ],
        google.map((r) => ({
          cells: [
            `<strong>${esc(r.market)}</strong>`,
            `<strong style="color:${current(r) === "On" ? "#166534" : "#475569"};">${esc(current(r))}</strong>`,
            esc(money(r.spend)),
            esc(count(r.clicks)),
          ],
          detail: `Last week: ${esc(count(r.impressions))} impressions &middot; ${esc(r.clicks === null || r.spend === null ? "Unavailable" : r.clicks ? money(ratio(r.spend, r.clicks)) : "N/A")} per click.${r.google?.currentState === "Enabled" ? `<div>Campaign coverage now: ${esc(r.google.campaignTargets.join("; ") || "No positive locations")}</div>` : ""}`,
        })),
        [30, 24, 26, 20],
      )}
      <p style="${small}">Google month to date (${esc(snapshot.mtdReportPeriodLabel)}, includes today, partial): ${esc(sourceNote(snapshot, "Google Ads MTD") ? "Unavailable" : money(sum(snapshot.mtdRows.filter((r) => r.platform === "Google Ads"))))}. ${google.filter((r) => mtd.has(r.sourceIds[0])).length ? "Per-group monthly totals are in the full report." : ""}</p>
      <p style="${small}">Paused markets share their parent campaign\'s coverage. Check that coverage before turning them on. New ad groups appear automatically; shop coverage approval is separate.</p>
      ${issues.length ? `<h2 style="font-size:16px;margin:24px 0 8px;">Configuration checks</h2>${issues.map((issue) => `<p style="font-size:13px;color:#92400e;line-height:1.5;">${esc(issue)}</p>`).join("")}` : ""}
      ${indeedEmail(snapshot)}
      <p style="${small}margin-top:24px;">${esc(limits)}</p>
      ${reportUrl ? `<a href="${esc(reportUrl)}" style="display:inline-block;background:#1e6fad;color:white;padding:12px 16px;text-decoration:none;border-radius:6px;">Open full report</a>` : `<p style="${small}">The full HTML report is attached in this dry run.</p>`}
    </div>
  </div>`;
}

export function snapshotText(snapshot: HiringAdSnapshot): string {
  const indeed = indeedSummary(snapshot);
  return [
    "Weekly Driver Hiring Ads Snapshot",
    snapshot.reportPeriodLabel,
    "",
    "Google Ads:",
    ...googleRows(snapshot).map(
      (r) =>
        `${r.market}: ${current(r)} now; ${delivery(r)} during week. Spend ${money(r.spend)}, shown ${count(r.impressions)}, clicks ${count(r.clicks)}. Campaign coverage: ${r.google?.campaignTargets.join("; ") || "Unavailable"}. Ad-group location interests: ${r.google?.locationInterests.join("; ") || "None"}. ${r.google?.presence ?? ""}.`,
    ),
    "",
    `Indeed monthly sheet: ${monthLabel(snapshot)}`,
    ...indeed.statuses,
    ...(indeed.modified ? [`Sheet updated ${indeed.modified}`] : []),
    ...(indeed.notice ? [indeed.notice] : []),
    ...(indeed.hasMetrics ? indeed.rows : []).map(
      (r) =>
        `${r.market} / ${r.company}: spend ${money(r.spend)}, clicks ${count(r.clicks)}, applications ${count(r.applications)}, cost per application ${r.applications === null || r.spend === null ? "Unavailable" : r.applications ? money(ratio(r.spend, r.applications)) : "N/A"}.`,
    ),
    ...(indeed.rows.length ? [] : ["Indeed spend: Unavailable"]),
    "Open jobs do not confirm that paid ads are running.",
    "",
    ...checks(snapshot),
    "",
    limits,
    snapshot.reportUrl?.startsWith("https://")
      ? `Open full report: ${snapshot.reportUrl}`
      : "The full HTML report is attached.",
  ].join("\n");
}

export function snapshotFullReport(snapshot: HiringAdSnapshot): string {
  const detail = (rows: HiringPlatformRow[]) =>
    table(
      [
        "Ad group / market",
        "Platform",
        "Spend",
        "Shown",
        "Clicks",
        "Source IDs",
        "Configuration",
      ],
      rows.map((r) => [
        esc(r.market),
        esc(r.platform),
        esc(money(r.spend)),
        esc(count(r.impressions)),
        esc(count(r.clicks)),
        esc(r.sourceIds.join(", ")),
        esc(r.notes),
      ]),
    );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hiring snapshot ${esc(snapshot.reportPeriodLabel)}</title></head><body style="margin:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    ${snapshotEmail({ ...snapshot, reportUrl: null }).replace("The full HTML report is attached in this dry run.", "Source details follow below.")}
    <h2>Current Google settings</h2><p>Physical coverage is shared by every ad group in the campaign. Location interests are an additional matching filter. A DMA is a television market region, not city limits. The approved-circle check verifies physical coverage only; it does not certify ad copy or every matching setting.</p>
    ${table(
      [
        "Market / campaign",
        "Switches now",
        "Campaign coverage",
        "Location matching",
        "Ad-group location interests",
        "Google delivery status",
        "Shop coverage check",
      ],
      googleRows(snapshot).map((r) => [
        esc(`${r.market} / ${r.google?.campaignName}`),
        esc(r.google?.currentState ?? "Unknown"),
        esc(r.google?.campaignTargets.join("; ") || "No positive locations"),
        esc(r.google?.presence),
        esc(r.google?.locationInterests.join("; ") || "None (optional)"),
        esc(r.google?.deliveryStatus),
        esc(r.google?.coverageCheck),
      ]),
    )}
    <h2>Weekly platform detail</h2>${detail(snapshot.rows)}
    <h2>Month-to-date platform detail: ${esc(snapshot.mtdReportPeriodLabel)}</h2>${detail(snapshot.mtdRows)}
    <h2>Indeed monthly source detail</h2>${table(
      [
        "Source market",
        "Company",
        "Shown",
        "Apply starts",
        "Sheet rows",
        "Notes",
      ],
      snapshot.indeedRows.map((r) => [
        esc(r.market),
        esc(r.company),
        esc(count(r.impressions)),
        esc(count(r.applyStarts)),
        esc(r.sourceRows),
        esc(r.notes),
      ]),
    )}
    <h2>Unmapped Meta hiring ads</h2>${table(
      ["Platform", "Name", "Spend", "Note"],
      snapshot.unmappedHiringAds.map((r) => [
        esc(r.platform),
        esc(r.name),
        esc(money(r.spend)),
        esc(r.notes),
      ]),
    )}
    <h2>Sources</h2>${table(
      ["Source", "Status", "Fetched at", "Notes"],
      snapshot.sourceFetches.map((f) => [
        esc(f.source),
        esc(f.status),
        esc(f.fetchedAt),
        esc(f.message),
      ]),
    )}
    <h2>Google accounting checks</h2>${(snapshot.googleAudit ?? [])
      .map(
        (a) =>
          `<p>${esc(a.period.start)} to ${esc(a.period.end)}: all hiring campaign spend ${esc(money(a.campaignSpend))} = reported driver-group spend ${esc(money(a.reportedSpend))} + excluded group spend ${esc(money(a.excluded.reduce((n, r) => n + r.spend, 0)))}. Campaign and ad-group impressions and clicks also reconcile.</p>${table(
            ["Excluded campaign / group", "ID", "Spend", "Reason"],
            a.excluded.map((r) => [
              esc(`${r.campaign} / ${r.adGroup}`),
              esc(r.id),
              esc(money(r.spend)),
              esc(r.reason),
            ]),
          )}`,
      )
      .join("")}
  </body></html>`;
}
