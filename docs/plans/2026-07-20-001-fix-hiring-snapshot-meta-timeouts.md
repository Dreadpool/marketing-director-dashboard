# Fix Hiring Snapshot Meta Timeouts

Status: complete

## Outcome

The weekly hiring report waits for complete Meta data, retries automatically after a temporary failure, and never emails repeated low-level network errors.

## Confirmed cause

The snapshot starts weekly and month-to-date Meta collection together. Each collection starts four more Meta requests together, creating eight simultaneous requests. All eight timed out in the reproduction; the same eight requests succeeded sequentially. The existing retry handles Meta rate limits but not network timeouts.

## Changes

1. Run all eight hiring-snapshot Meta requests one at a time. Keep Google and Indeed collection parallel because those sources did not fail.
2. Extend the Meta client's existing retry to cover `ETIMEDOUT`, `ECONNRESET`, `ESOCKETTIMEDOUT`, and socket-hang-up failures.
3. Group identical Meta failures within each report window into one message that names the affected request types.
4. Treat Google and Meta `warning` results as incomplete because those warnings mean one of their required requests failed. Treat any source `error` as blocking. Indeed freshness warnings remain non-blocking.
5. Save the incomplete source evidence, stop before publication or Gmail, notify Brady once for the report period, and let the hourly scheduler retry. Never send an incomplete report as an escape hatch.

## Tests

- A deterministic collection test records active Meta calls and fails if concurrency exceeds one.
- A retry test makes a Meta request time out once, then verifies the retry succeeds.
- A failure-summary test verifies one readable message replaces repeated copies.
- Send-gate tests verify platform warnings and source errors block, while an Indeed freshness warning does not.
- Existing snapshot rendering and scheduling tests remain green.

## Live verification

Run the canonical wrapper as a forced dry-run with a test-run directory. Confirm Meta weekly and month-to-date sources are healthy, no email is sent, and the production dedupe state is unchanged.
