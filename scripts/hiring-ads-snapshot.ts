import { execFile, spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import {
  access,
  chmod,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const execFileAsync = promisify(execFile);

const AUTOMATION_ID = "sle-hiring-ads-weekly-snapshot";
const DEFAULT_AUTOMATION_HOME = path.join(
  process.env.CODEX_HOME || path.join(process.env.HOME || "/Users/brady", ".codex"),
  "automations",
  AUTOMATION_ID,
);
const REPO_DIR = "/Users/brady/workspace/sle/products/marketing-director-dashboard";
const CODEX_BIN = "/Users/brady/.npm-global/bin/codex";
const GWS_SLE = "/Users/brady/.agents/skills/gws/scripts/gws-sle";
const FROM = "Brady Price <brady.price@saltlakeexpress.com>";
const TO = "Greg Hendricks <greg.hendricks@saltlakeexpress.com>";
const CC = [
  "Jacob Price <jacob.price@saltlakeexpress.com>",
  "Brady Price <brady.price@saltlakeexpress.com>",
  "Drew Stone <drew@growmyads.com>",
].join(", ");

type CliOptions = {
  automationHome: string;
  force: boolean;
  dryRun: boolean;
  skipCodexSummary: boolean;
  renderPreviewDir: string | null;
};

type State = {
  lastSuccessPeriodKey?: string;
  lastSentMessageId?: string;
  lastSuccessAt?: string;
  lastSubject?: string;
};

function parseArgs(): { command: string; options: CliOptions } {
  const args = process.argv.slice(2);
  const command = args.shift() ?? "run";
  const options: CliOptions = {
    automationHome: DEFAULT_AUTOMATION_HOME,
    force: false,
    dryRun: false,
    skipCodexSummary: false,
    renderPreviewDir: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--automation-home") {
      options.automationHome = args[++i];
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--skip-codex-summary") {
      options.skipCodexSummary = true;
    } else if (arg === "--preview-dir") {
      options.renderPreviewDir = args[++i];
    }
  }

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
  const lockDir = path.join(automationHome, "state", "run.lock");
  try {
    await mkdir(lockDir, { mode: 0o700 });
  } catch {
    throw new Error(`Another ${AUTOMATION_ID} run appears to be active`);
  }

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
    return null;
  }
}

async function sendEmail(args: {
  subject: string;
  html: string;
  fullReportPath: string;
  dryRun: boolean;
}): Promise<{ sent: boolean; messageId: string | null; draft: boolean; error?: string }> {
  const baseArgs = [
    "gmail",
    "+send",
    "--to",
    TO,
    "--cc",
    CC,
    "--subject",
    args.subject,
    "--body",
    args.html,
    "--html",
    "--attach",
    path.basename(args.fullReportPath),
  ];
  const emailCwd = path.dirname(args.fullReportPath);

  if (args.dryRun) {
    await execFileAsync(GWS_SLE, [...baseArgs, "--dry-run"], {
      env: cleanProcessEnv(),
      cwd: emailCwd,
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });
    return { sent: false, messageId: null, draft: false };
  }

  try {
    const { stdout } = await execFileAsync(GWS_SLE, baseArgs, {
      env: cleanProcessEnv(),
      cwd: emailCwd,
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
    try {
      const { stdout } = await execFileAsync(GWS_SLE, [...baseArgs, "--draft"], {
        env: cleanProcessEnv(),
        cwd: emailCwd,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      });
      let messageId: string | null = null;
      try {
        messageId = firstMessageId(JSON.parse(stdout));
      } catch {
        messageId = null;
      }
      return { sent: false, messageId, draft: true, error: String(sendErr) };
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

function codexSummaryPrompt(reportDataJson: string): string {
  return [
    "You summarize a weekly Salt Lake Express hiring ads report.",
    "Return 2-4 plain-text bullet lines only. No Markdown symbols, no HTML.",
    "Do not invent numbers. Use only facts present in the JSON.",
    "Format money as dollars and cents, for example $333.69, not raw decimal JSON values.",
    "Mention active markets, needs-review items, unmapped hiring ads, and source failures if present.",
    "",
    reportDataJson,
  ].join("\n");
}

function runWithInput(
  command: string,
  args: string[],
  input: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_DIR,
      env: cleanProcessEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited ${code}: ${stderr.slice(0, 1200)}`));
      }
    });
    child.stdin.end(input);
  });
}

function extractCodexAgentMessage(raw: string): string | null {
  let lastMessage: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line) as {
        type?: string;
        item?: { type?: string; text?: string };
      };
      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        lastMessage = event.item.text ?? null;
      }
    } catch {
      // Codex may print non-JSON warnings before JSONL events.
    }
  }
  return lastMessage;
}

async function runCodexSummary(reportDataPath: string, runDir: string): Promise<string[] | null> {
  const authPath = "/Users/brady/.codex/auth.json";
  if (!(await exists(CODEX_BIN)) || !(await exists(authPath))) return null;

  await execFileAsync(CODEX_BIN, ["login", "status"], {
    env: cleanProcessEnv(),
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });

  const preflight = await runWithInput(
    CODEX_BIN,
    [
      "exec",
      "--sandbox",
      "read-only",
      "--cd",
      REPO_DIR,
      "--json",
      "--color",
      "never",
      "-",
    ],
    "Reply with OK only.",
    120000,
  );

  const preflightOutput = `${preflight.stdout}\n${preflight.stderr}`;
  const check = extractCodexAgentMessage(preflightOutput) ?? preflightOutput.trim();
  if (!/\bOK\.?\b/i.test(check)) return null;

  const reportDataJson = await readFile(reportDataPath, "utf8");
  const summary = await runWithInput(
    CODEX_BIN,
    [
      "exec",
      "--sandbox",
      "read-only",
      "--cd",
      REPO_DIR,
      "--json",
      "--color",
      "never",
      "-",
    ],
    codexSummaryPrompt(reportDataJson),
    180000,
  );

  const summaryOutput = `${summary.stdout}\n${summary.stderr}`;
  const raw = extractCodexAgentMessage(summaryOutput) ?? summaryOutput;
  await writePrivateText(path.join(runDir, "codex-summary.txt"), raw);
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

function summaryItemsToHtml(items: string[] | null, escapeHtml: (value: unknown) => string): string | undefined {
  if (!items || items.length === 0) return undefined;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

async function ensureDirs(automationHome: string): Promise<void> {
  await mkdir(path.join(automationHome, "outputs"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(automationHome, "logs"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(automationHome, "state"), { recursive: true, mode: 0o700 });
  await chmod(automationHome, 0o700);
}

async function run(options: CliOptions): Promise<void> {
  const {
    collectHiringAdSnapshot,
    escapeHtml,
    getPreviousMondaySunday,
    renderHiringAdsEmail,
    renderHiringAdsEml,
    renderHiringAdsFullReport,
    shouldRunWeeklySnapshot,
  } = await import("../src/lib/services/hiring-ads-snapshot");

  await ensureDirs(options.automationHome);
  const statePath = path.join(options.automationHome, "state", "state.json");
  const state = await readState(statePath);
  const schedule = getPreviousMondaySunday(new Date());
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

    const runDir = path.join(options.automationHome, "outputs", schedule.periodKey);
    await mkdir(runDir, { recursive: true, mode: 0o700 });

    const snapshot = await collectHiringAdSnapshot();
    const dataPath = path.join(runDir, "report-data.json");
    await writePrivateJson(dataPath, snapshot);

    let codexItems: string[] | null = null;
    if (!options.skipCodexSummary) {
      try {
        codexItems = await runCodexSummary(dataPath, runDir);
      } catch (err) {
        await writePrivateText(path.join(runDir, "codex-summary-error.txt"), String(err).slice(0, 1200));
      }
    }

    const aiSummaryHtml = summaryItemsToHtml(codexItems, escapeHtml);
    const fullReportHtml = renderHiringAdsFullReport(snapshot, aiSummaryHtml);
    const emailHtml = renderHiringAdsEmail(snapshot);
    const subject = `Weekly hiring ads snapshot - ${snapshot.reportPeriodLabel}`;
    const fullReportPath = path.join(runDir, "full-report.html");
    const emailPath = path.join(runDir, "email.html");
    const emlPath = path.join(runDir, "email.eml");
    await writePrivateText(fullReportPath, fullReportHtml);
    await writePrivateText(emailPath, emailHtml);
    await writePrivateText(emlPath, renderHiringAdsEml({
      from: FROM,
      to: TO,
      cc: CC,
      subject,
      html: emailHtml,
    }));

    const sentId = options.force ? null : await searchSentMail(subject).catch(() => null);
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

    const sendResult = await sendEmail({
      subject,
      html: emailHtml,
      fullReportPath,
      dryRun: options.dryRun,
    });

    if (sendResult.sent || sendResult.draft || options.dryRun) {
      await writePrivateJson(statePath, {
        ...refreshedState,
        lastSuccessPeriodKey: options.dryRun ? refreshedState.lastSuccessPeriodKey : schedule.periodKey,
        lastSentMessageId: sendResult.messageId ?? refreshedState.lastSentMessageId,
        lastSuccessAt: options.dryRun ? refreshedState.lastSuccessAt : new Date().toISOString(),
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
