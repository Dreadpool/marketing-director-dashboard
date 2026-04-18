# Creative Pipeline — Karpathy Alignment Design

**Date:** 2026-04-18
**Context:** The creative pipeline built on 2026-04-17 drifted from Karpathy's autoresearch pattern in three ways: (1) too many separate context files for the agent, (2) file names didn't match Karpathy's vocabulary, and (3) Brady's review-time rejections weren't logged as training signal. This spec closes those three gaps without over-abstracting.

## Goal

Align the creative pipeline more closely with Karpathy's `autoresearch` repo structure (prepare / train / program / results) while keeping the two justified deviations: (a) the agent writes 12 parallel hypotheses per cycle instead of one serial iteration, and (b) a human-in-loop gate sits between agent output and Meta push because real ad spend and brand safety require it.

## Non-goals

- In-dashboard creative generation from brief → image asset (roadmap)
- Testing-campaign routing (roadmap)
- Dropping the 6 dashboard visibility panels (they serve human monitoring, not the agent's loop)
- Changing the metric, matrix, or unit economics

---

## Section 1 — Fold content into program.md

**Problem.** Today the agent reads 9 separate files per cycle (program + creative-research + swipe-file + images + experiment-log + NPS + ad-copy + brandscript + business-context). Karpathy's agent reads ~4 (program + README + prepare + train). Too much file sprawl means the agent has to hop across sources to pattern-match; also means Brady edits multiple files to tune the rules.

**Fold these three sources verbatim into program.md:**

1. `reference/creative-research.md` (328 lines) → new section **"Creative priors"** at the bottom of program.md. Visual mechanics, F-pattern, layout archetypes, the 11-point sniff test checklist — all content preserved verbatim.
2. `~/workspace/sle/context/ad-copy/meta-ads-top-performers.md` (125 lines) → new section **"Historical SLE ads (what's worked)"** below creative priors. Top 15 by spend, ad copy variants, campaign structure.
3. `~/workspace/personal/knowledge-base/output/lessons/meta-creative-pipeline-intuition.html` → distilled to prose (~40 lines) as preamble section **"Why this loop exists"** at the top of program.md. HTML → prose because raw HTML has render artifacts; prose preserves the intuition.

**Resulting program.md structure:**

```
# SLE Creative Autoresearch — program.md

## Why this loop exists      ← NEW, ~40 lines (from teaching artifact)
## Goal
## Your job per cycle
## Copy first, then iterate
## Simplicity criterion
## Unit economics
## The matrix
## Files in scope
## Brief generation rules
## Sniff test
## Iteration cap + human-in-loop
## Simplicity tax enforcement
## What counts as "resolved"
## When priors fight the log
## Creative priors              ← NEW, ~330 lines (from creative-research.md)
## Historical SLE ads           ← NEW, ~125 lines (from ad-copy/meta-ads-top-performers.md)
```

Final size: **~600–700 lines**.

**After the fold:**

- `reference/creative-research.md` → delete (content now in program.md)
- `reference/images/` → keep (program.md references image paths for visual pattern-matching)
- `reference/swipe-file.md` → keep (wild-caught ads, grows over time; deserves its own file)
- `~/workspace/sle/context/ad-copy/meta-ads-top-performers.md` → keep file as historical reference, but drop from agent's "you read" list (duplicated in program.md)

**Updated agent input list in `program.md` "Files in scope":**

```
You read:
- program.md (this file — contains priors and historical ads inline)
- reference/swipe-file.md (your wild-caught winning ads)
- reference/images/ (screenshots referenced from swipe-file and program.md)
- results.md (outcomes memory, grows each cycle)
- ~/workspace/sle/context/nps-feedback/nps-only.csv (customer voice data)
- ~/workspace/sle/context/brand-voice/sle-brandscript.md (evidence-backed voice)
- ~/workspace/sle/context/business-context.md (routes, pricing, segments)
- briefs/ (last 3 cycles for concept-avoidance)
```

From 9 active sources down to 6.

---

## Section 2 — Rename to match Karpathy vocab

**Renames in `~/workspace/sle/products/creative-pipeline/`:**

| Current | After | Role |
|---|---|---|
| `evaluate.ts` | `prepare.ts` | Locked metric — agent never touches |
| `evaluate.test.ts` | `prepare.test.ts` | Paired test file |
| `experiment-log.md` | `results.md` | Append-only memory |
| `export-log-outcomes.ts` | `export-results.ts` | Syncs Neon → results.md |

**Unchanged:**

- `program.md` — already matches Karpathy
- `run-cycle.sh` — idiomatic shell name, no Karpathy analog
- `briefs/YYYY-MM.md` — stays `briefs/` because it's our `train.py` analog (12 parallel hypotheses per cycle, not one sequential iteration). The 15-step visualizer (`sle-creative-autoresearch.html`) makes this mapping explicit.
- `meta-client.ts` — domain-specific helper, no Karpathy analog
- All dashboard-side code (`marketing-director-dashboard/`) — file paths don't change

**References to update:**

- `program.md` — every internal mention of `evaluate.ts` → `prepare.ts`, `experiment-log.md` → `results.md`, `export-log-outcomes.ts` → `export-results.ts`
- `run-cycle.sh` — `npx tsx export-log-outcomes.ts` → `npx tsx export-results.ts`
- `package.json` scripts — `"export-log"` script renames to `"export-results"` pointing at new file; `"evaluate"` script points at `prepare.ts`
- Dashboard-side: `src/lib/workflows/creative-pipeline/compute-score.ts` inline comment references `evaluate.ts` → `prepare.ts`
- The 15-step visualizer at `~/workspace/personal/share-artifacts/sle-creative-autoresearch.html`:
  - Update code references (`evaluate.ts` → `prepare.ts`, `experiment-log.md` → `results.md`)
  - Add a callout explaining `briefs/` is our `train.py` analog and why (parallel hypotheses per cycle vs serial model iteration)

**Commit strategy:**

One atomic commit per repo:

- **creative-pipeline repo**: `git mv evaluate.ts prepare.ts`, `git mv evaluate.test.ts prepare.test.ts`, `git mv experiment-log.md results.md`, `git mv export-log-outcomes.ts export-results.ts`. Update all references in the same commit. Verify tests pass.
- **marketing-director-dashboard repo**: update comment references in `compute-score.ts` (no file renames). Commit on `creative-pipeline-autoresearch` branch.

---

## Section 3 — Rejection logging

**Problem.** Today the agent's `results.md` only records Meta-resolved outcomes. When Brady rejects a brief at review, that signal is lost. Karpathy's `results.tsv` records every attempt (kept or reverted). We need the same: Brady's rejections flow into `results.md` so next cycle's agent sees what didn't pass human review and why.

### 3.1 Schema additions

Add one column to `creative_briefs` table in Neon:

```sql
ALTER TABLE creative_briefs
  ADD COLUMN rejected_at TIMESTAMP;
```

**No new reason column.** Reuse the existing `kill_reason` column for both cron kills and Brady rejections. Source is disambiguated by the `status` field (`killed` = cron-killed, `rejected-at-review` = Brady rejection). Existing rows stay NULL on `rejected_at`.

### 3.2 Status rename + new status

- Rename existing status value `pushed` → `accepted` across:
  - Schema default (`status TEXT NOT NULL DEFAULT 'proposed'` stays; rename `'pushed'` value usage)
  - `src/types/creative-pipeline/types.ts` `BriefStatus` type literal
  - `src/components/workflows/creative-pipeline/brief-card.tsx` status styling
  - `src/components/workflows/creative-pipeline/push-outcome.tsx` pill
  - `src/app/api/creative-pipeline/push-brief/[briefId]/route.ts` status assignment
  - `src/app/api/cron/poll-meta-outcomes/route.ts` — classifier's `pushed` check
  - `src/app/workflows/creative-pipeline/page.tsx` aggregate counts
  - Existing DB rows: `UPDATE creative_briefs SET status = 'accepted' WHERE status = 'pushed';`

- Add new status value `rejected-at-review`:
  - Add to `BriefStatus` type
  - Add pill styling (red, similar to killed but distinct wording)
  - Add to push-outcome panel counts

**Final status set:** `proposed | rejected-at-review | accepted | live | resolved | killed`

### 3.3 New API route

**`POST /api/creative-pipeline/reject-brief/[briefId]`**

Request body:
```json
{ "reason": "off-brand, we don't use 'Seriously.' as a hook" }
```

Validation: `reason.length >= 10` (prevent empty/trivial submissions).

Action:
```sql
UPDATE creative_briefs
SET status = 'rejected-at-review',
    kill_reason = $reason,
    rejected_at = NOW(),
    updated_at = NOW()
WHERE brief_id = $briefId AND status = 'proposed';
```

Returns `{ briefId, status: 'rejected-at-review', kill_reason, rejected_at }`. 409 if status is not `proposed`. 400 if reason too short. 404 if brief not found.

### 3.4 Brief card UI

**When `status === 'proposed'`:**

Expanded card footer shows two buttons side-by-side:

```
[ Accept ]  [ Reject ]
```

- **Accept** (primary, amber) — calls existing `POST /api/creative-pipeline/push-brief/[briefId]`. Button text "Push to Meta →" renamed to "Accept →". On success, reload.
- **Reject** (secondary, red outline) — click swaps the button area to inline rejection form:

```
┌─ Reason (required, min 10 chars) ─────────────────┐
│                                                    │
│                                                    │
└────────────────────────────────────────────────────┘
  [ Cancel ]                           [ Save rejection ]
```

- Cancel → restore two-button state
- Save → POST reject-brief, reload on success
- Save button disabled until textarea length ≥ 10

**When `status === 'rejected-at-review'`:**

Expanded card shows a red "rejected" status pill + a gray reason block:

```
┌─ Rejected 2026-04-18 ─────────────────────────────┐
│ off-brand, we don't use "Seriously." as a hook    │
└────────────────────────────────────────────────────┘
```

No buttons. Card is terminal in this state.

**When `status === 'accepted' | 'live' | 'resolved' | 'killed'`:**

Card shows status pill, no buttons. Same as today.

### 3.5 Data flow to results.md

Update `export-results.ts` (renamed from `export-log-outcomes.ts`):

- Query: `WHERE status IN ('resolved', 'killed', 'rejected-at-review')`
- Order and checkpoint by `COALESCE(resolved_at, rejected_at)` — rejected rows use `rejected_at`, other terminal rows use `resolved_at`
- `.last-sync` checkpoint tracks `COALESCE(resolved_at, rejected_at)` of the last exported row
- Format for rejected rows:

```
## 2026-04-c03
- concept: $35 Post-It
- angle: price
- stage: awareness
- matrix: price × awareness
- status: rejected-at-review
- kill_reason: off-brand, we don't use "Seriously." as a hook
- resolved_at: 2026-04-18
```

Fields `spend`, `cpa`, `ctr`, `frequency`, `purchases`, `decision` stay blank/omitted for rejections (no Meta data).

`compute-score.ts` on the dashboard side needs no change — it already filters to `resolved | killed` only, so rejections are automatically excluded from the cycle score.

### 3.6 Agent reads the rejection signal

`program.md`'s existing rule says:
> Don't re-propose a concept killed within 60 days unless the reason was external (brand asset change, seasonality mismatch, etc.).

Extend this rule to cover rejected-at-review:
> Don't re-propose a concept that was rejected-at-review within 60 days. Read the `kill_reason` field — if it describes a content issue ("off-brand", "wrong angle", "clever wordplay"), treat the rule as firm. If it describes an external reason ("wrong season", "saving for different cycle"), the concept can return.

---

## Roadmap items (captured, not built now)

1. **In-dashboard creative generation** — take brief's `visual_direction` → produce/select image asset → attach to Meta AdCreative instead of creating empty. Removes the current manual step where Brady uploads image in Ads Manager after clicking Accept.

2. **Testing campaign vs production campaign** — today Accept pushes straight to the funnel-stage-mapped ad set. Future: route accepted briefs to a dedicated testing campaign with isolated budget. Winners graduate to the prospecting/retargeting/awareness campaigns after proving out.

Both items live in the dashboard's roadmap (`~/workspace/sle/products/marketing-director-dashboard/CLAUDE.md` under "Up Next").

---

## Files touched (summary)

**creative-pipeline repo:**
- `program.md` — rewrite (fold 3 sources, update paths, extend 60-day rule)
- `evaluate.ts` → `prepare.ts` (rename)
- `evaluate.test.ts` → `prepare.test.ts` (rename)
- `experiment-log.md` → `results.md` (rename)
- `export-log-outcomes.ts` → `export-results.ts` (rename + updated query)
- `run-cycle.sh` (update export script reference)
- `package.json` (update script names)
- `reference/creative-research.md` (delete — content now in program.md)

**marketing-director-dashboard repo (`creative-pipeline-autoresearch` branch):**
- `src/db/schema.ts` — add `rejected_at` column; data migration to rename status `pushed` → `accepted`
- `src/lib/workflows/creative-pipeline/types.ts` — rename status, add `rejected-at-review`
- `src/lib/workflows/creative-pipeline/compute-score.ts` — inline comment reference only
- `src/components/workflows/creative-pipeline/brief-card.tsx` — rename Push→Accept, add Reject flow
- `src/components/workflows/creative-pipeline/push-outcome.tsx` — status pill for rejected-at-review
- `src/app/api/creative-pipeline/push-brief/[briefId]/route.ts` — set status=accepted
- `src/app/api/creative-pipeline/reject-brief/[briefId]/route.ts` — NEW
- `src/app/api/cron/poll-meta-outcomes/route.ts` — rename pushed references
- `src/app/workflows/creative-pipeline/page.tsx` — aggregate counts

**share-artifacts:**
- `sle-creative-autoresearch.html` — update code refs (evaluate→prepare, experiment-log→results), add briefs/train.py mapping callout

---

## Verification plan

After implementation:

1. Creative-pipeline repo: `npm test` — `prepare.test.ts` runs green (4 tests pass as before the rename)
2. Dashboard: `npm run build` — typecheck passes
3. Dashboard: start dev server, load `/workflows/creative-pipeline/2026-04` — page loads, status pills render, existing accepted briefs show correctly after DB rename
4. Click Reject on a brief → textarea appears → save with reason → card flips to rejected state
5. Run `export-results.ts` against Neon — verify rejected rows appear in results.md with the correct format
6. Agent smoke test: regenerate cycle 2026-04 (after the reject flow is built) — confirm agent reads results.md, sees rejected entries, respects the 60-day rule

---

## Open questions

None. All decisions were made during brainstorming 2026-04-18.
