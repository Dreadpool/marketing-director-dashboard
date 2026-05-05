---
title: "fix: Resolve build warnings and stale uncommitted state"
type: fix
status: active
date: 2026-05-05
---

# fix: Resolve build warnings and stale uncommitted state

## Overview

The dashboard's `npm run build` surfaces three issues. One is a real live bug, one is uncommitted in-flight work that has drifted between the code, the DB, and git, and one is a cosmetic Node deprecation warning from a transitive dev dependency. This plan addresses each at the right level: fix the real bug, land the in-flight feature cohesively, and document the cosmetic warning as a known no-op.

## Problem Frame

Three signals from a clean `npm run build` of `marketing-director-dashboard` on master:

1. **BigQuery query error (real bug):** `getCustomerSegmentation` in `src/lib/services/bigquery.ts` joins `vw_sle_active_orders.purchaser_email` (STRING, normalized via `LOWER(TRIM(...))`) against `customer_first_order.pk_email` (INTEGER). BigQuery rejects the join with `No matching signature for operator = for argument types: STRING, INT64`. The error fires whenever `/api/dashboard` is hit (including during static prerender on every build), so the dashboard's customer segmentation and CAC math have been silently failing — the API returns 500 and the page falls back to a non-prerendered render that still 500s for the segmentation slice.
2. **Drizzle migration 0004 drift:** `drizzle/0004_faithful_sauron.sql` creates `interview_campaigns`, `interview_responses`, and `interview_artifacts`. The migration is applied to the live Neon DB and the journal locally claims it is up to date, but the migration file, journal entry, schema definitions in `src/db/schema.ts`, and ~27 consumer files (`src/app/api/interview*`, `src/app/interview/`, `src/app/workflows/customer-interviews/`, `src/lib/auth/interview-api-auth.ts`, `src/lib/email/`, `src/lib/interviewer/`, `src/lib/services/bigquery-interview-segment.ts`, `src/lib/services/interview-campaign-service.ts`) are all uncommitted. A fresh clone or any teammate would not see the customer-interview workflow. The marketing-director-dashboard `CLAUDE.md` already lists this feature as "Completed 2026-04-24" — the code reality matches the documentation, only git is out of sync.
3. **`url.parse()` deprecation (cosmetic):** Node logs `[DEP0169] DeprecationWarning: url.parse() behavior is not standardized…` during build. `grep` of `node_modules` shows the call sites are in `drizzle-kit/utils.js`, `drizzle-kit/api.js`, and `next/dist/experimental/testing/server/config-testing-utils.js`. Both are dev/build dependencies (not runtime). No application code calls `url.parse`. There is no app-side fix — the warning resolves when those packages move to WHATWG `URL`.

## Requirements Trace

- R1. Customer segmentation API returns correct new-vs-returning-customer counts and revenue without raising a BigQuery type error.
- R2. The dashboard's prerender of `/api/dashboard` succeeds during `npm run build` (no `Dashboard API error` in build logs).
- R3. The customer-interview workflow surface (migration, schema, routes, services, libs) is committed to git as a single cohesive change, so a fresh clone matches the live DB and the documented "Completed" feature.
- R4. The `url.parse` deprecation is documented as a known no-action upstream issue so future builds don't trigger re-investigation.

## Scope Boundaries

- This plan does **not** add new tests for the customer-interview feature. The feature is live in prod; backfilling test coverage is separate work.
- This plan does **not** upgrade `drizzle-kit` or `next` to chase the `url.parse` deprecation. Fix lives upstream.
- This plan does **not** touch the unrelated dirty files (`CLAUDE.md`, `docs/superpowers/plans/2026-04-17-creative-pipeline-autoresearch.md`, `docs/superpowers/plans/2026-04-18-karpathy-alignment.md`, `docs/superpowers/specs/2026-04-18-karpathy-alignment-design.md`, `package.json`, `package-lock.json`, `src/lib/workflows.ts`, `findings.md`). Those are separate in-flight work and should be reviewed and committed by their author.
- This plan does **not** rework the customer-segmentation query semantics (e.g., switching from email-based identity to user IDs). Fix the join only.

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/services/bigquery.ts:88-112` — the broken `getCustomerSegmentation` query.
- `src/lib/services/bigquery.ts:46-73` — `getMonthlyRevenueSummary`, the sibling query that does **not** join `customer_first_order` and works correctly. Useful contrast for what "good" looks like in this file.
- `src/lib/services/bigquery-sales.ts`, `src/lib/services/bigquery-adspend.ts`, `src/lib/services/metrics-calculator.ts` — other BQ services that may also reference `customer_first_order` and inherit the same join bug. Audit before fixing.
- `src/db/schema.ts` — Drizzle table definitions; the uncommitted diff adds `interviewCampaigns`, `interviewResponses`, `interviewArtifacts` matching migration 0004.
- `drizzle/0004_faithful_sauron.sql` + `drizzle/meta/0004_snapshot.json` + the `0004_faithful_sauron` entry in `drizzle/meta/_journal.json` — the migration trio that must commit together.
- `marketing-director-dashboard/CLAUDE.md` Roadmap → "Customer Interview workflow (2026-04-24)" — describes the feature and the file layout; useful for the commit message.

### Institutional Learnings

- `marketing-director-dashboard/CLAUDE.md` Architecture Decisions: "BigQuery is single source of truth. Platform ads are supplementary." → confirms the segmentation query is on the critical path; fixing it is high-value.
- `marketing-director-dashboard/CLAUDE.md` Data Patterns: "BigQuery: parameterized queries (`@start_date`) to prevent injection." → the fix must keep parameterized queries; do not inline values.
- `~/workspace/sle/CLAUDE.md` — BigQuery tds_sales conventions live behind the `/bigquery` skill. Invoke before authoring SQL changes.

### External References

- Confirmed live BQ schema for `tds_sales.customer_first_order`:
  - `pk_email` → `INTEGER` (not the literal email; almost certainly a `FARM_FINGERPRINT` or similar surrogate)
  - `customer_account_holder_email` → `STRING` (the real email)
  - `first_order_date` → `DATETIME`
  - `first_order_id` → `INTEGER`
- Live DB state confirmed via `pg_tables`: `interview_artifacts`, `interview_campaigns`, `interview_responses` all exist; `interview_campaigns` has 0 rows (no campaigns sent yet — schema is live, no production data at risk).

---

## Key Technical Decisions

- **For the segmentation join, prefer `customer_account_holder_email` over hashing.** The `pk_email` column is INTEGER, almost certainly a hash. Two options:
  - (A) Join `LOWER(TRIM(o.purchaser_email)) = LOWER(TRIM(f.customer_account_holder_email))` — readable, mirrors the normalization already used elsewhere, no dependency on knowing the hash function.
  - (B) Match the hash: `FARM_FINGERPRINT(LOWER(TRIM(o.purchaser_email))) = f.pk_email` — requires confirming the source ETL uses `FARM_FINGERPRINT` (vs `MD5`, `SHA256`, or some other scheme) before going live.
  - **Choose (A)** unless investigation shows `customer_account_holder_email` is itself unreliable (e.g., not normalized or sparsely populated). (A) is the lower-risk and more readable fix.
- **Land the customer-interview feature as a single commit.** Splitting migration from schema from consumers would create intermediate commits where the build fails (schema references missing tables, or routes import missing schema exports). One commit, one logical unit.
- **Do not chase `url.parse`.** Document and move on. Verifying upstream fix would require version bumps on `next` (16.2.1 → ?) and `drizzle-kit` (0.31.10 → ?) that are not warranted for a non-functional warning.

---

## Open Questions

### Resolved During Planning

- *Is `pk_email` actually the email or a hash?* INTEGER type confirmed via BQ schema fetch — it is a surrogate. The real email is in `customer_account_holder_email`.
- *Does committing only the migration files break the build?* Yes — `src/db/schema.ts` already references the new tables and is itself uncommitted. Migration must commit with schema and consumers.
- *Are there test files among the 27 customer-interview files to commit?* No test files appeared in the inventory. The feature ships untested for now.
- *Is `url.parse` callable from any app code?* No. All call sites are in `node_modules/drizzle-kit/` and `node_modules/next/` (build-time only).

### Deferred to Implementation

- *Should the fixed segmentation query verify against a known-correct row count for a recent month?* Yes — implementer should run a one-off query before/after to confirm `new_customers + returning_customers` equals the historic monthly customer count. Defer the exact verification month/value to implementation.
- *Are other BQ services in this repo also joining `customer_first_order` on `pk_email`?* Plan U1 includes a grep audit; if matches are found, decide unit-by-unit whether to fix in the same PR or split.

---

## Implementation Units

### U1. **Fix BigQuery STRING-vs-INT64 join in customer segmentation**

**Goal:** `getCustomerSegmentation` in `src/lib/services/bigquery.ts` joins `vw_sle_active_orders` to `customer_first_order` on a column of matching type, restoring correct new-vs-returning customer counts and revenue, and clearing the `Dashboard API error` from build logs.

**Requirements:** R1, R2

**Dependencies:** None.

**Files:**
- Modify: `src/lib/services/bigquery.ts`
- Test: none in this PR — service has no existing test file. Verification is via live query + dashboard prerender.

**Approach:**
- Replace the broken JOIN clause `ON LOWER(TRIM(o.purchaser_email)) = f.pk_email` with `ON LOWER(TRIM(o.purchaser_email)) = LOWER(TRIM(f.customer_account_holder_email))`.
- Before changing code, grep the repo for other call sites that join on `pk_email` (`grep -rn "pk_email" src/`). If sibling services are bitten by the same bug, fix them in the same change; otherwise, leave them alone.
- Invoke the `/bigquery` skill once before editing the SQL to confirm the join column and any tds_sales conventions for `customer_first_order` (e.g., NULL handling, soft-deletes).

**Patterns to follow:**
- `src/lib/services/bigquery.ts:46-73` — same parameterized `@start_date` / `@end_date` pattern, single `bq.query()` call, structured return.

**Test scenarios:**
- Happy path: with a known recent completed month (e.g., `period: { year: 2026, month: 4 }`), the function returns `newCustomers + returningCustomers` equal to the unique-customer count from `getMonthlyRevenueSummary` for the same period (within rounding from email-normalization differences).
- Edge case: a month with zero orders returns `newCustomers: 0, returningCustomers: 0, newCustomerRevenue: 0, returningCustomerRevenue: 0` without error.
- Integration: hitting `GET /api/dashboard` returns `200` with a populated `customers` slice; no `Dashboard API error` in server logs.

**Verification:**
- `npm run build` completes without `Dashboard API error: ... STRING, INT64` in stderr.
- Curling `/api/dashboard` against the running dev server returns `customers.new` and `customers.returning` as positive integers for the current month.
- Spot-check: `customers.new + customers.returning` is in the same ballpark as `revenue.unique_customers` for the same period.

---

### U2. **Land customer-interview feature as one cohesive commit**

**Goal:** Commit migration 0004 together with the schema definitions and ~27 consumer files for the customer-interview workflow so git, the live DB, and the marketing-director-dashboard CLAUDE.md roadmap all agree.

**Requirements:** R3

**Dependencies:** None — does not depend on U1.

**Files:**
- Add (untracked): `drizzle/0004_faithful_sauron.sql`, `drizzle/meta/0004_snapshot.json`
- Add (untracked): all files under `src/app/api/interview/`, `src/app/api/interviews/`, `src/app/interview/`, `src/app/workflows/customer-interviews/`
- Add (untracked): `src/lib/auth/interview-api-auth.ts`, `src/lib/email/` (entire dir), `src/lib/interviewer/` (entire dir), `src/lib/services/bigquery-interview-segment.ts`, `src/lib/services/interview-campaign-service.ts`
- Modify (already dirty): `src/db/schema.ts`, `drizzle/meta/_journal.json`
- **Do not stage:** `CLAUDE.md`, `docs/superpowers/plans/2026-04-17-creative-pipeline-autoresearch.md`, `docs/superpowers/plans/2026-04-18-karpathy-alignment.md`, `docs/superpowers/specs/2026-04-18-karpathy-alignment-design.md`, `package.json`, `package-lock.json`, `src/lib/workflows.ts`, `findings.md` — these are unrelated in-flight work and belong in their own commits.

**Approach:**
- Inspect each modified file's diff before staging to confirm it belongs to the customer-interview feature and not to one of the unrelated workstreams. `package.json` and `package-lock.json` are the highest-risk: they may include deps that the interview feature actually needs (e.g., `nodemailer` for SMTP). Diff the package files and decide per-line; if the dep is consumed by interview code, include the package file in this commit.
- Stage the files explicitly by path (not `git add .`) to avoid pulling in the unrelated dirty files.
- Run `npm run build` after staging-but-before-committing to confirm the staged set type-checks and builds.
- Single commit message describes the feature, references the CLAUDE.md "Completed 2026-04-24" entry, and notes that the migration is already live in the Neon DB (no `drizzle-kit migrate` needed at deploy).

**Patterns to follow:**
- `marketing-director-dashboard/CLAUDE.md` Roadmap entry "Customer Interview workflow (2026-04-24)" lists the file inventory; mirror the same inventory in the commit body for grep-ability.
- Prior cohesive feature commits in `git log --oneline` (e.g., `13114c7 Merge creative-pipeline-autoresearch: autoresearch loop + Karpathy alignment`) show the repo's tolerance for large feature commits.

**Test scenarios:** Test expectation: none — this is a git hygiene unit, not a behavior change. The feature is already running in production. Build success on the staged set is the only verification.

**Verification:**
- `git status --short` shows only the unrelated workstream files still dirty after the commit.
- `npm run build` succeeds on the new commit.
- `git log -1 --stat` shows the migration files, schema changes, and consumer files all in one commit.
- `npx drizzle-kit check` (or equivalent) reports no schema/journal drift.

---

### U3. **Document `url.parse` deprecation as known no-action**

**Goal:** Future-Brady (and future-Claude) sees a one-line note in the dashboard's CLAUDE.md "Architecture Decisions" or a new "Known Warnings" section explaining that the build-time `DEP0169` warning is a transitive dev-dep issue with `drizzle-kit` and `next`, and is intentionally not fixed.

**Requirements:** R4

**Dependencies:** None.

**Files:**
- Modify: `marketing-director-dashboard/CLAUDE.md` (add a small "Known Build Warnings" subsection under "Architecture Decisions" or just append as a new note with date stamp).

**Approach:**
- One-paragraph note: which warning, which transitive dep call sites (`drizzle-kit/utils.js`, `drizzle-kit/api.js`, `next/dist/experimental/testing/server/config-testing-utils.js`), why no action, what would change the calculus (e.g., upgrade to `next@16.3+` or `drizzle-kit@0.32+` if/when those packages drop the legacy API).
- Keep it terse. The point is breadcrumb, not essay.

**Patterns to follow:**
- Existing CLAUDE.md notes under "Architecture Decisions" → date-stamped, single-paragraph format.

**Test scenarios:** Test expectation: none — documentation-only change.

**Verification:**
- A search for `DEP0169` or `url.parse` in the dashboard CLAUDE.md returns the new note.
- Next time the warning is questioned, the note answers it without re-investigation.

---

## System-Wide Impact

- **Interaction graph:** U1 is on the critical path for `/api/dashboard`, which feeds the homepage KPI cards. Any consumer of `getCustomerSegmentation` (currently only `getDashboardSummary`) gets correct values after the fix. Confirm via grep that no other callers exist.
- **Error propagation:** U1 fix should remove the `Dashboard API error` log line. If it persists, the catch block has another error path — verify the stderr after fixing.
- **State lifecycle risks:** U2 commits files referencing live DB tables. If anyone reverts the commit, the code still builds (tables exist in DB) but a fresh `drizzle-kit migrate` from a clean DB would diverge. Note in the commit body that the migration is already applied in prod and that downstream environments need a `drizzle-kit migrate` before the code lands.
- **API surface parity:** None — no public API changes.
- **Integration coverage:** U1 verification is end-to-end (BQ → API → page). No new tests added; relies on existing query and prerender as the integration check.
- **Unchanged invariants:** The shape of `BigQueryPeriodSummary` is unchanged. Only the values become correct.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `customer_account_holder_email` is itself sparsely populated or not normalized, so the corrected join silently undercounts | Implementer runs a one-off `COUNT(*) WHERE customer_account_holder_email IS NULL OR TRIM(...) = ''` before/after to bound the data-quality risk. If it's > 5%, escalate before merging. |
| `package.json` / `package-lock.json` diff includes deps for both the interview feature and the unrelated in-flight work, and they cannot be cleanly split | Diff per-line. If unsplittable, commit the package files with U2 (interview) and ask the unrelated workstream owner to rebase. |
| Other BQ services in `src/lib/services/` join `customer_first_order` on `pk_email` and silently 500 in production | U1 includes a grep audit; flag found matches as in-scope for the same PR or as follow-up issues. |
| The `url.parse` warning is hiding a real call from app code that grep missed | grep already shows zero matches under `src/`. Low residual risk; CLAUDE.md note records the assumption so it can be re-checked. |

---

## Documentation / Operational Notes

- **U2 commit message:** Reference the marketing-director-dashboard CLAUDE.md "Completed 2026-04-24" roadmap entry. Note that migration 0004 is already applied to the live Neon DB (no `drizzle-kit migrate` needed at Vercel deploy time for prod).
- **U1 ops:** No deploy hook needed. Vercel auto-deploys master on push; the fix lands as soon as merged.
- **U3 ops:** None — documentation only.

---

## Sources & References

- Build error log: `npm run build` output dated 2026-05-05 (captured during the prior session).
- Live BQ schema: queried `tds_sales.customer_first_order.getMetadata()` directly on 2026-05-05.
- Live Neon DB state: queried `pg_tables` for `interview_*` on 2026-05-05; all three tables present.
- Related code: `src/lib/services/bigquery.ts:88-112`.
- Related docs: `marketing-director-dashboard/CLAUDE.md` Roadmap → "Customer Interview workflow (2026-04-24)".
