# Creative Pipeline Autoresearch — Design Spec

Date: 2026-04-17
Status: Draft for review
Author: Brady + Claude

## Overview

A monthly creative pipeline that applies Karpathy's autoresearch pattern to Meta static ads. The system lives across two repos:

- **`~/workspace/sle/products/creative-pipeline/`** — new, its own git repo. Houses the autoresearch agent's working files (`program.md`, `briefs/`, `experiment-log.md`, `creative-research.md`, `swipe-file.md`, `evaluate.ts`). The agent runs as Claude Code on Brady's Mac.
- **`~/workspace/sle/products/marketing-director-dashboard/`** — existing. Gets a new `creative-pipeline` workflow page that acts as viewer, shipper (via Meta API), and monitor.

The agent generates 12 concept briefs per cycle from accumulated knowledge (priors + log). Brady reviews in the dashboard and ships approved briefs to Meta with one click. Outcomes flow back automatically via Meta API polling. Score: `hit_rate × (target_cpa / avg_winner_cpa)`. Hill-climb monthly.

## Goals

1. Generate 12 net-new Meta static concept briefs at the start of each month, based on prior-cycle outcomes and industry priors
2. Give Brady full visibility into what the agent read, hypothesized, and generated — per learning #5.1 "the loop is open until the human can see it"
3. Make Meta shipping a one-click action from the dashboard, preserving brief→ad correlation for outcome attribution
4. Close the loop automatically: Meta CPA data attaches to brief_id, experiment-log.md updates, next cycle's agent has learning material
5. Support a future autoresearch outer loop that could eventually update `program.md` — but not in v1

## Non-goals (v1)

- Automated image generation (Midjourney/Ideogram API). Brady creates images manually in Canva/MJ after approving briefs.
- Automated brief generation via the dashboard (agent runs on Mac via Claude Code, dashboard is read-only for generation)
- Multi-tenant / multi-client support
- Scheduled (launchd) agent runs — first 5 cycles are manually kicked off
- Video creative support
- Foreplay / third-party swipe file API integration (see Future Considerations)

## Architecture

### Why the loop lives locally, not in the dashboard

Three physics-driven reasons:

1. **Vercel filesystem is read-only** (per Kim-loop learning #1.3). The agent needs to write `briefs/YYYY-MM.md` and append to git. Cannot run on Vercel.
2. **Context discipline requires filesystem + git as substrate.** Karpathy's pattern depends on the agent reading specific files, grep-ing for metrics, appending compact log rows. Reimplementing this inside a Next.js API route fights the pattern.
3. **Precedent.** Kim (SLE chatbot) autoresearch loop runs the same way — local Mac, files + commits, dashboard reads the outputs.

### Dashboard's role (three things only)

- **Viewer** — renders the 12 briefs produced by the agent + all visibility panels
- **Shipper** — pushes approved briefs to Meta via the existing `facebook-nodejs-business-sdk` integration, creating ad drafts with populated copy/headline
- **Monitor** — Vercel cron polls Meta for outcomes on shipped briefs, writes results to Neon, triggers `experiment-log.md` updates at next cycle

### Component diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BRADY'S MAC                               │
│                                                                  │
│  creative-pipeline/ (new git repo)                              │
│    ├─ program.md            ← human, stable                     │
│    ├─ creative-research.md  ← human-distilled, updates 6mo      │
│    ├─ swipe-file.md         ← Brady appends in the wild         │
│    ├─ swipe-file/           ← image collection                  │
│    ├─ creative-research-images/ ← curated pattern examples       │
│    ├─ experiment-log.md     ← script-appended, agent-read-only  │
│    ├─ evaluate.ts           ← LOCKED metric calculator          │
│    ├─ briefs/YYYY-MM.md     ← agent writes one per cycle        │
│    ├─ run-cycle.sh          ← kicks off Claude Code             │
│    └─ FROZEN                ← sentinel file, pauses loop        │
│                                                                  │
│  Claude Code agent reads → writes briefs → exits                │
│                                                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           │ (git push / sync script)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (Vercel + Neon)                     │
│                                                                  │
│  /workflows/creative-pipeline                                    │
│    ├─ Inputs loaded panel                                        │
│    ├─ Hypothesis trail panel                                     │
│    ├─ Matrix coverage panel                                      │
│    ├─ Gate status panel                                          │
│    ├─ Brief cards (12) with "Push to Meta" buttons               │
│    ├─ Push & outcome panel                                       │
│    └─ Metric history panel                                       │
│                                                                  │
│  API routes:                                                     │
│    POST /api/creative-pipeline/import-briefs                     │
│    POST /api/creative-pipeline/push-brief/:briefId               │
│    GET  /api/creative-pipeline/cycles                            │
│    GET  /api/creative-pipeline/cycle/:cycleId                    │
│    POST /api/cron/poll-meta-outcomes (Vercel cron, daily)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ (Meta Ads API)
                           ▼
                 Meta Ads Manager (ad drafts)
```

## File layout — creative-pipeline repo

```
~/workspace/sle/products/creative-pipeline/
├─ README.md
├─ .gitignore                     (.env.local, FROZEN, run.log, run-metrics.json)
├─ .env.local                     (Meta API creds for evaluate.ts)
├─ program.md                     HUMAN, stable. The rules.
├─ creative-research.md           HUMAN-distilled priors. Updates ~6mo.
├─ creative-research-images/      Referenced inline from creative-research.md
│    ├─ MANIFEST.md
│    ├─ bl-ridge.png (et al)
│    └─ ...
├─ swipe-file.md                  Brady's curated wild examples
├─ swipe-file/                    Image collection
│    └─ YYYY-MM-DD-slug.png
├─ experiment-log.md              Script-appended history. Agent reads. Never agent-writes.
├─ evaluate.ts                    LOCKED. Computes metric from Meta API.
├─ briefs/
│    ├─ 2026-05.md                Agent writes one per cycle.
│    ├─ 2026-06.md
│    └─ ...
├─ run-cycle.sh                   Kickoff script. Checks FROZEN, pulls Neon outcomes to log, launches Claude Code.
├─ package.json
├─ tsconfig.json
└─ FROZEN                         (optional) sentinel file. If present, run-cycle.sh aborts.
```

### File roles (Karpathy-mapped)

| Creative-pipeline file | Karpathy primitive | Role |
|---|---|---|
| `program.md` | `program.md` | The rules of the game. Stable, human-edited only. |
| `creative-research.md` | — (our addition) | Industry priors. Semi-stable; updated every ~6mo from KB research. |
| `swipe-file.md` + `swipe-file/` | — (our addition) | Brady's wild-caught examples. Agent reads index. |
| `creative-research-images/` | — (our addition) | Curated visual examples. Referenced inline from creative-research.md. |
| `experiment-log.md` | analog of `results.tsv` | Memory across cycles. Append-only. |
| `evaluate.ts` | `prepare.py` | The locked metric. Agent cannot modify. |
| `briefs/YYYY-MM.md` | `train.py` | The one file the agent writes per cycle. |

### Deliberate modifications from Karpathy

| Karpathy's pattern | Our change | Why |
|---|---|---|
| 5-min cycle | 30-day cycle | Physics: Meta CPA resolves over 2-3 weeks |
| Agent closes loop autonomously | Human approval gate + manual ship in v1 | Meta isn't a code runner; humans upload images + launch |
| `git reset --hard` to discard failures | No revert — every brief logs, outcomes track regardless | Can't un-ship an ad |
| Single variable optimization | 4×3 matrix diversity constraint | Post-Andromeda rewards concept diversity |
| `results.tsv` compact rows | `experiment-log.md` ~10-line entries per brief | Creative needs more fields than "val_bpb 0.9932" |
| Metric extractable mid-run | Partial-data tolerance: `status` field (proposed/shipped/live/resolved/killed) | At cycle N+1, some N-1 briefs still live |

## The cycle lifecycle

Each cycle is one calendar month. Here's what happens, step by step.

### Step 0 — preconditions (once)

On Brady's Mac:
- creative-pipeline repo scaffolded with program.md, creative-research.md, swipe-file.md, evaluate.ts, run-cycle.sh
- experiment-log.md seeded manually from historical SLE Meta data (see "Seeding" section)
- .env.local has Meta API token

Dashboard side:
- Neon schema migrated (see "Neon schema" section)
- `/workflows/creative-pipeline` route deployed
- Vercel cron `poll-meta-outcomes` scheduled daily

### Step 1 — Brady kicks off the cycle

```bash
cd ~/workspace/sle/products/creative-pipeline
./run-cycle.sh
```

`run-cycle.sh` does:
1. Checks `FROZEN` sentinel. If present, aborts with message (learning #1.5)
2. Checks lock file for stale PIDs (learning #1.5)
3. Reads Meta API via a sync script to pull any outcomes that resolved since last cycle
4. Appends new resolved outcomes to `experiment-log.md`
5. Kicks off Claude Code with a prompt that says: "Read program.md and run a new cycle"

### Step 2 — Agent reasons

The agent (Claude Code running locally in the repo root):

1. Reads `program.md` — the rules
2. Reads `creative-research.md` — the priors
3. Reads `swipe-file.md` — Brady's wild examples
4. Reads `experiment-log.md` — prior cycles' outcomes (partial for most recent cycle)
5. Reads `~/workspace/sle/context/brand-voice/sle-brandscript.md` — brand voice
6. Computes prior-cycle scores from the log (what's working, what's not)
7. Identifies hypotheses to test (iterate validated winners, test untouched matrix cells, retire dead concepts)
8. Generates 12 briefs into `briefs/YYYY-MM.md`, each annotated with:
   - brief_id (`YYYY-MM-cNN` format)
   - concept name, angle, funnel stage, matrix cell
   - layout archetype (from the archetypes list)
   - visual direction (what the image looks like)
   - on-image copy (headline, body, proof)
   - primary text (for the FB ad)
   - hypothesis/inspiration: which log entry or matrix gap this came from
9. Git commits `briefs/YYYY-MM.md` with message like `cycle 2026-05: generated 12 briefs`
10. Writes `run-metrics.json` (learning #1.7)
11. Exits cleanly

### Step 3 — Brady imports briefs to the dashboard

From the dashboard side (dev: reads local filesystem; prod: pulls from GitHub):

```bash
npm run import-briefs -- --cycle 2026-05
```

This parses `briefs/2026-05.md` and inserts 12 rows into Neon `creative_briefs` table with `status='proposed'`.

(In prod, this could be triggered by a GitHub Action on push to the creative-pipeline repo.)

### Step 4 — Brady reviews in the dashboard

Opens `/workflows/creative-pipeline/2026-05`. Sees:

- **Inputs loaded panel** — "Agent read: program.md (3.2kb), experiment-log.md (42 rows, 12 resolved), creative-research.md, swipe-file.md (3 entries), brand-voice"
- **Hypothesis trail** — for each of 12 briefs, which log entry or matrix gap inspired it
- **Matrix coverage** — 4×3 grid. Filled cells highlighted. Duplicates flagged.
- **Gate status** — brand voice check, duplicate check, matrix diversity check, sniff test (LLM-judged)
- **Brief cards** — 12 cards, each with layout archetype chip, copy snippets, "Push to Meta" button

### Step 5 — Brady pushes approved briefs to Meta

Per brief, clicks "Push to Meta." Server action does:

1. Calls `createAdCreative` via Meta SDK with:
   - Ad name: `{brief_id} · {concept name}` (e.g. `2026-05-c04 · BOI→SLC Sunday return savings`)
   - Primary text: brief's primary text field
   - Headline: brief's headline
   - Description: brief's description
   - Link URL: brief's landing URL
   - Image hash: placeholder (Brady uploads image manually in Ads Manager next)
2. Calls `createAd` under the correct ad set (determined by `matrix_stage` field)
3. Stores returned `meta_ad_id` in the `creative_briefs` row
4. Flips status to `pushed`

### Step 6 — Brady uploads image in Meta Ads Manager

Manual step. Brady opens the Meta ad draft, uploads the static image (created in Canva/MJ based on the brief's `visual_direction` field), reviews, launches.

When the ad goes live on Meta's end, next cron poll (step 7) will flip status to `live`.

### Step 7 — Vercel cron polls Meta (daily, 8am MT)

For every brief with status in (`pushed`, `live`):
1. Query Meta insights API for the `meta_ad_id`
2. Update row with: spend, cpa, ctr, frequency, impressions, purchases
3. Apply the existing `meta-ads-health` classifier:
   - If killed or natural fatigue → status = `resolved`
   - If still performing → status stays `live`
4. Attach decision (`winner` / `average` / `killed`) based on CPA vs target

### Step 8 — End of month: close the cycle

When all 12 briefs have status in (`resolved`, `killed`), or 60 days have passed:
1. Cycle is considered "closed"
2. Final score computed: `hit_rate × (target_cpa / avg_winner_cpa)`
3. Stored in `cycle_metrics` row for the Metric History panel

### Step 9 — Next cycle

Brady runs `./run-cycle.sh` again. Sync script pulls latest Neon data → appends to experiment-log.md. Agent reads updated log. Generates cycle 2026-06 briefs. Loop continues.

## Neon schema

### `creative_briefs` table

```sql
CREATE TABLE creative_briefs (
  brief_id          TEXT PRIMARY KEY,             -- '2026-05-c01'
  cycle_id          TEXT NOT NULL,                -- '2026-05'
  concept_name      TEXT NOT NULL,
  angle             TEXT NOT NULL,                -- price|convenience|social-proof|vs-driving
  funnel_stage      TEXT NOT NULL,                -- prospecting|retargeting|awareness
  matrix_cell       TEXT NOT NULL,                -- 'price×retargeting'
  layout_archetype  TEXT NOT NULL,                -- post-it|screenshot-dm|quote-card|...
  visual_direction  TEXT NOT NULL,                -- human-readable description
  primary_text      TEXT NOT NULL,
  headline          TEXT NOT NULL,
  description       TEXT,
  link_url          TEXT NOT NULL,
  hypothesis        TEXT,                         -- "inspired by 2026-03-c04 winner iteration"
  status            TEXT NOT NULL DEFAULT 'proposed',
                    -- proposed|pushed|live|resolved|killed
  meta_ad_id        TEXT,                         -- populated on push
  pushed_at         TIMESTAMPTZ,
  launched_at       TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  spend             NUMERIC,
  cpa               NUMERIC,
  ctr               NUMERIC,
  frequency         NUMERIC,
  impressions       INTEGER,
  purchases         INTEGER,
  decision          TEXT,                         -- winner|average|killed
  kill_reason       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_creative_briefs_cycle ON creative_briefs(cycle_id);
CREATE INDEX idx_creative_briefs_status ON creative_briefs(status);
CREATE INDEX idx_creative_briefs_meta_ad_id ON creative_briefs(meta_ad_id);
```

### `creative_cycle_metrics` table

```sql
CREATE TABLE creative_cycle_metrics (
  cycle_id         TEXT PRIMARY KEY,
  briefs_total     INTEGER NOT NULL,
  briefs_resolved  INTEGER NOT NULL,
  winners          INTEGER NOT NULL,              -- CPA < target
  average          INTEGER NOT NULL,              -- CPA within 1.5x target
  killed           INTEGER NOT NULL,              -- CPA > 1.5x target or kill rule fired
  avg_winner_cpa   NUMERIC,
  score            NUMERIC,                       -- hit_rate × (target_cpa / avg_winner_cpa)
  total_spend      NUMERIC,
  closed_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `creative_pipeline_runs` table (agent run log)

```sql
CREATE TABLE creative_pipeline_runs (
  run_id           TEXT PRIMARY KEY,              -- UUID or timestamp-based
  cycle_id         TEXT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  completed_at     TIMESTAMPTZ,
  agent_version    TEXT,                          -- Claude model + SHA
  inputs_loaded    JSONB,                         -- bytes/rows per file
  briefs_generated INTEGER,
  gate_results     JSONB,                         -- per-gate pass/fail + reasons
  metrics          JSONB,                         -- run-metrics.json contents
  status           TEXT NOT NULL                  -- success|failed|aborted
);
```

## The 6 visibility panels

Each panel is a window into a specific failure mode. These are the "breakage windows" Brady asked for.

### Panel 1 — Inputs loaded

Shows which files the agent read at cycle start and their sizes.

**Breaks caught:**
- If experiment-log.md shows 0 rows read, the agent had no memory — expect generic briefs
- If creative-research.md or swipe-file.md failed to read, priors were missing
- If brand-voice wasn't loaded, copy will drift

**Data:** `creative_pipeline_runs.inputs_loaded` JSONB.

### Panel 2 — Hypothesis trail

For each brief: which log entry or matrix gap inspired it, shown as a linked chip.

**Breaks caught:**
- Briefs generating without citing any log entry → agent flying blind
- All 12 briefs citing the same 1-2 log entries → lack of diverse hypothesis generation
- Briefs iterating on concepts that were killed 2 cycles ago → log-reading failure

**Data:** `creative_briefs.hypothesis` field per brief.

### Panel 3 — Matrix coverage

4×3 grid rendering. Each cell shows:
- Green check + brief count if occupied
- Yellow warning if >1 brief in cell (duplicate risk)
- Gray if empty

**Breaks caught:**
- Agent collapsing all 12 briefs to 2-3 matrix cells (no diversity)
- Unexpected empty cells (agent ignoring parts of the matrix)

**Data:** aggregated from `creative_briefs.matrix_cell` for the cycle.

### Panel 4 — Gate status

Four gates, shown separately (per learning #2.1 — don't let a gate failure hide the score):

| Gate | Type | Mechanism |
|---|---|---|
| Brand voice | Deterministic | Checks primary_text + headline against sle-brandscript.md banned words list |
| Duplicate (cross-cycle) | Deterministic | Compares concept_name + visual_direction against last 3 cycles' briefs |
| Matrix diversity | Deterministic | Rule: 12 briefs must occupy 10+ distinct matrix cells |
| Sniff test (LLM rubric) | LLM (Claude Haiku) | Runs creative-research.md Section 12 checklist against each brief |

Failures don't block push but are displayed prominently. Brady decides whether to override.

**Data:** `creative_pipeline_runs.gate_results` JSONB per run.

### Panel 5 — Push & outcome status

12 briefs × status. Shows:
- How many are still `proposed` (not pushed yet)
- How many are `pushed` / `live` / `resolved` / `killed`
- For resolved briefs: CPA, decision (winner/avg/killed)

**Breaks caught (most important):**
- If cycle N-1 shows 0/12 resolved at cycle N+1 kickoff, the Meta API polling is broken — the whole loop is broken
- If briefs stay stuck at `pushed` forever, the image-upload step isn't happening in Meta Ads Manager

**Data:** `creative_briefs` rows filtered by `cycle_id`.

### Panel 6 — Metric history

Line chart: one point per cycle, showing score over time.

Score = `hit_rate × (target_cpa / avg_winner_cpa)`

- Rising or flat-high → loop is working
- 3+ flat cycles → loop isn't hill-climbing, time to inspect program.md or priors
- Declining → something got worse; diagnose via gates and inputs panels

**Data:** `creative_cycle_metrics` rows.

## Meta API push mechanics

Leveraging the existing `facebook-nodejs-business-sdk` already in the dashboard.

### The push endpoint

`POST /api/creative-pipeline/push-brief/:briefId`

1. Loads brief from Neon
2. Calls Meta SDK to create an ad creative:
   ```ts
   const adAccount = new AdAccount(process.env.META_AD_ACCOUNT_ID!);
   const creative = await adAccount.createAdCreative([], {
     name: `${brief.brief_id} · ${brief.concept_name}`,
     object_story_spec: {
       page_id: SLE_PAGE_ID,
       link_data: {
         message: brief.primary_text,
         link: brief.link_url,
         name: brief.headline,
         description: brief.description,
         call_to_action: { type: 'BOOK_TRAVEL' },
       }
     }
   });
   ```
3. Creates an ad under the funnel-stage-matched ad set:
   ```ts
   const ad = await adAccount.createAd([], {
     name: `${brief.brief_id} · ${brief.concept_name}`,
     adset_id: getAdSetIdForStage(brief.funnel_stage),
     creative: { creative_id: creative.id },
     status: 'PAUSED',  // Brady uploads image then activates
   });
   ```
4. Updates Neon: `meta_ad_id`, `pushed_at`, `status = 'pushed'`
5. Returns the Meta ads manager URL for the ad draft

### Ad set mapping

Brady has 8 existing campaigns. The push endpoint needs a static mapping:

| Funnel stage | Campaign / ad set |
|---|---|
| prospecting | TOF campaigns (SLC, St George, Rexburg, Logan, Other) — route picked from brief's route/audience field |
| retargeting | Middle (A) Retargeting + Remarketing Condensed |
| awareness | Creative Testing - Incremental |

Mapping stored in `src/lib/workflows/creative-pipeline/meta-adset-map.ts`.

### Why ads go up `PAUSED`

Per learning #5.1 + #6.1: first 5 cycles are manual. Brady inspects each draft in Meta Ads Manager before activating. Prevents a push endpoint bug from auto-launching bad ads.

## Sync scripts

### `import-briefs.ts` (dashboard side)

Parses `briefs/YYYY-MM.md` (reading markdown headers) and upserts 12 rows into Neon.

Invoked via:
- Dev: `npm run import-briefs -- --cycle 2026-05`
- Prod: GitHub Action on push to creative-pipeline repo (future)

### `export-log-outcomes.ts` (creative-pipeline repo side)

Pulls resolved outcomes from Neon and appends to `experiment-log.md`.

Called by `run-cycle.sh` before the agent starts:
```bash
npx tsx export-log-outcomes.ts --since $(cat .last-sync)
```

## Evaluate.ts (the locked metric)

```ts
// DO NOT MODIFY without Brady's explicit approval
// The agent must not be able to change this file.

import { getCycleOutcomes } from './meta-client';

const TARGET_CPA = 9;  // Unit economics-derived
const WINNER_THRESHOLD = TARGET_CPA;
const SPEND_FLOOR = 200;  // Below this, classify as unresolved

export async function computeCycleScore(cycleId: string): Promise<{
  score: number;
  hit_rate: number;
  avg_winner_cpa: number;
  winners: number;
  total: number;
}> {
  const briefs = await getCycleOutcomes(cycleId);
  const resolved = briefs.filter(b =>
    b.status === 'resolved' && b.spend >= SPEND_FLOOR
  );

  const winners = resolved.filter(b => b.cpa < WINNER_THRESHOLD);
  const avg_winner_cpa = winners.length > 0
    ? winners.reduce((s, b) => s + b.cpa, 0) / winners.length
    : Infinity;

  const hit_rate = resolved.length > 0
    ? winners.length / resolved.length
    : 0;

  const score = winners.length === 0
    ? 0
    : winners.length * (TARGET_CPA / avg_winner_cpa);

  return { score, hit_rate, avg_winner_cpa, winners: winners.length, total: resolved.length };
}
```

Lives in the creative-pipeline repo. File is git-tracked with a README note making the lock explicit.

## Seeding experiment-log.md

One-time, manual. Brady and Claude together curate the initial log.

Approach:
1. Pull all SLE Meta ad-level data for the last 365 days from the existing Meta Ads service
2. Apply $200 spend floor — any ad below that is "unresolved" regardless of CPA
3. For each ad that cleared the floor, create a log entry:
   - Assign a pre-launch brief_id like `seed-NNNN`
   - Classify concept, angle, stage, layout archetype (from ad name + copy)
   - Record spend, final CPA, CTR, frequency at death, decision
4. Save to `experiment-log.md` as the starting state for cycle 1

This is task #13 in the task list. Probably 30-60 entries for a year of data.

## Program.md v0 skeleton

Brady + Claude will write `program.md` together as part of implementation. Draft skeleton:

```md
# SLE Creative Autoresearch — program.md

## Goal
Lower CPA on Meta static ads via continuous concept testing.
Metric: hit_rate × (target_cpa / avg_winner_cpa). Optimize upward.

## Simplicity criterion
Prefer single-angle briefs over stacked concepts. Clean wins over Frankenstein.

## Unit economics
Target CPA: $9. Max CAC: $11.74 at 3:1 on 43% margin. Median order $82.
Defined in evaluate.ts.

## The matrix
4 angles (price, convenience, social-proof, vs-driving) × 3 stages (prospecting, retargeting, awareness) = 12 cells.
Rule: 12 briefs must occupy 10+ distinct cells.

## Brand voice (DO-NOT-MODIFY — Brady-managed)
See ~/workspace/sle/context/brand-voice/sle-brandscript.md
Banned words: [list]

## Files in scope
Agent reads: program.md, creative-research.md, swipe-file.md, experiment-log.md,
brand-voice/sle-brandscript.md, briefs/ (prior 3 cycles).
Agent writes: briefs/YYYY-MM.md for the current cycle only.

## Iteration cap
12 briefs exactly. Not 10, not 15.
First 5 cycles: Brady reviews every brief before Push to Meta.

## Simplicity tax
If two briefs share a matrix cell, drop one.
If visual direction needs >6 elements to describe, simplify or replace.
If a brief fails the sniff test (creative-research.md §12), rewrite or drop.
```

## Observability & failure modes

Per Kim-loop learnings, every automated surface needs a visibility escape hatch.

| Failure | Detection | Recovery |
|---|---|---|
| Agent context too large (image limit) | Run fails in Claude Code | Run in terminal session not inheriting oversized images |
| Meta API token expired | Push endpoint 401 | Rotate token, update .env and Vercel env |
| Matrix gate fails | Gate status panel red | Brady reviews, can override for cycle or ask agent to regenerate |
| Cron poll fails | Cycle status stuck at `pushed` in panel 5 | Manual retry endpoint, check Meta API status |
| Cycle's score is zero | Metric history panel shows drop | Check panel 4 (gates), panel 1 (inputs). Often upstream — program.md tune |
| Stale outcomes in log | Sync script not firing | Check `.last-sync` file, re-run `export-log-outcomes.ts` |
| Brief naming collision in Meta | Push endpoint error | brief_id format enforced (`YYYY-MM-cNN`) — collisions mean logic bug |

## Testing

### Unit tests
- `evaluate.ts` — given fixture briefs with known CPAs, compute correct score
- `import-briefs.ts` — parse briefs markdown into Neon rows
- Gate checks — brand voice, duplicate, matrix diversity each have test fixtures

### Integration tests
- Push endpoint against Meta's sandbox (if available) or mocked SDK
- Cron poll against mocked Meta insights response
- Full cycle smoke test: fixture brief → push → mock outcome → log append → score compute

### Manual verification (Brady)
- Run cycle 1 end-to-end with seeded log
- Inspect each visibility panel for correctness
- Verify brief-to-meta-ad correlation by ad name convention in Meta Ads Manager

## Open questions

1. **Where does the dashboard read briefs files from in prod?** Options: (a) GitHub API on push to creative-pipeline repo, (b) separate deploy of a small sync worker, (c) Brady manually clicks "Sync" in dashboard in dev mode on his Mac. Starting with (c) for v1.
2. **AI model for brief generation?** The agent IS Claude Code running locally. Model = whatever Brady has configured (Opus / Sonnet). No separate model config needed.
3. **Gate rubric strictness.** How strict is the sniff test LLM rubric? Starts generous; tune after cycle 3-5 based on which rewrites were actually needed.

## Future considerations (explicitly out of v1)

- **Foreplay / competitor swipe API subscription** — consider after cycle 4-6 if hit rate plateaus. Solves discovery breadth; adds a second signal source for pattern novelty.
- **Automated image generation** — agent produces the PNG, not just the brief. Requires Midjourney/Ideogram API + human review. Ship when brief format is stable and image-generation quality can match Brady's current Canva output.
- **Automated launchd cycle kickoff** — after 5+ clean manual cycles, consider scheduled runs. Per learning #5.3 (mode defaults to shadow).
- **Outer loop that updates program.md** — the real autoresearch. Requires N cycles of data showing the agent can reliably improve briefs when program.md changes. Multi-quarter project.
- **Multi-tenant** — expanding the pipeline pattern to the bookkeeping acquisition or Transitly marketing. Same framework, different program.md + unit economics + matrix. Revisit after SLE cycles are proven.
- **Image-variant generation** — once a brief has a validated winner, auto-generate iterations within the concept (different color, different layout, different crop). Post-Andromeda, this is the "30% iterations" bucket of 60-30-10.

## Implementation ordering (for the plan)

1. **Scaffold the creative-pipeline repo** — program.md, creative-research.md (from bootstrap), swipe-file.md (from bootstrap), evaluate.ts, run-cycle.sh, README
2. **Seed experiment-log.md** — manual curation from 365-day Meta data
3. **Neon schema** — 3 tables
4. **Dashboard workflow page scaffold** — `/workflows/creative-pipeline` with route, basic layout
5. **Import-briefs sync script** — parses markdown, inserts to Neon
6. **Brief cards + gate status panels** — render briefs from Neon, compute deterministic gates
7. **Push to Meta endpoint** — SDK integration, ad set mapping
8. **Matrix coverage + hypothesis trail panels** — derived from brief rows
9. **Cron poll for Meta outcomes** — update brief rows daily
10. **Push & outcome panel + metric history panel** — final visibility surfaces
11. **Sniff test LLM gate** — Haiku rubric integration
12. **Run cycle 1 end-to-end** — manual verification, fix rough edges
13. **Export-log-outcomes sync script** — reverse direction, for cycle 2 kickoff

The implementation plan (writing-plans skill) will break each of these into detailed tasks.

## Success criteria for v1

After 3 cycles:
- Brief-to-outcome correlation working (panel 5 shows ≥10/12 resolved per closed cycle)
- Metric history (panel 6) has 3 data points
- Brady has not manually edited any brief (the agent's output is shippable as-is)
- The sniff test gate has caught at least one bad brief before ship
- CPW is flat-or-falling (even if score is still early-noisy)

After 6 cycles:
- Score trend is visibly improving
- Hit rate stabilizes ≥8% (minus 1σ from the 10% industry baseline)
- Brady has upgraded program.md at least once based on what the cycles revealed

Not a v1 success criterion: CPA < target, or specific ROAS numbers. Those are outputs of a working system over many cycles, not inputs to "did v1 ship correctly."
