---
title: feat: Add Hiring Ads Local Runner
type: feat
status: completed
date: 2026-06-18
---

# feat: Add Hiring Ads Local Runner

## Overview

Create a reliable local weekly runner for the SLE hiring ads snapshot. The runner should use Brady's local Codex subscription login, read local dashboard/ad-platform credentials, generate a full HTML report plus a simpler HTML email, and send the report to Greg with Jacob, Brady, and Drew copied.

This plan deliberately does not create a Vercel scheduled job for this first version. A Vercel job cannot safely use Brady's desktop Codex or Claude subscription session without moving a password-like local auth file into cloud infrastructure. The maintainable subscription-auth pilot is a Mac `launchd` job that runs after wake/boot and calls Codex CLI locally. The long-term cloud version would use proper platform credentials and Vercel AI Gateway/API auth, not desktop subscription auth.

---

## Problem Frame

Greg and Jacob need a weekly answer to: which hiring markets are active, which platforms are running, how much has been spent, what delivery happened, whether hiring conversion rate is tracked, and what changed or needs action. The first report prototype was useful, but it risked missing hiring campaigns that were not pre-listed and included static numbers that should not be trusted unless freshly fetched.

---

## Requirements Trace

- R1. Confirm the local automation home and keep this automation's runnable files there.
- R2. Discover hiring ads dynamically by campaign, ad group, ad set, ad, text, and destination URL, not only by the requested Omak, St. George, and Pocatello markets.
- R3. Show active hiring markets as top green cards; the count may be 0, 1, or many.
- R4. Use simple status language for Greg: `Active`, `Inactive`, or `Needs review`.
- R5. Use no mocked numbers in the report or email preview.
- R6. Send every Monday at 9 AM Mountain Time, and run once after the Mac wakes or boots if the scheduled run was missed.
- R7. Send from SLE Gmail to Greg, cc Jacob, Brady, and Drew.
- R8. Use Brady's local Codex subscription auth, not an AI API key.
- R9. Pause the old Codex app automation so duplicate emails are not sent.
- R10. Use the previous Monday-Sunday period in SLE Mountain Time, and show report period, generated time, and source fetch times.
- R11. Show unmapped hiring ads separately when a hiring ad is discovered but no market can be confidently parsed.

---

## Scope Boundaries

- Do not mutate Google Ads, Meta Ads, campaign budgets, statuses, creatives, ad groups, ad sets, or account settings.
- Do not claim a hosted full-report link exists unless a real URL is configured.
- Do not use GA4 website sessions as hiring ad performance when applications land on IntelliApp or another external hiring system.
- Do not create a Vercel job that depends on Brady's desktop subscription session.
- Do not let AI-generated content choose email recipients or add external links.

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/services/google-ads.ts` already uses the Google Ads REST API and local Google auth.
- `src/lib/services/meta-ads.ts` already uses the Meta Marketing API and local env credentials.
- `src/lib/workflows/executors/fetch-meta-ads.ts` already separates hiring campaigns from passenger-acquisition campaigns.
- `CLAUDE.md` documents the dashboard's env vars and read-only data-source conventions.
- `~/.agents/skills/gws/scripts/gws-sle` is the correct SLE Gmail wrapper.
- `~/.codex/automations/sle-hiring-ads-weekly-snapshot/automation.toml` is the existing Codex app automation.
- GA4 diagnostics, if included, should use `/Users/brady/workspace/sle/analytics/ga4-data-analysis` as the source setup and must stay diagnostic only.
- Existing ad services do not currently fetch everything this report needs: Google Ads campaign-level data exists, but ad/ad-group text and final URLs need new GAQL queries; Meta insights exist, but effective status, destination URLs, and creative/copy inventory need new read-only Marketing API calls.

### Platform Behavior

- Codex app automations are local and require the Mac and Codex app to be running at the scheduled time.
- macOS `launchd` with `StartCalendarInterval` runs after wake when a calendar fire was missed during sleep.
- `RunAtLoad` plus a state file lets the runner catch up after a full power-off/boot.

---

## Key Technical Decisions

- Use `launchd` for scheduling and wake/boot catch-up because it is the Mac-native scheduler and handles missed sleep events better than the Codex app automation. Because `launchd` uses the Mac's local clock, the LaunchAgent should run hourly and the runner should gate sends against `America/Denver` so the report sends after Monday 9 AM Mountain Time regardless of Brady's current machine timezone.
- Use deterministic TypeScript collection to own operational numbers. The collector writes `report-data.json` with source, date range, fetched-at time, missing-data flags, and a shared `HiringAdSnapshot` shape before any AI summary runs.
- Use `codex exec` only for summary language after `report-data.json` passes validation. Codex must not choose recipients, invent numbers, send email, or decide whether data exists.
- Resolve the automation home once as `${CODEX_HOME:-$HOME/.codex}/automations/sle-hiring-ads-weekly-snapshot`, then put the prompt, runner, state, logs, and generated report outputs there.
- Keep the full report and email report HTML generated from a single runner-owned template/source of truth. Empty states must say data is pending or unavailable, never invent numbers.
- Hard-code To/Cc recipients in the runner, not in AI-generated content.
- Render ad-platform names, ad text, and URLs as untrusted input: escape visible text and validate report links before email/report output.
- Preflight Codex auth with `codex login status`, local `auth.json` shape, and a tiny non-interactive `codex exec` check. If Codex fails, the deterministic report can still send with a note that the AI summary was unavailable.
- Before sending, check SLE Gmail sent mail for the report-period subject and record the sent message ID in state to prevent duplicates.

---

## Implementation Units

- U0. **Pause Old Codex App Automation**

**Goal:** Disable the existing Codex app cron automation before enabling the new runner.

**Requirements:** R9

**Dependencies:** None

**Files:**
- Modify: Codex app automation state through the Codex automation tool

**Approach:**
- Update `sle-hiring-ads-weekly-snapshot` to `PAUSED`.
- Preserve the existing prompt as historical context unless the Codex automation tool requires a full replacement.

**Test scenarios:**
- Happy path: Codex app automation reports `PAUSED`.

**Verification:**
- Automation state shows paused before the LaunchAgent is enabled.

- U1. **Create Local Runner and Prompt**

**Goal:** Add a shell runner, deterministic collector/report generator, and Codex summary prompt under the hiring ads automation directory.

**Requirements:** R1, R2, R4, R5, R7, R8, R10, R11

**Dependencies:** U0

**Files:**
- Create: external Codex automation runner files under `CODEX_HOME`

**Approach:**
- Add a shared `HiringAdSnapshot` output shape with market rows, unmapped hiring ads, source fetch states, report period, generated time, and summary/action-needed fields.
- Add read-only Google Ads queries for campaign, ad group, ad, text, final URL, delivery metrics, and conversion diagnostics.
- Add read-only Meta Ads calls for campaign/ad set/ad insights, effective status, and destination/creative/copy inventory.
- Use the deterministic collector to fetch Google Ads, Meta Ads, and optional GA4 diagnostics read-only.
- Add a prompt that tells Codex to summarize only the validated `report-data.json`.
- Require dynamic hiring ad discovery by names, ad text, final URLs, and known hiring terms.
- Require simple recipient-facing statuses with internal reasons: fetch failed, enabled but no delivery, missing conversion tracking, unknown market mapping, or inactive.
- Generate both the simple email HTML and full report HTML from the same runner-owned template/source of truth.
- Write full report output under the automation directory before email send.
- Use `gws-sle gmail +send --html` with hard-coded recipients and a full report attachment unless a real private report URL is configured.
- If send fails but Gmail still works, create a draft. If Gmail is unavailable, write local `.html` and `.eml` files, show a macOS notification, and log the blocker.
- Keep local logs/state private: `umask 077`, `0700` directories, `0600` files, no shell tracing, state stores only last-success metadata, and logs should not print env vars or token-like values.
- Pin unattended command behavior: absolute Codex path `/Users/brady/.npm-global/bin/codex`, `-C /Users/brady/workspace/sle/products/marketing-director-dashboard`, `CODEX_HOME=/Users/brady/.codex`, stdin from `/dev/null`, timeout, read-only sandbox for Codex summary, and `--output-last-message`.

**Test scenarios:**
- Happy path: runner calls Codex with the prompt and exits successfully.
- Error path: runner exits nonzero if Codex fails.
- Error path: send failed but Gmail works creates a draft.
- Error path: Gmail unavailable writes local report output and logs the blocker.
- Edge case: discovered hiring ad has no parsed market and appears under unmapped hiring ads.
- Edge case: Gmail sent-mail already has the same report-period subject and the runner skips duplicate send.
- Edge case: local machine timezone is not Mountain Time and the runner still gates on `America/Denver`.

**Verification:**
- Runner passes shell syntax validation.
- Prompt contains the recipient list, read-only rules, dynamic discovery rules, and no mocked numbers.
- Generated full report and email HTML contain the same source data and no unescaped ad-platform text.
- `report-data.json` validates before email generation.

- U2. **Install Monday 9 AM Wake-Catch-Up Schedule**

**Goal:** Install a user LaunchAgent that runs at 9 AM Monday and catches up after wake/boot.

**Requirements:** R6

**Dependencies:** U0, U1

**Files:**
- Create: user LaunchAgent plist

**Approach:**
- Use hourly `StartCalendarInterval` entries and let the runner send only when the `America/Denver` Monday 9 AM due time has passed for the current reporting week.
- Use `RunAtLoad` so boot/wake catch-up logic can check whether this week's scheduled run was missed.
- Use a lock file to prevent duplicate sends.
- Use a state file that records the last successful weekly run.
- Set explicit LaunchAgent environment: `HOME`, `CODEX_HOME`, `PATH`, `TZ=America/Denver`, and repo working directory. Use stdout/stderr log paths under the automation directory.

**Test scenarios:**
- Happy path: `launchd` accepts the plist.
- Edge case: running the script twice in the same weekly window skips the second run.
- Error path: a failed run does not record success.

**Verification:**
- `plutil` validates the plist.
- `launchctl print` shows the job loaded.

- U3. **Refresh Dashboard and Email HTML Prototypes**

**Goal:** Replace static-number prototypes with output generated from the same runner-owned template/source of truth.

**Requirements:** R3, R4, R5

**Dependencies:** U1

**Files:**
- Modify: `/Users/brady/Documents/Codex/2026-06-18/i-want-to-set-up-an/outputs/hiring-ads-dashboard.html`
- Modify: `/Users/brady/Documents/Codex/2026-06-18/i-want-to-set-up-an/outputs/hiring-ads-email-preview.html`

**Approach:**
- Show report period, generated time, and source fetch times.
- Show active markets as green cards only when actual data exists.
- Show a top what-changed/action-needed summary.
- Show requested inactive markets separately.
- Show unmapped hiring ads separately.
- Use "Data pending" or "Not fetched in this preview" instead of fake spend, impressions, clicks, or conversion rate.
- Keep the email simpler than the full report and show where the full report link/attachment appears.

**Test scenarios:**
- Happy path: HTML opens locally without broken layout.
- Edge case: zero active markets still renders a useful report.

**Verification:**
- Browser or static inspection shows no hard-coded fake performance numbers.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Mac is fully off at 9 AM Monday | `RunAtLoad` plus weekly state catches up when the Mac next boots. |
| Mac never turns on that week | No local-only solution can run; the report waits until the Mac runs. |
| Codex subscription session expires | Runner logs the failure; Brady re-authenticates locally with Codex. |
| A platform returns enabled-but-no-delivery ads | Report uses `Needs review` with notes instead of pretending active delivery happened. |
| No real hosted report URL exists | Email attaches the full HTML report or omits the link until a real URL is configured. |
| Ad-platform text contains unsafe HTML | Report generator escapes all visible text and validates links before rendering. |
| Logs capture sensitive data | Runner uses private permissions and avoids printing env vars, tokens, and raw secret-bearing API responses. |
| Codex summary hangs or auth fails | Runner uses preflight, timeout, local notification, and deterministic fallback summary. |
| User is not logged into the Mac | User LaunchAgents run at user login, not headless before login; the report catches up after login/wake, not while nobody is logged in. |

---

## Documentation / Operational Notes

- The working automation home is `${CODEX_HOME:-$HOME/.codex}/automations/sle-hiring-ads-weekly-snapshot`.
- The LaunchAgent is local-machine infrastructure, not a Vercel deployment.
- A future hosted dashboard can move the full report to Vercel only if report data is stored somewhere Vercel can read without Brady's laptop session, and the report URL is private/authenticated or short-lived.
