# SLE Hiring Ads Weekly Snapshot

## Purpose

Send Salt Lake Express's weekly driver-hiring ad report from the dashboard's canonical, tested runner. The report shows weekly Google ad-group delivery and current settings, keeps Indeed monthly results separate, and links to the full report without changing any ad account.

`launchd` is the sole trigger owner. It wakes the wrapper hourly and at login so a sleeping or powered-off Mac can catch up. The TypeScript runner, not `launchd`, decides whether the previous Monday-Sunday report is due: after Monday 9:00 AM in `America/Denver`, once per report period. The duplicate Codex schedule must remain paused or archived after cutover.

## Read first

- Runner and operational behavior: `scripts/hiring-ads-snapshot.ts`
- Collection, classification, and both report renderers: `src/lib/services/hiring-ads-snapshot.ts`
- Characterization tests: `src/lib/services/hiring-ads-snapshot.test.ts`
- Repository environment and data-source rules: `CLAUDE.md`
- Trigger wrapper: `automations/hiring-ads-weekly-snapshot/run.sh`

The TypeScript files own executable details such as recipients, platform queries, market aliases, report periods, MIME construction, publication, Gmail dedupe, and fallback behavior. Do not reproduce those details in a one-off script or replacement email body.

## Run

The scheduled command is:

```bash
/Users/brady/workspace/sle/marketing/marketing-director-dashboard/automations/hiring-ads-weekly-snapshot/run.sh
```

The wrapper loads the repository's `.env.local`, keeps Mountain Time explicit, prevents sleep during the run, and invokes only `scripts/hiring-ads-snapshot.ts` with:

```text
--automation-home /Users/brady/workspace/sle/marketing/marketing-director-dashboard/automations/hiring-ads-weekly-snapshot/runtime
```

For a no-send validation outside the normal window, use `run.sh --dry-run --force`. Production sends reject `--force`. A test email may use `--test-run` only with an explicitly approved test recipient and copied-recipient list. Neither dry runs nor test runs update weekly sent state.

After Brady explicitly requests a corrected email for an already-sent week, use `run.sh --correction`. The runner fetches fresh sources, uses an `[Updated]` subject, archives a separate timestamped run, and deduplicates with `runtime/correction-<period>.json` plus Gmail sent mail. It preserves `runtime/state.json` and the regular schedule. A correction does not automatically retry through drafts after a send error; verify Sent before any manual retry. `--dry-run --force --correction` validates without sending.

## Report behavior (revised September 7, 2026)

- Google comes first: one row per actual campaign/ad-group ID, current name, on/off switches, weekly spend, impressions, clicks, and cost per click. Enabled rows show current physical campaign coverage. The full report separates campaign regions/radii and exclusions from ad-group location interests. No invented city rows or shared market-economics table.
- Google applications and cost per application are not tracked. Do not imply zero applications or compare weekly Google totals against monthly Indeed totals.
- Indeed has its own monthly table by company, city, and state from the sheet. Include every driver-hiring location in the requested monthly tab. Never merge Indeed with Google markets or substitute an older month. A missing Indeed tab is shown as unavailable and does not block the Google report.
- In the email, list locations by sheet job status. If every performance value is missing, replace the empty table with one notice. Otherwise show spend, clicks, applications, cost per application, and totals; missing contributors make that total unavailable. Preserve explicit zeros. Show the sheet update date and any stale-data warning; keep raw source metadata and missing-company details in the full report. Google campaign-coverage notes belong above Indeed.
- Read all rows in columns A:AF. Preserve sheet location codes even when state or company is missing; retain rows with no city as “Location not entered.” Blank or invalid metrics are unavailable, not zero; a combined total is unavailable if any contributing row is missing that metric. Only open/closed/paused sheet values determine job status; other values are unknown, not closed. Sheet status does not prove sponsored ads are enabled.
- Do not blend Google and Meta into one metric. The email may carry a short factual Meta status note; detailed Meta diagnostics belong in the full report.
- “Ads now” shows “On” only when both campaign and ad group are enabled, and “Paused” when either is paused. Removed and unknown switches remain distinct. Weekly spend and clicks are separate from current status; paused or removed groups retain historical spend. The full report retains the exact pause reason and Google delivery eligibility; enabled settings do not guarantee delivery.
- Campaign LOCATION and PROXIMITY criteria define physical coverage. DMA means television market region, not city limits. AI Max ad-group LOCATION criteria are locations of interest, not independent physical boundaries. Names never prove geography. Current settings are not represented as last week's settings.
- Fixed checks verify resolved locations, positive campaign coverage, Presence-only matching, switch status, and explicit Google delivery restrictions. The two approved groups get an exact 50-mile center/unit check, requiring their approved parent campaign and no additional targets or exclusions. An enabled new group without approved shop coverage is flagged for review; it is not assumed wrong or silently certified.
- Both email and full report are deterministic. There is no AI summary, copy analysis, or general claim that all targeting is correct.

## Google roster and identity

- This report reads SLE customer `7716669181`, USD, America/Denver, which holds the five reviewed hiring groups, including Spokane. The separate Northwestern Google account is outside this report's scope. Reject an unexpected account, currency, or timezone.
- Discover names, statuses, and location criteria directly from the API. Never translate generic WA or ID groups into cities. Identity is campaign ID plus ad-group ID, never a name or description.
- Enabled with no spend, impressions, or clicks is not active delivery.
- Keep campaigns `23506774948` (UT/ID) and `24043574614` (WASH) in scope even when paused or renamed. Discover additional campaigns with the word Hiring in their name, including new paused campaigns. Add a stable campaign ID when a new campaign must survive renaming. New named driver groups appear automatically; no city list is used to generate rows.
- Continuity checks require the five known group IDs to be present in Google's inventory. Missing inventory blocks sending; an explicitly removed known group remains visible as removed. Known IDs are a completeness check, not a source of synthetic market rows.
- Suppress dormant generic duplicates such as ID and WA. Include them, removed groups, and older campaigns if they have delivery during the reporting period, so recorded spend is not lost.
- Non-driver hiring groups and non-hiring campaigns stay excluded. Multiple location criteria never duplicate or divide an ad group's spend.
- Fetch every Google results page. Weekly and monthly campaign totals must reconcile with ad-group spend, impressions, and clicks before sending. Duplicate metrics, malformed metrics, partial queries, or missing inventory block the report. The full report itemizes excluded groups and their spend; reported plus excluded spend must equal all scoped campaign spend.
- Meta metrics are counted at the ad level only. Never assign a campaign/ad-set total to each ad or add parent totals to child totals. Parent spend must reconcile with ad-level results within two cents; incomplete required sources block sending.
- Roster rules: `src/lib/services/hiring-google-groups.ts`. Collection: `src/lib/services/hiring-ads-snapshot.ts`. Rendering: `src/lib/services/hiring-snapshot-render.ts`.
- Omak and Pocatello Meta sales ad sets are ticket-sales ads, not hiring ads, and must stay excluded.

## Approved Google physical coverage

Approved September 7, 2026. These checks certify only the saved physical circle and Presence setting, not copy, keywords, location-interest choices, or resident-level delivery.

| Ad group | Group ID | Parent campaign | Required circle |
|---|---|---|---|
| Salt Lake City | 197915916605 | 23506774948 | 50 miles around 700 Fulton St, Salt Lake City, UT 84104; latitude 40.753466, longitude -111.963574 |
| Spokane | 199165553660 | 24043574614 | 50 miles around 4611 S Ben Franklin Ln, Spokane, WA 99224; latitude 47.612414, longitude -117.507099 |

Allow a coordinate serialization tolerance of 10 microdegrees (about one meter). Miles and kilometers are not interchangeable. No extra positive targets or exclusions are approved. Omak, Pocatello, and St. George are currently paused and share their parent campaign's coverage; the report must not imply those cities have independent shop-radius coverage. Adding a market to the report is automatic; approving new physical coverage requires Brady's decision and a tested rule update.

## Output

- Private dedupe state: `/Users/brady/workspace/sle/marketing/marketing-director-dashboard/automations/hiring-ads-weekly-snapshot/runtime/state.json`
- Ephemeral run lock: `/Users/brady/workspace/sle/marketing/marketing-director-dashboard/automations/hiring-ads-weekly-snapshot/runtime/run.lock/`
- Private generated runs: `/Users/brady/workspace/sle/marketing/marketing-director-dashboard/automations/hiring-ads-weekly-snapshot/runtime/runs/<report-period>/`
- Each run can contain `report-data.json` (including Google accounting checks), `full-report.html`, `email.html`, `email.txt`, `email.eml`, and an error file.
- Stable scheduler logs: `/Users/brady/workspace/sle/marketing/marketing-director-dashboard/automations/hiring-ads-weekly-snapshot/runtime/logs/launchd.out.log` and `/Users/brady/workspace/sle/marketing/marketing-director-dashboard/automations/hiring-ads-weekly-snapshot/runtime/logs/launchd.err.log`
- A successful live run publishes the full report, sends the canonical email, and prints JSON containing its status, subject, message ID, and run directory. The recipient list remains owned by the runner constants and must be included when a person reports the result.

## Safety

- All Google, Meta, and Indeed access is read-only. Never create, edit, pause, enable, duplicate, upload, or change campaigns, ad groups, ad sets, ads, creatives, keywords, budgets, or account settings.
- Use the repository's existing local environment and credential paths. Never print, copy, or persist secret values.
- Use only the canonical runner and renderer. Do not hand-build HTML, invent metrics, replace classification logic, or bypass validation.
- Do not stage or commit generated reports, state, logs, or credentials.
- Normal dedupe has two layers: private state and Gmail sent-mail lookup. Preserve both. A failed Gmail lookup blocks publication and sending; it is not treated as “no match.” Never delete or reset state to force a send.
- A dry run must not publish, email, or modify sent state. Dry runs use a timestamped preview directory and never overwrite a previously sent report. A test run must not update weekly sent state.

## Outcomes

- **Success:** JSON status is `sent`; the subject, report period, message ID, canonical recipients, and run directory are available; the state records that period once.
- **No work:** JSON status is `skipped` with the exact reason and period key, normally because Monday 9:00 AM Mountain Time has not arrived or the period was already sent.
- **Blocked:** Authentication, dependency, source, or publication access prevents completion. Report the exact blocker and any saved run directory. Do not manufacture missing values or send a substitute report.
- **Failed:** The process exits nonzero. If Gmail created a draft, treat the run as unsent and retryable; preserve the draft ID, local files, notification, and error evidence. Never report a draft as success.

## Verify

Before a trigger or runtime cutover:

```bash
npm test
npm run build
bash -n automations/hiring-ads-weekly-snapshot/run.sh
```

Then run the no-send validation, confirm all output is under the project-owned `runtime/`, and inspect its JSON and rendered files. Confirm the installed LaunchAgent resolves to this wrapper, writes to `runtime/logs/`, wakes hourly and at login, and leaves the internal `America/Denver` gate in control. Confirm the Codex trigger is paused or archived before allowing a due-period live run.

## State owner

- Project owner and execution home: `/Users/brady/workspace/sle/marketing/marketing-director-dashboard/automations/hiring-ads-weekly-snapshot`.
- Canonical local dedupe state: `runtime/state.json`; Gmail sent mail is the second dedupe source.
- `launchd` owns wake and retry only. `scripts/hiring-ads-snapshot.ts` owns due-time, locking, dedupe, output, publication, recipients, and sending.
- The historical Codex automation diary is evidence only and is not an input.
