# Weekly hiring snapshot: verified September 7, 2026

The scheduled report now follows actual Google ad-group IDs and keeps on/off settings separate from delivery during the reporting week. The report uses fixed rules, with no AI commentary.

## Errors addressed

- An ad-group location interest was treated as a physical boundary. A valid campaign radius was labeled unresolved because the collector only requested named regions.
- Name matching and a one-location-per-group assumption were presented as targeting checks. Neither proves physical coverage.
- Google's query helper read only the first page. Indeed's reader stopped at row 200.
- Blank Indeed job statuses became closed, and rows without a city disappeared.
- Meta could repeat a campaign or ad-set total for each ad and then add the parent total again.
- A failed Gmail sent-mail lookup could be treated as no prior email. The runner now stops before publishing or sending when that lookup fails.

The first radius regression test failed against the previous builder with “Unresolved location.” The corrected collector, builder, and renderers pass that test.

## Live report check

Reporting week: August 31 through September 6. Account: Salt Lake Express, 7716669181; USD; America/Denver. Settings were fetched September 7 at 4:22 PM Mountain.

| Actual Google ad group | Settings now | Weekly spend | Impressions | Clicks |
|---|---|---:|---:|---:|
| Salt Lake City | On | $124.38 | 1,336 | 61 |
| Spokane | On | $92.50 | 554 | 38 |
| Omak | Ad group paused | $0.00 | 0 | 0 |
| Pocatello | Ad group paused | $0.00 | 0 | 0 |
| St. George | Ad group paused | $0.00 | 0 | 0 |

An independent Google Ads Python client query returned the same campaign and ad-group totals: $216.879874 before display rounding, 1,890 impressions, and 99 clicks. All eight scoped hiring campaigns were checked. The report's 23 excluded groups account for $0.00; their IDs and reasons are itemized in the full report.

The month-to-date check, September 1 through the partial day September 7, reconciled at $178.799874. Month-to-date values may change as Google updates the partial day.

The Salt Lake City and Spokane campaigns each have exactly one positive 50-mile circle centered on the approved shop, no exclusions, and Presence-only matching. Their saved coordinates match the approved rules. DMA location-interest filters still appear separately in the full report. Google reports both ad groups eligible and both campaigns limited; the report does not guess why a campaign is limited.

Indeed's September sheet has three driver rows: BOI, SLC, and STG. Each says open, but performance, company, and state cells are blank. The report preserves those labels and shows unavailable metrics. It does not merge the sheet into Google markets.

## What the weekly checks prove

- The expected account and five known group IDs are present. New named driver groups in scoped hiring campaigns appear automatically.
- Current switches and historical metrics are independent. A paused group can retain last week's spend.
- Each approved physical circle matches its saved center, distance, miles unit, Presence setting, and absence of additional regions or exclusions.
- Google campaign and ad-group totals reconcile for spend, impressions, and clicks. Reported plus excluded spend also reconciles.
- Missing queries, missing known inventory, duplicate metrics, malformed metrics, and incomplete required platform results prevent sending.
- Indeed data is from the requested monthly tab, with missing values preserved. Indeed source problems are visible but do not block the Google report.

These checks do **not** certify ad copy, keywords, every Google setting, or where each person who saw an ad lives. A newly named group is not automatically an approved recruiting area. Omak, Pocatello, and St. George currently inherit their parent campaign's geography; that coverage must be reviewed before enabling those markets.

Google's [location-targeting documentation](https://developers.google.com/google-ads/api/docs/targeting/location-targeting) defines campaign regions and proximity targets. Google's [ad-group location guidance](https://support.google.com/google-ads/answer/1722043?hl=en) describes AI Max locations of interest as an additional condition, not an independent physical boundary.

## Verification and rollout

### Email wording and layout follow-up

The production email now uses “On” and “Paused” under “Ads now,” separate from weekly spend and clicks. Removed and unknown states remain explicit, and the full report keeps the exact pause reason. Impressions and cost per click sit below each market; campaign addresses span the row. Indeed retains its own locations and monthly results in a two-column table.

The September 7 source snapshot was reused without fetching new data or sending email. Browser screenshots at 320px and 1280px confirm readable city names and status labels; the 320px page has no horizontal overflow. All 205 tests, the production build, and scoped lint pass. Existing build warnings concern unrelated creative-pipeline file tracing and `url.parse()`. The send-state fingerprint is unchanged. The existing local preview URL is preserved at `http://localhost:8765/hiring-email-exact-2026-09-07/production-email.html`; screenshots are in `/Users/brady/Documents/claude-scratch/hiring-email-exact-2026-09-07/`.

### Initial reporting-logic verification

- 200 tests passed, including collector failures, radius drift, exclusions, paused/removed/unknown groups, stable IDs, pagination, missing Indeed data, and Meta parent/child double-counting.
- Production build, TypeScript, scoped ESLint, wrapper syntax, and patch whitespace checks passed. The build reports an unrelated creative-pipeline file-tracing warning and the documented url.parse dependency warning.
- Two real-source dry runs completed without email, publication, or sent-state changes.
- The loaded LaunchAgent still invokes the project wrapper hourly and at login. The runner still sends once after Monday 9 AM Mountain, with the same recipients.
- The ordinary runner returned already sent for August 31 through September 6. A production --force invocation was rejected. No replacement September 7 email was sent.
- Browser screenshots verified the actual email's five Google rows, both shop-radius descriptions, and Indeed's unavailable values. This was a local rendering check, not an email-client delivery test.

Private validation run: `automations/hiring-ads-weekly-snapshot/runtime/runs/2026-08-31_to_2026-09-06-preview-2026-09-07T22-22-33-398Z/`.

Editable local review: [email preview](http://localhost:8765/hiring-snapshot-verified-2026-09-07/email.html) and [full report](http://localhost:8765/hiring-snapshot-verified-2026-09-07/full-report.html). These are copies of the dry-run output with a local review toolbar, not alternative reporting logic.

The operating rules and approved centers live in [AUTOMATION.md](../../automations/hiring-ads-weekly-snapshot/AUTOMATION.md).
