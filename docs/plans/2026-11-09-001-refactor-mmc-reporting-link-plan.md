---
status: active
---
# TDS reporting belongs in MMC

Brady clarified November 9 that the Marketing Director Dashboard should link to
MMC Ridership Summaries rather than show TDS revenue, bookings or purchaser figures.
The earlier revenue-only removal was too narrow. No refund/cohort definition is
needed for this dashboard. Ad-platform performance remains sourced from the platforms.

- U1. **Retire duplicated TDS reports.** Remove Monthly Analytics and Promo Code
  from `src/lib/workflows.ts`, executors and summaries. Their bookmarked pages show
  the existing MMC link. Reject both initialization and delayed execution before
  DB/source calls. Suppress saved retired reports using the stored workflow slug,
  including mismatched URL requests. Preserve all stored rows. Test in
  `src/lib/workflows/__tests__/data-only-engine.test.ts` and run-route tests.
- U2. **Remove TDS comparison from Google Ads.** Remove the booking query, ground
  truth field, badges and text from the executor/schema/component/prompt. Project
  old saved responses to platform-only fields; hide historical derived text/actions
  that can embed the retired comparisons. Test `saved-marketing-report.test.ts`
  and `__tests__/google-ads.test.ts`; platform metrics must remain identical.
- U3. **Close unused audience preview access.** New interview invitations were
  already closed. Return the same closed response for remaining preview/explore
  routes, removing their TDS query path while preserving campaigns/responses.
  Update settings source guidance and product docs. Verify live endpoints and UI.

Repository inventory and November 2/5 removal patterns supply the design; no new
package or external research is needed. No DB schema/data deletion. Do not run a
workflow or send an email/ad as a test. Build/tests/typecheck, changed-file lint,
local browser checks and production readbacks gate completion. Deployment follows
the existing GitHub/Vercel path; inspect/drain prior invocations before declaring
this consumer independent of FTP.

Local verification: 214 tests passed, production build and changed-file lint passed.
Nine read/API checks and browser checks passed; no browser runtime errors.
Historical report row counts and content hashes captured before deployment.
A pre-existing hiring test fixture used an invalid status reason; corrected only
that fixture to the existing `inactive_no_delivery` value so TypeScript builds.
