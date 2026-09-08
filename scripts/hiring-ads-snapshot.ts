import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  chmod,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const execFileAsync = promisify(execFile);

const AUTOMATION_ID = "sle-hiring-ads-weekly-snapshot";
const REPO_DIR = "/Users/brady/workspace/sle/marketing/marketing-director-dashboard";
const DEFAULT_AUTOMATION_HOME = path.join(
  REPO_DIR,
  "automations",
  "hiring-ads-weekly-snapshot",
  "runtime",
);
const GWS_SLE = "/Users/brady/.agents/skills/gws/scripts/gws-sle";
const VERCEL_BIN = "/Users/brady/.npm-global/bin/vercel";
const SHARE_ARTIFACTS_DIR = "/Users/brady/workspace/references/share-artifacts";
const SHARE_ARTIFACTS_BASE_URL = "https://share-artifacts.vercel.app";
const FROM = "Brady Price <brady.price@saltlakeexpress.com>";
const TO = "Greg Hendricks <greg.hendricks@saltlakeexpress.com>";
const CC = [
  "Jacob Price <jacob.price@saltlakeexpress.com>",
  "Brady Price <brady.price@saltlakeexpress.com>",
  "Drew Stone <drew@growmyads.com>",
].join(", ");
const LOCK_STALE_MS = 6 * 60 * 60 * 1000;

type CliOptions = {
  automationHome: string;
  force: boolean;
  dryRun: boolean;
  renderPreviewDir: string | null;
  to: string;
  cc: string;
  testRun: boolean;
  correction: boolean;
};

type State = {
  lastSuccessPeriodKey?: string;
  lastSentMessageId?: string;
  lastSuccessAt?: string;
  lastSubject?: string;
  lastDraftPeriodKey?: string;
  lastDraftMessageId?: string;
  lastDraftAt?: string;
  lastDraftSubject?: string;
  lastSourceBlockedPeriodKey?: string;
  lastSourceBlockedAt?: string;
  lastSourceBlockedMessage?: string;
};

function parseArgs(): { command: string; options: CliOptions } {
  const args = process.argv.slice(2);
  const command = args.shift() ?? "run";
  const options: CliOptions = {
    automationHome: DEFAULT_AUTOMATION_HOME,
    force: false,
    dryRun: false,
    renderPreviewDir: null,
    to: TO,
    cc: CC,
    testRun: false,
    correction: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--automation-home") {
      options.automationHome = args[++i];
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--preview-dir") {
      options.renderPreviewDir = args[++i];
    } else if (arg === "--to") {
      options.to = args[++i];
    } else if (arg === "--cc") {
      options.cc = args[++i] ?? "";
    } else if (arg === "--test-run") {
      options.testRun = true;
    } else if (arg === "--correction") {
      options.correction = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.force && !options.dryRun && !options.testRun) {
    throw new Error("--force requires --dry-run or an explicitly requested --test-run");
  }
  if (options.correction && options.testRun) throw new Error("A correction is not a test run");
  return { command, options };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readState(statePath: string): Promise<State> {
  if (!(await exists(statePath))) return {};
  try {
    return JSON.parse(await readFile(statePath, "utf8")) as State;
  } catch {
    return {};
  }
}

async function writePrivateJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(filePath, 0o600);
}

async function writePrivateText(filePath: string, value: string): Promise<void> {
  await writeFile(filePath, value, { mode: 0o600 });
  await chmod(filePath, 0o600);
}

async function withLock<T>(automationHome: string, fn: () => Promise<T>): Promise<T> {
  const lockDir = path.join(automationHome, "run.lock");
  try {
    await mkdir(lockDir, { mode: 0o700 });
  } catch {
    const lockStat = await stat(lockDir).catch(() => null);
    const lockAgeMs = lockStat ? Date.now() - lockStat.mtimeMs : 0;
    if (!lockStat || lockAgeMs < LOCK_STALE_MS) {
      throw new Error(`Another ${AUTOMATION_ID} run appears to be active`);
    }
    await rm(lockDir, { recursive: true, force: true });
    await mkdir(lockDir, { mode: 0o700 });
  }
  await writePrivateJson(path.join(lockDir, "metadata.json"), {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  });

  try {
    return await fn();
  } finally {
    await rm(lockDir, { recursive: true, force: true });
  }
}

function cleanProcessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: "/Users/brady",
    CODEX_HOME: "/Users/brady/.codex",
    PATH: "/Users/brady/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    TZ: "America/Denver",
  };
}

function createReportPublication(periodKey: string): { filePath: string; url: string } {
  const slug = `${periodKey}-${randomBytes(6).toString("hex")}`;
  const relativePath = path.join("sle-hiring-ads", slug, "index.html");
  return {
    filePath: path.join(SHARE_ARTIFACTS_DIR, relativePath),
    url: `${SHARE_ARTIFACTS_BASE_URL}/sle-hiring-ads/${slug}/`,
  };
}

async function publishFullReport(html: string, publication: { filePath: string; url: string }): Promise<string> {
  await mkdir(path.dirname(publication.filePath), { recursive: true });
  await writeFile(publication.filePath, html, "utf8");
  await execFileAsync(VERCEL_BIN, ["deploy", "--prod", "--yes", "--scope", "dreadpools-projects"], {
    cwd: SHARE_ARTIFACTS_DIR,
    env: cleanProcessEnv(),
    timeout: 300000,
    maxBuffer: 1024 * 1024 * 4,
  });
  const response = await fetch(publication.url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || (await response.text()) !== html) {
    throw new Error("Published hiring report did not match the validated HTML; email not sent");
  }
  return publication.url;
}

function firstMessageId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.id === "string") return record.id;
    for (const child of Object.values(record)) {
      const found = firstMessageId(child);
      if (found) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = firstMessageId(child);
      if (found) return found;
    }
  }
  return null;
}

async function searchSentMail(subject: string): Promise<string | null> {
  const params = {
    userId: "me",
    q: `in:sent subject:"${subject.replace(/"/g, "")}"`,
    maxResults: 5,
  };
  const { stdout } = await execFileAsync(
    GWS_SLE,
    ["gmail", "users", "messages", "list", "--params", JSON.stringify(params)],
    { env: cleanProcessEnv(), timeout: 60000, maxBuffer: 1024 * 1024 },
  );
  try {
    return firstMessageId(JSON.parse(stdout));
  } catch {
    throw new Error("Gmail sent-mail lookup returned invalid JSON");
  }
}

async function sendEmail(args: {
  rawMessage: string;
  dryRun: boolean;
  allowDraftFallback: boolean;
}): Promise<{ sent: boolean; messageId: string | null; draft: boolean; error?: string }> {
  const raw = Buffer.from(args.rawMessage, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const sendArgs = [
    "gmail",
    "users",
    "messages",
    "send",
    "--params",
    JSON.stringify({ userId: "me" }),
    "--json",
    JSON.stringify({ raw }),
  ];

  if (args.dryRun) {
    return { sent: false, messageId: null, draft: false };
  }

  try {
    const { stdout } = await execFileAsync(GWS_SLE, sendArgs, {
      env: cleanProcessEnv(),
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    let messageId: string | null = null;
    try {
      messageId = firstMessageId(JSON.parse(stdout));
    } catch {
      messageId = null;
    }
    return { sent: true, messageId, draft: false };
  } catch (sendErr) {
    if (!args.allowDraftFallback) {
      return {
        sent: false,
        messageId: null,
        draft: false,
        error: `send failed: ${String(sendErr).slice(0, 300)}; automatic draft retry disabled`,
      };
    }

    try {
      const { stdout } = await execFileAsync(GWS_SLE, [
        "gmail",
        "users",
        "drafts",
        "create",
        "--params",
        JSON.stringify({ userId: "me" }),
        "--json",
        JSON.stringify({ message: { raw } }),
      ], {
        env: cleanProcessEnv(),
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      });
      let draftId: string | null = null;
      try {
        draftId = firstMessageId(JSON.parse(stdout));
      } catch {
        draftId = null;
      }

      if (!draftId) {
        return {
          sent: false,
          messageId: null,
          draft: true,
          error: `send failed: ${String(sendErr).slice(0, 300)}; draft created but draft id was not returned`,
        };
      }

      try {
        const { stdout: sendDraftStdout } = await execFileAsync(GWS_SLE, [
          "gmail",
          "users",
          "drafts",
          "send",
          "--params",
          JSON.stringify({ userId: "me" }),
          "--json",
          JSON.stringify({ id: draftId }),
        ], {
          env: cleanProcessEnv(),
          timeout: 120000,
          maxBuffer: 1024 * 1024,
        });
        let sentMessageId: string | null = null;
        try {
          sentMessageId = firstMessageId(JSON.parse(sendDraftStdout));
        } catch {
          sentMessageId = null;
        }
        return { sent: true, messageId: sentMessageId, draft: false, error: `raw send failed; draft-send fallback succeeded: ${String(sendErr).slice(0, 180)}` };
      } catch (draftSendErr) {
        return {
          sent: false,
          messageId: draftId,
          draft: true,
          error: `send failed: ${String(sendErr).slice(0, 300)}; draft-send failed: ${String(draftSendErr).slice(0, 300)}`,
        };
      }
    } catch (draftErr) {
      return {
        sent: false,
        messageId: null,
        draft: false,
        error: `send failed: ${String(sendErr).slice(0, 300)}; draft failed: ${String(draftErr).slice(0, 300)}`,
      };
    }
  }
}

async function notify(title: string, message: string): Promise<void> {
  try {
    await execFileAsync("/usr/bin/osascript", [
      "-e",
      `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`,
    ], { timeout: 10000 });
  } catch {
    // Notification failure should not hide the real report result.
  }
}

async function ensureDirs(automationHome: string): Promise<void> {
  await mkdir(path.join(automationHome, "runs"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(automationHome, "logs"), { recursive: true, mode: 0o700 });
  await chmod(automationHome, 0o700);
}

async function run(options: CliOptions): Promise<void> {
  const {
    collectHiringAdSnapshot,
    getBlockingHiringSourceFailures,
    getPreviousMondaySunday,
    renderHiringAdsEmail,
    renderHiringAdsEml,
    renderHiringAdsFullReport,
    renderHiringAdsText,
    shouldRunWeeklySnapshot,
  } = await import("../src/lib/services/hiring-ads-snapshot");

  await ensureDirs(options.automationHome);
  const schedule = getPreviousMondaySunday(new Date());
  const weeklyStatePath = path.join(options.automationHome, "state.json");
  if (options.correction) {
    const weeklyState = await readState(weeklyStatePath);
    if (weeklyState.lastSuccessPeriodKey !== schedule.periodKey) {
      throw new Error("A correction requires an already-sent weekly report for this period");
    }
  }
  const statePath = options.correction
    ? path.join(options.automationHome, `correction-${schedule.periodKey}.json`)
    : weeklyStatePath;
  const state = await readState(statePath);
  const due = shouldRunWeeklySnapshot(state, { force: options.force });
  if (!due.shouldRun) {
    console.log(JSON.stringify({ status: "skipped", reason: due.reason, periodKey: due.periodKey }));
    return;
  }

  await withLock(options.automationHome, async () => {
    const refreshedState = await readState(statePath);
    const refreshedDue = shouldRunWeeklySnapshot(refreshedState, { force: options.force });
    if (!refreshedDue.shouldRun) {
      console.log(JSON.stringify({ status: "skipped", reason: refreshedDue.reason, periodKey: refreshedDue.periodKey }));
      return;
    }

    const runDir = path.join(
      options.automationHome,
      "runs",
      options.dryRun || options.testRun || options.correction ? `${schedule.periodKey}-${options.dryRun ? "preview" : options.correction ? "correction" : "test"}-${new Date().toISOString().replace(/[:.]/g, "-")}` : schedule.periodKey,
    );
    await mkdir(runDir, { recursive: true, mode: 0o700 });

    const publication = createReportPublication(schedule.periodKey);
    const snapshot = await collectHiringAdSnapshot({
      reportUrl: options.dryRun ? null : publication.url,
    });
    const dataPath = path.join(runDir, "report-data.json");
    await writePrivateJson(dataPath, snapshot);

    const blockingFailures = getBlockingHiringSourceFailures(snapshot.sourceFetches);
    if (blockingFailures.length > 0) {
      const sourceMessage = blockingFailures
        .map((failure) => `${failure.source}: ${failure.message ?? failure.status}`)
        .join("; ");
      await writePrivateText(path.join(runDir, "source-error.txt"), sourceMessage);

      if (!options.dryRun && !options.testRun) {
        if (refreshedState.lastSourceBlockedPeriodKey !== schedule.periodKey) {
          await notify(
            "Hiring ads report delayed",
            `Required data is incomplete for ${schedule.periodKey}. The hourly runner will retry.`,
          );
        }
        await writePrivateJson(statePath, {
          ...refreshedState,
          lastSourceBlockedPeriodKey: schedule.periodKey,
          lastSourceBlockedAt: new Date().toISOString(),
          lastSourceBlockedMessage: sourceMessage,
        });
      }

      throw new Error(`Hiring ads report not sent because required data is incomplete: ${sourceMessage}`);
    }

    const fullReportHtml = renderHiringAdsFullReport(snapshot);
    const correctionNote = "This updated snapshot replaces the earlier report for this week. It shows current Google ad-group status and campaign coverage. Indeed is reported separately.";
    const emailHtml = (options.correction ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;max-width:600px;">${correctionNote}</p>` : "") + renderHiringAdsEmail(snapshot);
    const emailText = (options.correction ? `${correctionNote}\n\n` : "") + renderHiringAdsText(snapshot);
    const subject = `${options.testRun ? "[TEST] " : options.correction ? "[Updated] " : ""}Weekly ${snapshot.reportPosition.toLowerCase()} hiring ads snapshot - ${snapshot.reportPeriodLabel}`;
    const fullReportPath = path.join(runDir, "full-report.html");
    const emailPath = path.join(runDir, "email.html");
    const emailTextPath = path.join(runDir, "email.txt");
    const emlPath = path.join(runDir, "email.eml");
    await writePrivateText(fullReportPath, fullReportHtml);
    await writePrivateText(emailPath, emailHtml);
    await writePrivateText(emailTextPath, emailText);
    const rawEmail = renderHiringAdsEml({
      from: FROM,
      to: options.to,
      cc: options.cc,
      subject,
      text: emailText,
      html: emailHtml,
      attachment: snapshot.reportUrl
        ? undefined
        : {
          filename: "full-report.html",
          contentType: "text/html; charset=UTF-8",
          base64: Buffer.from(fullReportHtml, "utf8").toString("base64"),
        },
    });
    await writePrivateText(emlPath, rawEmail);

    const sentId = options.dryRun || options.testRun ? null : await searchSentMail(subject);
    if (sentId) {
      await writePrivateJson(statePath, {
        ...refreshedState,
        lastSuccessPeriodKey: schedule.periodKey,
        lastSentMessageId: sentId,
        lastSuccessAt: new Date().toISOString(),
        lastSubject: subject,
      });
      console.log(JSON.stringify({ status: "skipped", reason: "already in sent mail", messageId: sentId, subject }));
      return;
    }

    if (!options.dryRun) {
      await publishFullReport(fullReportHtml, publication);
    }
    const sendResult = await sendEmail({
      rawMessage: rawEmail,
      dryRun: options.dryRun,
      allowDraftFallback: !options.correction && refreshedState.lastDraftPeriodKey !== schedule.periodKey,
    });

    if (sendResult.sent || options.dryRun) {
      if (options.testRun || options.dryRun) {
        console.log(JSON.stringify({
          status: options.dryRun ? "dry-run" : sendResult.sent ? "sent" : "drafted",
          testRun: options.testRun,
          subject,
          messageId: sendResult.messageId,
          recipients: { to: options.to, cc: options.cc },
          runDir,
        }));
        return;
      }
      await writePrivateJson(statePath, {
        ...refreshedState,
        lastSuccessPeriodKey: schedule.periodKey,
        lastSentMessageId: sendResult.messageId ?? refreshedState.lastSentMessageId,
        lastSuccessAt: new Date().toISOString(),
        lastSubject: subject,
      });
      console.log(JSON.stringify({
        status: options.dryRun ? "dry-run" : sendResult.sent ? "sent" : "drafted",
        subject,
        messageId: sendResult.messageId,
        runDir,
      }));
      return;
    }

    if (sendResult.draft) {
      if (options.testRun) {
        await writePrivateText(path.join(runDir, "send-error.txt"), sendResult.error ?? "Email send failed; test draft created.");
        console.log(JSON.stringify({
          status: "drafted",
          testRun: true,
          subject,
          messageId: sendResult.messageId,
          recipients: { to: options.to, cc: options.cc },
          runDir,
        }));
        return;
      }
      await writePrivateJson(statePath, {
        ...refreshedState,
        lastDraftPeriodKey: schedule.periodKey,
        lastDraftMessageId: sendResult.messageId ?? refreshedState.lastDraftMessageId,
        lastDraftAt: new Date().toISOString(),
        lastDraftSubject: subject,
      });
      await notify("Hiring ads report drafted, not sent", `A Gmail draft was created for ${subject}. The hourly runner will retry sending.`);
      await writePrivateText(path.join(runDir, "send-error.txt"), sendResult.error ?? "Email send failed; draft created.");
      throw new Error(`Email not sent. Gmail draft created and local files saved at ${runDir}`);
    }

    await notify("Hiring ads report not sent", `Saved unsent email files at ${runDir}`);
    await writePrivateText(path.join(runDir, "send-error.txt"), sendResult.error ?? "Unknown send error");
    throw new Error(`Email not sent. Local files saved at ${runDir}`);
  });
}

async function renderPreview(options: CliOptions): Promise<void> {
  const {
    renderHiringAdsEmail,
    renderHiringAdsFullReport,
    typeOnlyPreviewSnapshot,
  } = await import("../src/lib/services/hiring-ads-snapshot-preview");

  if (!options.renderPreviewDir) throw new Error("--preview-dir is required");
  await mkdir(options.renderPreviewDir, { recursive: true });
  const snapshot = typeOnlyPreviewSnapshot();
  await writeFile(path.join(options.renderPreviewDir, "hiring-ads-dashboard.html"), renderHiringAdsFullReport(snapshot), "utf8");
  await writeFile(path.join(options.renderPreviewDir, "hiring-ads-email-preview.html"), `<!doctype html><html><head><meta charset="utf-8"><title>Email Preview</title></head><body>${renderHiringAdsEmail(snapshot)}</body></html>`, "utf8");
}

async function main(): Promise<void> {
  process.umask(0o077);
  const { command, options } = parseArgs();

  if (command === "run") {
    await run(options);
  } else if (command === "render-preview") {
    await renderPreview(options);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
