# Creative Pipeline Autoresearch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a monthly Meta static creative pipeline applying Karpathy's autoresearch pattern. Local agent writes 12 briefs per cycle → dashboard ships via Meta API → cron polls CPA outcomes → experiment log updates → next cycle.

**Architecture:** Two repos. `creative-pipeline/` (new, local) houses agent working files. `marketing-director-dashboard/` (existing) gets a new workflow page that reads briefs, pushes to Meta, monitors outcomes. Score = `hit_rate × (target_cpa / avg_winner_cpa)`.

**Tech Stack:** TypeScript, Next.js 15, Drizzle ORM + Neon Postgres, facebook-nodejs-business-sdk, Vercel cron, Claude Code (agent runs locally), Tailwind + shadcn/ui.

**Design spec:** `docs/superpowers/specs/2026-04-17-creative-pipeline-autoresearch-design.md`

**Bootstrap content lives at:** `~/workspace/personal/knowledge-base/output/creative-pipeline-bootstrap/` (contains `creative-research.md`, `creative-research-images/`, `swipe-file.md`, `swipe-file/`). This content moves into the new creative-pipeline repo as part of Phase 1.

---

## File Structure

### New repo: `~/workspace/sle/products/creative-pipeline/`

```
creative-pipeline/
├── README.md
├── .gitignore
├── .env.local.example
├── package.json
├── tsconfig.json
├── program.md                       (Phase 1)
├── creative-research.md             (Phase 1, copied from bootstrap)
├── creative-research-images/        (Phase 1, copied from bootstrap)
│    ├── MANIFEST.md
│    └── *.png, *.jpg
├── swipe-file.md                    (Phase 1, copied from bootstrap)
├── swipe-file/                      (Phase 1)
│    └── *.png
├── experiment-log.md                (Phase 1, seeded from Meta data)
├── evaluate.ts                      (Phase 1)
├── evaluate.test.ts                 (Phase 1)
├── meta-client.ts                   (Phase 1, small wrapper for evaluate)
├── export-log-outcomes.ts           (Phase 7)
├── run-cycle.sh                     (Phase 1)
├── briefs/                          (empty initially)
└── FROZEN                           (not created; sentinel only)
```

### Modified repo: `~/workspace/sle/products/marketing-director-dashboard/`

```
src/
├── db/schema.ts                                  (Phase 2: +3 tables)
├── drizzle/                                      (Phase 2: migration)
├── lib/workflows/creative-pipeline/
│    ├── types.ts                                 (Phase 2)
│    ├── meta-adset-map.ts                        (Phase 4)
│    ├── parse-briefs.ts                          (Phase 3)
│    ├── parse-briefs.test.ts                     (Phase 3)
│    ├── parse-experiment-log.ts                  (Phase 5)
│    ├── gates/
│    │    ├── brand-voice.ts                      (Phase 3)
│    │    ├── brand-voice.test.ts                 (Phase 3)
│    │    ├── duplicate.ts                        (Phase 3)
│    │    ├── duplicate.test.ts                   (Phase 3)
│    │    ├── matrix-diversity.ts                 (Phase 3)
│    │    ├── matrix-diversity.test.ts            (Phase 3)
│    │    └── sniff-test.ts                       (Phase 6)
│    └── compute-score.ts                         (Phase 5)
├── app/api/creative-pipeline/
│    ├── import-briefs/route.ts                   (Phase 3)
│    ├── push-brief/[briefId]/route.ts            (Phase 4)
│    ├── cycles/route.ts                          (Phase 5)
│    └── cycle/[cycleId]/route.ts                 (Phase 5)
├── app/api/cron/
│    └── poll-meta-outcomes/route.ts              (Phase 5)
├── app/workflows/creative-pipeline/
│    ├── page.tsx                                 (Phase 3)
│    └── [cycleId]/page.tsx                       (Phase 3 + Phase 5)
├── components/workflows/creative-pipeline/
│    ├── brief-card.tsx                           (Phase 3)
│    ├── matrix-coverage.tsx                      (Phase 3)
│    ├── hypothesis-trail.tsx                     (Phase 3)
│    ├── inputs-loaded.tsx                        (Phase 3)
│    ├── gate-status.tsx                          (Phase 3)
│    ├── push-outcome.tsx                         (Phase 5)
│    └── metric-history.tsx                       (Phase 5)
└── lib/workflows.ts                              (Phase 2: swap placeholder)
```

---

## Phase 1 — Creative-pipeline repo scaffold + seed

Goal: Brady can run `./run-cycle.sh` and the agent generates 12 briefs into `briefs/YYYY-MM.md`. This phase delivers a working local cycle with no dashboard involvement.

### Task 1: Scaffold creative-pipeline repo

**Files:**
- Create: `~/workspace/sle/products/creative-pipeline/README.md`
- Create: `~/workspace/sle/products/creative-pipeline/.gitignore`
- Create: `~/workspace/sle/products/creative-pipeline/.env.local.example`
- Create: `~/workspace/sle/products/creative-pipeline/package.json`
- Create: `~/workspace/sle/products/creative-pipeline/tsconfig.json`

- [ ] **Step 1: Create repo directory and init git**

```bash
mkdir -p ~/workspace/sle/products/creative-pipeline
cd ~/workspace/sle/products/creative-pipeline
git init
```

- [ ] **Step 2: Write README.md**

```markdown
# SLE Creative Autoresearch

Monthly Meta static creative pipeline. Agent generates 12 briefs per cycle based on program.md rules + creative-research.md priors + experiment-log.md history. Dashboard at marketing-director-dashboard/workflows/creative-pipeline reads the outputs.

## Run a cycle

```
./run-cycle.sh
```

This checks the FROZEN sentinel, pulls latest Meta outcomes to experiment-log.md, then launches Claude Code to generate `briefs/YYYY-MM.md`.

## Files the agent edits

Only `briefs/YYYY-MM.md` for the current cycle. Everything else is human-managed or script-appended.

## Files the agent reads

- program.md — rules of the game
- creative-research.md — industry priors (updates every ~6mo)
- creative-research-images/ — annotated visual examples
- swipe-file.md + swipe-file/ — Brady's curated real-world examples
- experiment-log.md — prior cycles' outcomes
- briefs/ — recent cycles' briefs (for concept-avoidance)
- ~/workspace/sle/context/brand-voice/sle-brandscript.md

## Metric (locked)

`evaluate.ts` computes `hit_rate × (target_cpa / avg_winner_cpa)`. Target CPA = $9. Spend floor = $200.

## Sentinel

Touch `FROZEN` to pause the loop. `run-cycle.sh` aborts if the file exists.
```

- [ ] **Step 3: Write .gitignore**

```
node_modules/
.env.local
.last-sync
run.log
run-metrics.json
FROZEN
```

- [ ] **Step 4: Write .env.local.example**

```
# Copy to .env.local and fill in
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=act_1599255740369627
POSTGRES_URL=
```

- [ ] **Step 5: Write package.json**

```json
{
  "name": "creative-pipeline",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "export-log": "tsx export-log-outcomes.ts",
    "evaluate": "tsx evaluate.ts"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "facebook-nodejs-business-sdk": "^21.0.5",
    "pg": "^8.12.0"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "@types/pg": "^8.11.6",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 6: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "types": ["node", "vitest/globals"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "briefs"]
}
```

- [ ] **Step 7: Install deps**

```bash
cd ~/workspace/sle/products/creative-pipeline
npm install
```

Expected: package-lock.json created, node_modules populated.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: scaffold creative-pipeline repo"
```

### Task 2: Write program.md v0

**Files:**
- Create: `~/workspace/sle/products/creative-pipeline/program.md`

- [ ] **Step 1: Write program.md**

```markdown
# SLE Creative Autoresearch — program.md

## Goal

Lower CPA on Meta static ads via continuous concept testing.
Optimization metric: `hit_rate × (target_cpa / avg_winner_cpa)`. Higher is better.
Computed by `evaluate.ts` — you cannot modify that file.

## Your job per cycle

Read the rules (this file), the priors (creative-research.md), Brady's wild-caught examples (swipe-file.md), and the history (experiment-log.md). Then write exactly 12 concept briefs into `briefs/YYYY-MM.md` for the current month.

## Simplicity criterion (load-bearing)

Prefer single-angle briefs over stacked concepts. A clean concept beating target CPA > a multi-hook Frankenstein beating target CPA. If simpler wording works, use simpler. Fewer layout elements that still work > more layout elements.

## Unit economics (context — don't re-derive)

- Target CPA: $9 (enforced by evaluate.ts — 1.3x over-attribution buffer from actual max $11.74)
- Max CAC for 3:1 on 43% regular-route margin: $11.74
- Median order value: $82
- Meta over-attributes by ~1.3x vs BigQuery ground truth (already baked into target)
- Spend floor: a concept needs ≥$200 total spend to count as "resolved"

## The matrix (diversity constraint)

4 angles × 3 funnel stages = 12 cells.

**Angles:** price, convenience, social-proof, vs-driving
**Stages:** prospecting, retargeting, awareness

**Rule:** 12 briefs must occupy ≥10 distinct matrix cells. Matrix-diversity gate fails otherwise.

## Brand voice (DO-NOT-MODIFY — Brady-managed)

Full context: `~/workspace/sle/context/brand-voice/sle-brandscript.md`

You MUST NOT rewrite or override this section. If Brady updates the brandscript, the gate picks up new rules on next cycle.

Summary from the brandscript (defer to the source for authoritative list):
- Always cite route names when a price is mentioned
- Required tone: direct, specific, human
- Banned words (non-exhaustive, see brandscript for full list): [populated from brandscript]

## What has been tested (read experiment-log.md)

Treat concepts with spend < $200 as unresolved regardless of CPA. Don't re-propose a concept killed within 60 days unless the reason was external (brand asset change, seasonality mismatch, etc.).

## Files in scope

**You read:**
- `program.md` (this file)
- `creative-research.md`
- `creative-research-images/` (reference when a visual rule matters)
- `swipe-file.md`
- `experiment-log.md`
- `~/workspace/sle/context/brand-voice/sle-brandscript.md`
- `briefs/` directory (the last 3 months' files — for concept-avoidance only)

**You write:**
- `briefs/YYYY-MM.md` for the current cycle only. Exactly one file. Nothing else.

Do not edit any other file under any circumstance.

## Brief generation rules

Generate exactly 12 briefs. Not 10, not 15. Each brief must include:

- brief_id: `YYYY-MM-cNN` (NN = 01..12)
- concept_name: short phrase, future-you can remember
- concept_type: `new` | `iteration of <brief_id>` | `mashup of <brief_id> + <brief_id>`
- angle: one of price, convenience, social-proof, vs-driving
- funnel_stage: one of prospecting, retargeting, awareness
- matrix_cell: `<angle>×<stage>`
- layout_archetype: pick from creative-research.md §5 (post-it, screenshot-dm, quote-card, receipt-tally, handwritten-note, ticket, text-message, before-after-split, advertorial, us-vs-them, meme, real-world-sign, or invent if strongly justified)
- visual_direction: 2-4 sentences describing what the image shows at 100ms gist. Include what makes it NOT look like an ad.
- primary_text: ~40-125 chars — the first 125 are visible before "See More"
- headline: 4-6 words max
- description: optional 1-liner, OK to omit
- cta: one of BOOK_TRAVEL, SHOP_NOW, LEARN_MORE
- link_url: `https://saltlakeexpress.com/{route-specific-slug-if-applicable}`
- hypothesis: 1-2 sentences on what this brief is testing and which log entry or matrix gap inspired it (required for hypothesis-trail panel)

## Sniff test (self-check before finalizing each brief)

See creative-research.md §12 for the 11-point checklist. If 2+ red flags fire, rewrite or replace the brief.

## Iteration cap + human-in-loop

Generate exactly 12 briefs. First 5 cycles: Brady reviews every brief before Push to Meta. Do not assume autonomy — you generate, he ships.

## Simplicity tax enforcement

If two briefs share a matrix cell, drop one.
If visual direction needs >6 elements to describe, simplify or replace.
If a brief stacks multiple angles ("price AND comfort AND convenience"), split into separate briefs or drop.
If a brief fails the sniff test and you can't rewrite it to pass, drop and replace with a new concept.

## What counts as "resolved" in the log

- `status=resolved` AND `spend ≥ $200`: trust the CPA
- `status=resolved` AND `spend < $200`: don't use this entry for winner classification
- `status=killed`: the ad was pulled for fatigue/CPA reasons; trust the kill signal
- `status=live` or `status=pushed`: no final verdict yet — use for "in-flight" awareness but not as learning input

## When priors fight the log

The log is authoritative over priors in creative-research.md. If the log shows that SLE's audience responds to something contrary to the priors (e.g., a polished studio shot has won twice with spend ≥ $200), trust the log. Flag the contradiction in the brief's hypothesis field.

Industry consensus applies to the average. SLE's specific audience may have edge patterns.
```

- [ ] **Step 2: Commit**

```bash
git add program.md
git commit -m "docs: add program.md v0 — the rules of the game"
```

### Task 3: Copy bootstrap content (creative-research, swipe-file)

**Files:**
- Copy: `~/workspace/personal/knowledge-base/output/creative-pipeline-bootstrap/creative-research.md` → repo root
- Copy: `~/workspace/personal/knowledge-base/output/creative-pipeline-bootstrap/creative-research-images/` → repo root
- Copy: `~/workspace/personal/knowledge-base/output/creative-pipeline-bootstrap/swipe-file.md` → repo root
- Copy: `~/workspace/personal/knowledge-base/output/creative-pipeline-bootstrap/swipe-file/` → repo root

- [ ] **Step 1: Copy files**

```bash
cd ~/workspace/sle/products/creative-pipeline
cp ~/workspace/personal/knowledge-base/output/creative-pipeline-bootstrap/creative-research.md .
cp ~/workspace/personal/knowledge-base/output/creative-pipeline-bootstrap/swipe-file.md .
cp -r ~/workspace/personal/knowledge-base/output/creative-pipeline-bootstrap/creative-research-images .
cp -r ~/workspace/personal/knowledge-base/output/creative-pipeline-bootstrap/swipe-file .
```

- [ ] **Step 2: Fix the path reference in creative-research.md header**

In the first paragraph ("Synthesized 2026-04-17... Staging location; moves to `~/workspace/sle/products/creative-pipeline/creative-research.md` when repo is created."):

Edit to remove the "staging location; moves to..." note — the file is now AT its permanent location.

Change:
```
Synthesized 2026-04-17 from 20 canonical sources on Meta static creative mechanics. Staging location; moves to `~/workspace/sle/products/creative-pipeline/creative-research.md` when repo is created.
```

To:
```
Synthesized 2026-04-17 from 20 canonical sources on Meta static creative mechanics.
```

- [ ] **Step 3: Verify file count**

```bash
ls creative-research-images/ | wc -l  # expect 33 (32 images + MANIFEST.md)
ls swipe-file/ | wc -l                 # expect 1 (Brunson png)
```

- [ ] **Step 4: Commit**

```bash
git add creative-research.md creative-research-images swipe-file.md swipe-file
git commit -m "docs: add creative-research priors and swipe-file bootstrap"
```

### Task 4: Seed experiment-log.md from historical Meta data

**Files:**
- Create: `~/workspace/sle/products/creative-pipeline/experiment-log.md`

This task is manual curation (not TDD). Brady + Claude collaborate on the seed content in a separate session.

- [ ] **Step 1: Pull 365-day Meta ad-level data via existing dashboard**

In the dashboard project:

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
GOOGLE_APPLICATION_CREDENTIALS="/Users/brady/credentials/bigquery-service-account.json" npx tsx scripts/fetch-meta-365-for-seed.ts > /tmp/meta-365-seed.json
```

(The `scripts/fetch-meta-365-for-seed.ts` script is a one-time fetcher — write it as part of this task: loads env, calls `getAdInsights` with a date range back to 2025-04-17, outputs JSON.)

Script content:

```ts
// scripts/fetch-meta-365-for-seed.ts
import 'dotenv/config';
import { AdAccount } from 'facebook-nodejs-business-sdk';
import { FacebookAdsApi } from 'facebook-nodejs-business-sdk';

FacebookAdsApi.init(process.env.META_ACCESS_TOKEN!);
const account = new AdAccount(process.env.META_AD_ACCOUNT_ID!);

async function main() {
  const ads = await account.getAds(
    ['id', 'name', 'adset_id', 'campaign_id', 'creative', 'status'],
    { limit: 500 }
  );

  const results: any[] = [];

  for (const ad of ads) {
    const insights = await ad.getInsights(
      ['spend', 'actions', 'action_values', 'ctr', 'frequency', 'impressions', 'clicks'],
      {
        time_range: { since: '2025-04-17', until: '2026-04-17' },
      }
    );
    if (insights.length === 0) continue;
    const r = insights[0];
    results.push({
      ad_id: ad.id,
      ad_name: ad.name,
      spend: Number(r.spend || 0),
      ctr: Number(r.ctr || 0),
      frequency: Number(r.frequency || 0),
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
      purchases: Number(
        (r.actions || []).find((a: any) => a.action_type === 'purchase')?.value || 0
      ),
      cpa:
        Number(
          (r.actions || []).find((a: any) => a.action_type === 'purchase')?.value || 0
        ) > 0
          ? Number(r.spend) /
            Number(
              (r.actions || []).find((a: any) => a.action_type === 'purchase')?.value || 0
            )
          : null,
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
```

- [ ] **Step 2: Filter + classify**

Claude reads `/tmp/meta-365-seed.json`, filters to ads with spend ≥ $200, and for each one produces an experiment-log entry by:
- Assigning `brief_id: seed-NNNN` (sequential)
- Classifying `angle` from the ad name + copy (best guess — Brady overrides)
- Classifying `funnel_stage` from the campaign name (TOF = prospecting, Middle = retargeting, etc.)
- Classifying `layout_archetype` from what's visible in Meta's ad preview (best guess)
- Recording `spend`, `cpa`, `ctr`, `frequency`, `impressions`, `purchases`
- Assigning `decision` (winner if CPA < $9, average if < $14, else killed)

Write to `experiment-log.md` in the format defined in the spec.

- [ ] **Step 3: Review with Brady**

Brady scans the seeded log, flags miscategorized entries, corrects in place.

- [ ] **Step 4: Commit**

```bash
cd ~/workspace/sle/products/creative-pipeline
git add experiment-log.md
git commit -m "data: seed experiment-log.md from 365-day Meta history"
```

### Task 5: Write evaluate.ts (locked metric calculator) + test

**Files:**
- Create: `~/workspace/sle/products/creative-pipeline/meta-client.ts`
- Create: `~/workspace/sle/products/creative-pipeline/evaluate.ts`
- Create: `~/workspace/sle/products/creative-pipeline/evaluate.test.ts`

- [ ] **Step 1: Write failing test**

`evaluate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeCycleScore } from './evaluate';

describe('computeCycleScore', () => {
  it('returns score=0 when zero winners', () => {
    const briefs = [
      { spend: 500, cpa: 15, status: 'resolved' },
      { spend: 500, cpa: 20, status: 'killed' },
    ];
    const result = computeCycleScore(briefs as any);
    expect(result.score).toBe(0);
    expect(result.winners).toBe(0);
  });

  it('computes score = winners * (target/avg_cpa)', () => {
    const briefs = [
      { spend: 500, cpa: 6, status: 'resolved' },
      { spend: 500, cpa: 8, status: 'resolved' },
      { spend: 500, cpa: 20, status: 'killed' },
    ];
    const result = computeCycleScore(briefs as any);
    // target=9, avg_winner_cpa=(6+8)/2=7
    // score = 2 * (9/7) = 2.571
    expect(result.winners).toBe(2);
    expect(result.avg_winner_cpa).toBe(7);
    expect(result.score).toBeCloseTo(2 * (9 / 7));
  });

  it('excludes entries below spend floor', () => {
    const briefs = [
      { spend: 100, cpa: 4, status: 'resolved' }, // below floor
      { spend: 500, cpa: 8, status: 'resolved' },
    ];
    const result = computeCycleScore(briefs as any);
    expect(result.winners).toBe(1); // only the spend >= 200 one
    expect(result.total).toBe(1);
  });

  it('ignores live and proposed entries', () => {
    const briefs = [
      { spend: 500, cpa: 8, status: 'resolved' },
      { spend: 500, cpa: 5, status: 'live' },
      { spend: 0, cpa: null, status: 'proposed' },
    ];
    const result = computeCycleScore(briefs as any);
    expect(result.total).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd ~/workspace/sle/products/creative-pipeline
npm test evaluate.test.ts
```

Expected: FAIL with "computeCycleScore is not a function" (or similar module-not-found error).

- [ ] **Step 3: Write evaluate.ts**

```ts
// DO NOT MODIFY without Brady's explicit approval.
// The agent must not change this file — it's the frozen metric (prepare.py equivalent).

export const TARGET_CPA = 9;
export const SPEND_FLOOR = 200;

export interface BriefOutcome {
  spend: number;
  cpa: number | null;
  status: 'proposed' | 'pushed' | 'live' | 'resolved' | 'killed';
}

export interface CycleScore {
  score: number;
  hit_rate: number;
  avg_winner_cpa: number;
  winners: number;
  total: number;
}

export function computeCycleScore(briefs: BriefOutcome[]): CycleScore {
  const resolved = briefs.filter(
    b => (b.status === 'resolved' || b.status === 'killed') && b.spend >= SPEND_FLOOR
  );

  const winners = resolved.filter(b => b.cpa !== null && b.cpa < TARGET_CPA);
  const avg_winner_cpa =
    winners.length > 0
      ? winners.reduce((s, b) => s + (b.cpa || 0), 0) / winners.length
      : 0;

  const hit_rate = resolved.length > 0 ? winners.length / resolved.length : 0;

  const score =
    winners.length === 0 ? 0 : winners.length * (TARGET_CPA / avg_winner_cpa);

  return {
    score,
    hit_rate,
    avg_winner_cpa,
    winners: winners.length,
    total: resolved.length,
  };
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test evaluate.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Write meta-client.ts wrapper (needed by export-log-outcomes.ts later)**

```ts
// meta-client.ts — thin wrapper around the SDK for local scripts.
import 'dotenv/config';
import { FacebookAdsApi, Ad } from 'facebook-nodejs-business-sdk';

let initialized = false;
export function initMetaApi() {
  if (initialized) return;
  FacebookAdsApi.init(process.env.META_ACCESS_TOKEN!);
  initialized = true;
}

export async function getAdInsights(metaAdId: string) {
  initMetaApi();
  const ad = new Ad(metaAdId);
  const insights = await ad.getInsights(
    ['spend', 'actions', 'ctr', 'frequency', 'impressions'],
    { date_preset: 'maximum' }
  );
  if (insights.length === 0) return null;
  const r = insights[0];
  const purchases = Number(
    (r.actions || []).find((a: any) => a.action_type === 'purchase')?.value || 0
  );
  const spend = Number(r.spend || 0);
  return {
    spend,
    cpa: purchases > 0 ? spend / purchases : null,
    ctr: Number(r.ctr || 0),
    frequency: Number(r.frequency || 0),
    impressions: Number(r.impressions || 0),
    purchases,
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add evaluate.ts evaluate.test.ts meta-client.ts
git commit -m "feat: add locked evaluate.ts metric calculator with tests"
```

### Task 6: Write run-cycle.sh

**Files:**
- Create: `~/workspace/sle/products/creative-pipeline/run-cycle.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# run-cycle.sh — kicks off a creative pipeline cycle.
# Usage: ./run-cycle.sh [--skip-sync]

set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"

# 1. FROZEN sentinel check (learning #1.5)
if [[ -f FROZEN ]]; then
  echo "❌ FROZEN sentinel present. Remove it to run the cycle."
  exit 1
fi

# 2. Stale-PID check
LOCK="$REPO/.lock"
if [[ -f "$LOCK" ]]; then
  PID=$(cat "$LOCK")
  if kill -0 "$PID" 2>/dev/null; then
    echo "❌ Another cycle is running (PID $PID). Abort."
    exit 1
  else
    echo "⚠️  Stale lock file (dead PID $PID). Removing."
    rm "$LOCK"
  fi
fi
echo "$$" > "$LOCK"
trap "rm -f '$LOCK'" EXIT

# 3. Load env (learning #1.2 — launchd/shell does not inherit)
set -a
[[ -f .env.local ]] && source .env.local
set +a

# 4. Pull latest outcomes into experiment-log.md
if [[ "${1:-}" != "--skip-sync" ]]; then
  echo "📥 Syncing resolved outcomes from Neon..."
  npx tsx export-log-outcomes.ts
fi

# 5. Launch Claude Code agent with the right prompt
CYCLE_ID=$(date +%Y-%m)
echo "🚀 Starting cycle $CYCLE_ID. Launching Claude Code..."
echo ""

perl -e 'alarm shift; exec @ARGV' 3600 claude \
  -p "Read program.md and run cycle $CYCLE_ID. Follow all rules in program.md. Generate exactly 12 briefs into briefs/$CYCLE_ID.md. Do not edit any other file." \
  2>&1 | tee run.log

echo ""
echo "✅ Cycle $CYCLE_ID complete. Review briefs/$CYCLE_ID.md, then run the dashboard import."
```

(Note: `perl -e 'alarm shift; exec @ARGV' 3600` is the macOS-compatible `timeout 3600` from learning #1.1.)

- [ ] **Step 2: chmod + smoke test**

```bash
chmod +x run-cycle.sh
./run-cycle.sh --skip-sync 2>&1 | head -5
```

Expected: script starts, hits Claude Code launch — you can Ctrl+C once you see it's working. Don't actually run a full cycle as part of setup.

- [ ] **Step 3: Commit**

```bash
git add run-cycle.sh
git commit -m "feat: add run-cycle.sh with FROZEN/lock/sync guards"
```

### Task 7: Write export-log-outcomes.ts stub

This fully materializes in Phase 7 once the dashboard side exists. For Phase 1 we write a placeholder so `run-cycle.sh --skip-sync` works; real implementation deferred.

**Files:**
- Create: `~/workspace/sle/products/creative-pipeline/export-log-outcomes.ts`

- [ ] **Step 1: Write stub**

```ts
// export-log-outcomes.ts
// Pulls resolved outcomes from Neon, appends them to experiment-log.md.
// Phase 1: stub — prints a message and exits. Real impl in Phase 7.

console.log('[export-log-outcomes] stub — implementation deferred to Phase 7');
console.log('[export-log-outcomes] no new entries appended this run');
process.exit(0);
```

- [ ] **Step 2: Commit**

```bash
git add export-log-outcomes.ts
git commit -m "stub: export-log-outcomes.ts (Phase 7 impl)"
```

**End of Phase 1 verification:** Brady can run `./run-cycle.sh --skip-sync` (once he has experiment-log.md seeded and .env.local populated). Agent reads program.md + creative-research.md + log + swipe-file + brand-voice, generates `briefs/2026-05.md`. File is committed by the agent.

---

## Phase 2 — Neon schema + workflow registration

Goal: Database schema ready. Dashboard workflows.ts updated to reflect the new workflow.

### Task 8: Add schema for 3 new tables

**Files:**
- Modify: `~/workspace/sle/products/marketing-director-dashboard/src/db/schema.ts`

- [ ] **Step 1: Read the existing schema.ts to match conventions**

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
cat src/db/schema.ts | head -50
```

Note the existing patterns (table naming, column types, timestamps).

- [ ] **Step 2: Add three tables at the end of schema.ts**

Append to `src/db/schema.ts`:

```ts
// Creative Pipeline Autoresearch
// Brief-level records (one row per concept per cycle).

export const creativeBriefs = pgTable('creative_briefs', {
  briefId: text('brief_id').primaryKey(),           // '2026-05-c01'
  cycleId: text('cycle_id').notNull(),              // '2026-05'
  conceptName: text('concept_name').notNull(),
  angle: text('angle').notNull(),                   // price|convenience|social-proof|vs-driving
  funnelStage: text('funnel_stage').notNull(),      // prospecting|retargeting|awareness
  matrixCell: text('matrix_cell').notNull(),        // 'price×retargeting'
  layoutArchetype: text('layout_archetype').notNull(),
  visualDirection: text('visual_direction').notNull(),
  primaryText: text('primary_text').notNull(),
  headline: text('headline').notNull(),
  description: text('description'),
  cta: text('cta').notNull().default('BOOK_TRAVEL'),
  linkUrl: text('link_url').notNull(),
  hypothesis: text('hypothesis'),
  status: text('status').notNull().default('proposed'),
    // proposed|pushed|live|resolved|killed
  metaAdId: text('meta_ad_id'),
  pushedAt: timestamp('pushed_at', { withTimezone: true }),
  launchedAt: timestamp('launched_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  spend: numeric('spend'),
  cpa: numeric('cpa'),
  ctr: numeric('ctr'),
  frequency: numeric('frequency'),
  impressions: integer('impressions'),
  purchases: integer('purchases'),
  decision: text('decision'),                       // winner|average|killed
  killReason: text('kill_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Cycle-level aggregate metrics.
export const creativeCycleMetrics = pgTable('creative_cycle_metrics', {
  cycleId: text('cycle_id').primaryKey(),
  briefsTotal: integer('briefs_total').notNull(),
  briefsResolved: integer('briefs_resolved').notNull(),
  winners: integer('winners').notNull(),
  average: integer('average').notNull(),
  killed: integer('killed').notNull(),
  avgWinnerCpa: numeric('avg_winner_cpa'),
  score: numeric('score'),
  totalSpend: numeric('total_spend'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Agent run observability (what the agent read, produced, gated on).
export const creativePipelineRuns = pgTable('creative_pipeline_runs', {
  runId: text('run_id').primaryKey(),
  cycleId: text('cycle_id').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  agentVersion: text('agent_version'),
  inputsLoaded: jsonb('inputs_loaded'),
  briefsGenerated: integer('briefs_generated'),
  gateResults: jsonb('gate_results'),
  metrics: jsonb('metrics'),
  status: text('status').notNull(),                 // success|failed|aborted
});
```

Make sure the imports at the top include `text, jsonb, integer, numeric, timestamp, pgTable` — append any missing ones to the existing import statement.

- [ ] **Step 3: Generate migration**

```bash
npx drizzle-kit generate
```

Expected: a new `drizzle/000X_*.sql` file generated with CREATE TABLE statements for the three tables.

- [ ] **Step 4: Inspect migration file**

Open the generated file. Verify it creates `creative_briefs`, `creative_cycle_metrics`, `creative_pipeline_runs` with the expected columns.

- [ ] **Step 5: Push schema to Neon**

```bash
set -a && source .env.local && set +a && npx drizzle-kit push
```

Expected: "Changes applied" with 3 tables created.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "schema: add creative pipeline tables (briefs, cycle metrics, runs)"
```

### Task 9: Create types module

**Files:**
- Create: `~/workspace/sle/products/marketing-director-dashboard/src/lib/workflows/creative-pipeline/types.ts`

- [ ] **Step 1: Write types.ts**

```ts
// Shared types for the creative pipeline workflow.

export type BriefStatus = 'proposed' | 'pushed' | 'live' | 'resolved' | 'killed';
export type BriefAngle = 'price' | 'convenience' | 'social-proof' | 'vs-driving';
export type BriefFunnelStage = 'prospecting' | 'retargeting' | 'awareness';
export type BriefDecision = 'winner' | 'average' | 'killed';

export type LayoutArchetype =
  | 'post-it'
  | 'screenshot-dm'
  | 'quote-card'
  | 'receipt-tally'
  | 'handwritten-note'
  | 'ticket'
  | 'text-message'
  | 'before-after-split'
  | 'advertorial'
  | 'us-vs-them'
  | 'meme'
  | 'real-world-sign'
  | 'other';

export type CreativeCta = 'BOOK_TRAVEL' | 'SHOP_NOW' | 'LEARN_MORE';

export interface ParsedBrief {
  briefId: string;
  cycleId: string;
  conceptName: string;
  conceptType: string;
  angle: BriefAngle;
  funnelStage: BriefFunnelStage;
  matrixCell: string;
  layoutArchetype: LayoutArchetype;
  visualDirection: string;
  primaryText: string;
  headline: string;
  description: string | null;
  cta: CreativeCta;
  linkUrl: string;
  hypothesis: string | null;
}

export interface GateResult {
  name: string;
  passed: boolean;
  failures: string[]; // brief_ids that failed this gate with reasons
  details?: Record<string, unknown>;
}

export interface GateReport {
  brandVoice: GateResult;
  duplicate: GateResult;
  matrixDiversity: GateResult;
  sniffTest?: GateResult; // optional until Phase 6
}

export interface InputsLoaded {
  programMd: { path: string; bytes: number } | null;
  creativeResearchMd: { path: string; bytes: number } | null;
  swipeFileMd: { path: string; bytes: number; entries: number } | null;
  experimentLog: { path: string; totalEntries: number; resolvedEntries: number } | null;
  brandVoice: { path: string; bytes: number } | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/workflows/creative-pipeline/types.ts
git commit -m "types: creative pipeline shared types"
```

### Task 10: Swap the placeholder workflow in workflows.ts

**Files:**
- Modify: `~/workspace/sle/products/marketing-director-dashboard/src/lib/workflows.ts`

- [ ] **Step 1: Update the workflow entry**

Find the entry:

```ts
{
  slug: "creative-content-planning",
  title: "Creative/Content Planning",
  description: "Monthly content brainstorm: ...",
  ...
}
```

Replace with:

```ts
{
  slug: "creative-pipeline",
  title: "Creative Pipeline",
  description:
    "Autoresearch loop for Meta static ads. Agent generates 12 concept briefs per cycle from accumulated outcomes + industry priors. Review and push to Meta from here.",
  icon: "palette",
  status: "active",
  cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 1 } },
  dataSources: ["meta_ads"],
  steps: [
    {
      id: "inputs",
      label: "Inputs",
      description: "What the agent read this cycle",
      type: "view",
    },
    {
      id: "briefs",
      label: "Briefs",
      description: "12 generated concept briefs",
      type: "view",
    },
    {
      id: "push",
      label: "Ship to Meta",
      description: "Push approved briefs to Meta Ads Manager",
      type: "action",
    },
    {
      id: "monitor",
      label: "Monitor",
      description: "Outcomes and metric trend",
      type: "view",
    },
  ],
},
```

Note: if the current `WorkflowStepDef` type doesn't have `type: 'view' | 'action'`, add those to the type definition in `src/lib/workflows/types.ts` before this change.

- [ ] **Step 2: Run typecheck**

```bash
npm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: no new TypeScript errors. If the WorkflowStepDef type needs expansion, do it now.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workflows.ts src/lib/workflows/types.ts
git commit -m "workflows: swap creative-content-planning for creative-pipeline"
```

**End of Phase 2 verification:** Run `npm run dev`, visit `/workflows`. The "Creative Pipeline" workflow appears with status=active. The detail page is 404 or shows a shell (we build it in Phase 3).

---

## Phase 3 — Viewer: import briefs + render cards + deterministic gates

Goal: Brady imports `briefs/2026-05.md` and sees 12 brief cards with gate status and the matrix panel. No Meta push yet.

### Task 11: Write parse-briefs.ts (markdown → ParsedBrief[])

**Files:**
- Create: `~/workspace/sle/products/marketing-director-dashboard/src/lib/workflows/creative-pipeline/parse-briefs.ts`
- Create: `~/workspace/sle/products/marketing-director-dashboard/src/lib/workflows/creative-pipeline/parse-briefs.test.ts`

- [ ] **Step 1: Write failing test**

Fixture content for test:

```ts
// parse-briefs.test.ts
import { describe, it, expect } from 'vitest';
import { parseBriefs } from './parse-briefs';

const FIXTURE = `
# Cycle 2026-05

## 2026-05-c01 — BOI→SLC Sunday Return Savings

- concept_type: new
- angle: price
- funnel_stage: retargeting
- matrix_cell: price×retargeting
- layout_archetype: receipt-tally
- visual_direction: A hand-drawn receipt showing gas + parking = $140. Below, a bus ticket line item = $35. Slight rotation, paper texture background.
- primary_text: Sunday Boise → SLC. $35 bus. $140 gas+parking. Your pick. ⭐️⭐️⭐️⭐️⭐️ "Saved my Sunday" — Jessie L.
- headline: Sunday Return $35
- description: Comfortable seats, free WiFi, no parking drama.
- cta: BOOK_TRAVEL
- link_url: https://saltlakeexpress.com/routes/boise-slc
- hypothesis: Iterating on seed-0042 (price-anchor winner at $7.80 CPA) into a new matrix cell that wasn't covered last cycle.

## 2026-05-c02 — BYU Dorm Post-It

- concept_type: new
- angle: social-proof
- funnel_stage: prospecting
- matrix_cell: social-proof×prospecting
- layout_archetype: post-it
- visual_direction: A yellow post-it note on a corkboard, handwritten. Text reads "bus to slc $35, no parking fee!!" with an arrow.
- primary_text: Text from a BYU dorm bulletin board.
- headline: Text From the Dorm
- cta: LEARN_MORE
- link_url: https://saltlakeexpress.com
- hypothesis: Matrix cell social-proof×prospecting has never been tested. Post-it archetype has strong industry priors (+26% ROAS in H&B case).
`;

describe('parseBriefs', () => {
  it('parses 2 briefs from fixture', () => {
    const briefs = parseBriefs(FIXTURE, '2026-05');
    expect(briefs).toHaveLength(2);
  });

  it('extracts brief_id from header', () => {
    const briefs = parseBriefs(FIXTURE, '2026-05');
    expect(briefs[0].briefId).toBe('2026-05-c01');
    expect(briefs[0].conceptName).toBe('BOI→SLC Sunday Return Savings');
  });

  it('extracts all fields', () => {
    const briefs = parseBriefs(FIXTURE, '2026-05');
    const b = briefs[0];
    expect(b.angle).toBe('price');
    expect(b.funnelStage).toBe('retargeting');
    expect(b.layoutArchetype).toBe('receipt-tally');
    expect(b.headline).toBe('Sunday Return $35');
    expect(b.cta).toBe('BOOK_TRAVEL');
    expect(b.linkUrl).toBe('https://saltlakeexpress.com/routes/boise-slc');
  });

  it('throws if brief_id format is invalid', () => {
    const bad = `## bad-id — no dash suffix`;
    expect(() => parseBriefs(bad, '2026-05')).toThrow();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
npx vitest run src/lib/workflows/creative-pipeline/parse-briefs.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write parse-briefs.ts**

```ts
import type {
  ParsedBrief,
  BriefAngle,
  BriefFunnelStage,
  LayoutArchetype,
  CreativeCta,
} from './types';

const BRIEF_ID_RE = /^##\s+(\d{4}-\d{2}-c\d{2})\s+—\s+(.+?)$/;
const FIELD_RE = /^-\s+([a-z_]+):\s*(.+)$/;

const ANGLES: BriefAngle[] = ['price', 'convenience', 'social-proof', 'vs-driving'];
const STAGES: BriefFunnelStage[] = ['prospecting', 'retargeting', 'awareness'];
const ARCHETYPES: LayoutArchetype[] = [
  'post-it',
  'screenshot-dm',
  'quote-card',
  'receipt-tally',
  'handwritten-note',
  'ticket',
  'text-message',
  'before-after-split',
  'advertorial',
  'us-vs-them',
  'meme',
  'real-world-sign',
  'other',
];
const CTAS: CreativeCta[] = ['BOOK_TRAVEL', 'SHOP_NOW', 'LEARN_MORE'];

export function parseBriefs(markdown: string, cycleId: string): ParsedBrief[] {
  const lines = markdown.split('\n');
  const briefs: ParsedBrief[] = [];
  let current: Partial<ParsedBrief> | null = null;

  for (const line of lines) {
    const headerMatch = line.match(BRIEF_ID_RE);
    if (headerMatch) {
      if (current) briefs.push(finalizeBrief(current, cycleId));
      current = {
        briefId: headerMatch[1],
        cycleId,
        conceptName: headerMatch[2].trim(),
      };
      continue;
    }
    if (!current) continue;
    const fieldMatch = line.match(FIELD_RE);
    if (!fieldMatch) continue;
    const [, key, raw] = fieldMatch;
    const value = raw.trim();
    switch (key) {
      case 'concept_type':
        current.conceptType = value;
        break;
      case 'angle':
        if (!ANGLES.includes(value as BriefAngle)) {
          throw new Error(`Invalid angle "${value}" in ${current.briefId}`);
        }
        current.angle = value as BriefAngle;
        break;
      case 'funnel_stage':
        if (!STAGES.includes(value as BriefFunnelStage)) {
          throw new Error(`Invalid funnel_stage "${value}" in ${current.briefId}`);
        }
        current.funnelStage = value as BriefFunnelStage;
        break;
      case 'matrix_cell':
        current.matrixCell = value;
        break;
      case 'layout_archetype':
        if (!ARCHETYPES.includes(value as LayoutArchetype)) {
          throw new Error(`Invalid layout_archetype "${value}" in ${current.briefId}`);
        }
        current.layoutArchetype = value as LayoutArchetype;
        break;
      case 'visual_direction':
        current.visualDirection = value;
        break;
      case 'primary_text':
        current.primaryText = value;
        break;
      case 'headline':
        current.headline = value;
        break;
      case 'description':
        current.description = value;
        break;
      case 'cta':
        if (!CTAS.includes(value as CreativeCta)) {
          throw new Error(`Invalid cta "${value}" in ${current.briefId}`);
        }
        current.cta = value as CreativeCta;
        break;
      case 'link_url':
        current.linkUrl = value;
        break;
      case 'hypothesis':
        current.hypothesis = value;
        break;
    }
  }
  if (current) briefs.push(finalizeBrief(current, cycleId));
  return briefs;
}

function finalizeBrief(partial: Partial<ParsedBrief>, cycleId: string): ParsedBrief {
  const required = [
    'briefId',
    'conceptName',
    'angle',
    'funnelStage',
    'matrixCell',
    'layoutArchetype',
    'visualDirection',
    'primaryText',
    'headline',
    'cta',
    'linkUrl',
  ] as const;
  for (const k of required) {
    if (!partial[k]) {
      throw new Error(`Brief ${partial.briefId} missing required field ${k}`);
    }
  }
  if (!partial.briefId?.match(/^\d{4}-\d{2}-c\d{2}$/)) {
    throw new Error(`Invalid brief_id format: ${partial.briefId}`);
  }
  return {
    cycleId,
    description: null,
    hypothesis: null,
    conceptType: 'new',
    ...partial,
  } as ParsedBrief;
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npx vitest run src/lib/workflows/creative-pipeline/parse-briefs.test.ts
```

Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflows/creative-pipeline/parse-briefs.ts src/lib/workflows/creative-pipeline/parse-briefs.test.ts
git commit -m "feat: parse-briefs markdown → ParsedBrief[] with validation"
```

### Task 12: Brand-voice gate

**Files:**
- Create: `src/lib/workflows/creative-pipeline/gates/brand-voice.ts`
- Create: `src/lib/workflows/creative-pipeline/gates/brand-voice.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { runBrandVoiceGate } from './brand-voice';

describe('runBrandVoiceGate', () => {
  it('passes clean briefs', () => {
    const briefs = [
      {
        briefId: '2026-05-c01',
        primaryText: '$35 Boise → SLC Sunday. No gas, no parking.',
        headline: 'Sunday Return $35',
      },
    ] as any;
    const banned = ['discover', 'experience', 'journey'];
    const result = runBrandVoiceGate(briefs, banned);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails briefs containing banned words', () => {
    const briefs = [
      {
        briefId: '2026-05-c01',
        primaryText: 'Discover the joy of bus travel.',
        headline: 'Experience Comfort',
      },
      {
        briefId: '2026-05-c02',
        primaryText: 'Clean copy',
        headline: 'Clean headline',
      },
    ] as any;
    const banned = ['discover', 'experience'];
    const result = runBrandVoiceGate(briefs, banned);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('2026-05-c01');
  });

  it('is case-insensitive', () => {
    const briefs = [
      { briefId: '2026-05-c01', primaryText: 'DISCOVER this!', headline: 'x' },
    ] as any;
    const result = runBrandVoiceGate(briefs, ['discover']);
    expect(result.passed).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Write brand-voice.ts**

```ts
import type { ParsedBrief, GateResult } from '../types';

export function runBrandVoiceGate(
  briefs: ParsedBrief[],
  bannedWords: string[]
): GateResult {
  const failures: string[] = [];
  const lowerBanned = bannedWords.map(w => w.toLowerCase());

  for (const brief of briefs) {
    const haystack = `${brief.primaryText} ${brief.headline} ${brief.description ?? ''}`.toLowerCase();
    const hits = lowerBanned.filter(w => haystack.includes(w));
    if (hits.length > 0) {
      failures.push(`${brief.briefId}: contains banned words [${hits.join(', ')}]`);
    }
  }
  return { name: 'brand-voice', passed: failures.length === 0, failures };
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflows/creative-pipeline/gates/brand-voice.ts src/lib/workflows/creative-pipeline/gates/brand-voice.test.ts
git commit -m "feat: brand-voice gate"
```

### Task 13: Duplicate-cross-cycle gate

**Files:**
- Create: `src/lib/workflows/creative-pipeline/gates/duplicate.ts`
- Create: `src/lib/workflows/creative-pipeline/gates/duplicate.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { runDuplicateGate } from './duplicate';

describe('runDuplicateGate', () => {
  it('passes when no prior concept matches', () => {
    const current = [
      { briefId: '2026-05-c01', conceptName: 'New concept A' },
    ] as any;
    const priorNames = ['Old different concept'];
    const result = runDuplicateGate(current, priorNames);
    expect(result.passed).toBe(true);
  });

  it('fails on exact name match', () => {
    const current = [
      { briefId: '2026-05-c01', conceptName: 'BOI→SLC Sunday Savings' },
    ] as any;
    const priorNames = ['BOI→SLC Sunday Savings'];
    const result = runDuplicateGate(current, priorNames);
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('2026-05-c01');
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    const current = [
      { briefId: '2026-05-c01', conceptName: '  boi→slc sunday savings ' },
    ] as any;
    const priorNames = ['BOI→SLC Sunday Savings'];
    const result = runDuplicateGate(current, priorNames);
    expect(result.passed).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Write duplicate.ts**

```ts
import type { ParsedBrief, GateResult } from '../types';

export function runDuplicateGate(
  current: ParsedBrief[],
  priorConceptNames: string[]
): GateResult {
  const normalize = (s: string) => s.trim().toLowerCase();
  const priorSet = new Set(priorConceptNames.map(normalize));
  const failures: string[] = [];
  for (const brief of current) {
    if (priorSet.has(normalize(brief.conceptName))) {
      failures.push(`${brief.briefId}: concept name matches a prior cycle`);
    }
  }
  return { name: 'duplicate', passed: failures.length === 0, failures };
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflows/creative-pipeline/gates/duplicate.ts src/lib/workflows/creative-pipeline/gates/duplicate.test.ts
git commit -m "feat: duplicate-cross-cycle gate"
```

### Task 14: Matrix-diversity gate

**Files:**
- Create: `src/lib/workflows/creative-pipeline/gates/matrix-diversity.ts`
- Create: `src/lib/workflows/creative-pipeline/gates/matrix-diversity.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { runMatrixDiversityGate } from './matrix-diversity';

describe('runMatrixDiversityGate', () => {
  it('passes with 12 unique matrix cells', () => {
    const briefs = Array.from({ length: 12 }, (_, i) => ({
      briefId: `2026-05-c${String(i + 1).padStart(2, '0')}`,
      matrixCell: `cell-${i}`, // 12 unique
    })) as any;
    const result = runMatrixDiversityGate(briefs);
    expect(result.passed).toBe(true);
  });

  it('passes at 10 distinct cells (threshold)', () => {
    const briefs = [
      ...Array.from({ length: 10 }, (_, i) => ({
        briefId: `2026-05-c${String(i + 1).padStart(2, '0')}`,
        matrixCell: `cell-${i}`,
      })),
      { briefId: '2026-05-c11', matrixCell: 'cell-0' }, // dup
      { briefId: '2026-05-c12', matrixCell: 'cell-1' }, // dup
    ] as any;
    const result = runMatrixDiversityGate(briefs);
    expect(result.passed).toBe(true);
  });

  it('fails below 10 distinct cells', () => {
    const briefs = [
      ...Array.from({ length: 9 }, (_, i) => ({
        briefId: `2026-05-c${String(i + 1).padStart(2, '0')}`,
        matrixCell: `cell-${i}`,
      })),
      { briefId: '2026-05-c10', matrixCell: 'cell-0' },
      { briefId: '2026-05-c11', matrixCell: 'cell-0' },
      { briefId: '2026-05-c12', matrixCell: 'cell-0' },
    ] as any;
    const result = runMatrixDiversityGate(briefs);
    expect(result.passed).toBe(false);
    expect(result.details?.uniqueCells).toBe(9);
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Write matrix-diversity.ts**

```ts
import type { ParsedBrief, GateResult } from '../types';

const MINIMUM_DISTINCT_CELLS = 10;

export function runMatrixDiversityGate(briefs: ParsedBrief[]): GateResult {
  const cells = new Set(briefs.map(b => b.matrixCell));
  const passed = cells.size >= MINIMUM_DISTINCT_CELLS;
  const failures: string[] = passed
    ? []
    : [`only ${cells.size} distinct matrix cells (need ${MINIMUM_DISTINCT_CELLS}+)`];
  return {
    name: 'matrix-diversity',
    passed,
    failures,
    details: { uniqueCells: cells.size, totalBriefs: briefs.length },
  };
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflows/creative-pipeline/gates/matrix-diversity.ts src/lib/workflows/creative-pipeline/gates/matrix-diversity.test.ts
git commit -m "feat: matrix-diversity gate (10+ cells required)"
```

### Task 15: Import-briefs API route

**Files:**
- Create: `src/app/api/creative-pipeline/import-briefs/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/creative-pipeline/import-briefs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { parseBriefs } from '@/lib/workflows/creative-pipeline/parse-briefs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/creative-pipeline/import-briefs
 * Body: { cycleId: "2026-05", path?: "absolute/override/path.md" }
 *
 * Reads briefs/YYYY-MM.md from the creative-pipeline repo (default path:
 * ~/workspace/sle/products/creative-pipeline/briefs/${cycleId}.md), parses,
 * upserts rows in creative_briefs.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { cycleId: string; path?: string };
    const cycleId = body.cycleId;
    if (!cycleId?.match(/^\d{4}-\d{2}$/)) {
      return NextResponse.json({ error: 'invalid cycleId' }, { status: 400 });
    }
    const defaultPath = join(
      process.env.HOME || '/Users/brady',
      'workspace/sle/products/creative-pipeline/briefs',
      `${cycleId}.md`
    );
    const filePath = body.path || defaultPath;
    const markdown = readFileSync(filePath, 'utf-8');
    const briefs = parseBriefs(markdown, cycleId);

    const rows = briefs.map(b => ({
      briefId: b.briefId,
      cycleId: b.cycleId,
      conceptName: b.conceptName,
      angle: b.angle,
      funnelStage: b.funnelStage,
      matrixCell: b.matrixCell,
      layoutArchetype: b.layoutArchetype,
      visualDirection: b.visualDirection,
      primaryText: b.primaryText,
      headline: b.headline,
      description: b.description,
      cta: b.cta,
      linkUrl: b.linkUrl,
      hypothesis: b.hypothesis,
      status: 'proposed' as const,
    }));

    await db
      .insert(creativeBriefs)
      .values(rows)
      .onConflictDoUpdate({
        target: creativeBriefs.briefId,
        set: {
          conceptName: creativeBriefs.conceptName,
          angle: creativeBriefs.angle,
          funnelStage: creativeBriefs.funnelStage,
          matrixCell: creativeBriefs.matrixCell,
          layoutArchetype: creativeBriefs.layoutArchetype,
          visualDirection: creativeBriefs.visualDirection,
          primaryText: creativeBriefs.primaryText,
          headline: creativeBriefs.headline,
          description: creativeBriefs.description,
          cta: creativeBriefs.cta,
          linkUrl: creativeBriefs.linkUrl,
          hypothesis: creativeBriefs.hypothesis,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ inserted: rows.length, cycleId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual test via curl**

Start dev server, then:

```bash
npm run dev &
sleep 3
curl -X POST http://localhost:3000/api/creative-pipeline/import-briefs \
  -H 'content-type: application/json' \
  -d '{"cycleId":"2026-05"}'
```

Expected: `{ "inserted": 12, "cycleId": "2026-05" }` (assumes Task 1-7 produced a briefs file).

Or use a fixture briefs file:

```bash
curl -X POST http://localhost:3000/api/creative-pipeline/import-briefs \
  -H 'content-type: application/json' \
  -d '{"cycleId":"2026-05","path":"/absolute/path/to/test-fixture.md"}'
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/creative-pipeline/import-briefs
git commit -m "feat: POST /api/creative-pipeline/import-briefs"
```

### Task 16: Build the workflow index page

**Files:**
- Create: `src/app/workflows/creative-pipeline/page.tsx`

- [ ] **Step 1: Write page.tsx**

```tsx
// src/app/workflows/creative-pipeline/page.tsx
import { db } from '@/db';
import { creativeBriefs, creativeCycleMetrics } from '@/db/schema';
import { sql, desc } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CreativePipelineIndex() {
  const cycles = await db
    .select({
      cycleId: creativeBriefs.cycleId,
      briefsTotal: sql<number>`count(*)::int`,
      proposed: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'proposed')::int`,
      pushed: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'pushed')::int`,
      live: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'live')::int`,
      resolved: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'resolved')::int`,
      killed: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'killed')::int`,
    })
    .from(creativeBriefs)
    .groupBy(creativeBriefs.cycleId)
    .orderBy(desc(creativeBriefs.cycleId));

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Creative Pipeline</h1>
        <p className="text-sm text-slate-400 mt-1">
          Autoresearch loop. Agent-generated briefs, manual ship to Meta, automated outcome tracking.
        </p>
      </div>

      <div className="space-y-3">
        {cycles.length === 0 ? (
          <div className="border border-slate-800 rounded-lg p-6 text-center text-slate-500">
            No cycles yet. Run <code className="bg-slate-900 px-2 py-0.5 rounded">./run-cycle.sh</code> in the creative-pipeline repo, then import.
          </div>
        ) : (
          cycles.map(c => (
            <Link
              key={c.cycleId}
              href={`/workflows/creative-pipeline/${c.cycleId}`}
              className="block border border-slate-800 rounded-lg p-4 hover:border-slate-600 transition"
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold">{c.cycleId}</div>
                <div className="text-xs text-slate-500">{c.briefsTotal} briefs</div>
              </div>
              <div className="mt-2 flex gap-3 text-xs text-slate-400">
                <span>proposed: {c.proposed}</span>
                <span>pushed: {c.pushed}</span>
                <span>live: {c.live}</span>
                <span>resolved: {c.resolved}</span>
                <span>killed: {c.killed}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verify**

```bash
npm run dev
```

Visit `http://localhost:3000/workflows/creative-pipeline`. Expected: empty state if no cycles imported; otherwise a list of cycle cards.

- [ ] **Step 3: Commit**

```bash
git add src/app/workflows/creative-pipeline/page.tsx
git commit -m "ui: workflow index page for creative pipeline"
```

### Task 17: Build the cycle detail page + cycle API

**Files:**
- Create: `src/app/api/creative-pipeline/cycle/[cycleId]/route.ts`
- Create: `src/app/workflows/creative-pipeline/[cycleId]/page.tsx`
- Create: `src/components/workflows/creative-pipeline/brief-card.tsx`
- Create: `src/components/workflows/creative-pipeline/matrix-coverage.tsx`
- Create: `src/components/workflows/creative-pipeline/gate-status.tsx`
- Create: `src/components/workflows/creative-pipeline/hypothesis-trail.tsx`

- [ ] **Step 1: Write the cycle API route**

```ts
// src/app/api/creative-pipeline/cycle/[cycleId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { runBrandVoiceGate } from '@/lib/workflows/creative-pipeline/gates/brand-voice';
import { runDuplicateGate } from '@/lib/workflows/creative-pipeline/gates/duplicate';
import { runMatrixDiversityGate } from '@/lib/workflows/creative-pipeline/gates/matrix-diversity';

export const dynamic = 'force-dynamic';

// Static banned word list (real list comes from brandscript.md — Phase 3 uses stub; Phase 6 wires dynamic load)
const BANNED_WORDS = ['discover', 'experience', 'journey', 'elevate', 'unlock', 'unleash'];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  try {
    const { cycleId } = await params;
    const briefs = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.cycleId, cycleId))
      .orderBy(creativeBriefs.briefId);

    if (briefs.length === 0) {
      return NextResponse.json({ error: 'no briefs for cycle' }, { status: 404 });
    }

    // Pull prior 3 cycles' concept names for duplicate gate
    const priorRows = await db
      .select({ conceptName: creativeBriefs.conceptName })
      .from(creativeBriefs)
      .where(sql`${creativeBriefs.cycleId} < ${cycleId}`);
    const priorNames = priorRows.map(r => r.conceptName);

    const gates = {
      brandVoice: runBrandVoiceGate(briefs as any, BANNED_WORDS),
      duplicate: runDuplicateGate(briefs as any, priorNames),
      matrixDiversity: runMatrixDiversityGate(briefs as any),
    };

    return NextResponse.json({ cycleId, briefs, gates });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write brief-card.tsx**

```tsx
// src/components/workflows/creative-pipeline/brief-card.tsx
'use client';
import { useState } from 'react';

export interface Brief {
  briefId: string;
  conceptName: string;
  angle: string;
  funnelStage: string;
  matrixCell: string;
  layoutArchetype: string;
  visualDirection: string;
  primaryText: string;
  headline: string;
  cta: string;
  hypothesis: string | null;
  status: string;
}

export function BriefCard({ brief }: { brief: Brief }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-900/50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-500">{brief.briefId}</span>
          <span className="text-white font-semibold text-sm">{brief.conceptName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {brief.angle}×{brief.funnelStage}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {brief.layoutArchetype}
          </span>
          <span className={`px-2 py-0.5 rounded ${statusColor(brief.status)}`}>
            {brief.status}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-800 px-4 py-4 text-sm text-slate-300 space-y-3">
          <section>
            <div className="text-xs text-slate-500 uppercase mb-1">Visual direction</div>
            <p>{brief.visualDirection}</p>
          </section>
          <section>
            <div className="text-xs text-slate-500 uppercase mb-1">Primary text</div>
            <p className="italic">{brief.primaryText}</p>
          </section>
          <section>
            <div className="text-xs text-slate-500 uppercase mb-1">Headline</div>
            <p>{brief.headline}</p>
          </section>
          {brief.hypothesis && (
            <section>
              <div className="text-xs text-slate-500 uppercase mb-1">Hypothesis</div>
              <p className="text-slate-400">{brief.hypothesis}</p>
            </section>
          )}
          {brief.status === 'proposed' && (
            <button
              onClick={() => pushToMeta(brief.briefId)}
              className="mt-2 px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 rounded text-slate-950 font-medium transition"
            >
              Push to Meta →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

async function pushToMeta(briefId: string) {
  const res = await fetch(`/api/creative-pipeline/push-brief/${briefId}`, {
    method: 'POST',
  });
  if (res.ok) {
    window.location.reload();
  } else {
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    alert(`Push failed: ${err.error}`);
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'proposed': return 'bg-slate-800 text-slate-400';
    case 'pushed': return 'bg-blue-900/50 text-blue-300';
    case 'live': return 'bg-emerald-900/50 text-emerald-300';
    case 'resolved': return 'bg-violet-900/50 text-violet-300';
    case 'killed': return 'bg-red-900/50 text-red-300';
    default: return 'bg-slate-800 text-slate-400';
  }
}
```

- [ ] **Step 3: Write matrix-coverage.tsx**

```tsx
// src/components/workflows/creative-pipeline/matrix-coverage.tsx
const ANGLES = ['price', 'convenience', 'social-proof', 'vs-driving'];
const STAGES = ['prospecting', 'retargeting', 'awareness'];

export function MatrixCoverage({ briefs }: { briefs: { matrixCell: string }[] }) {
  const counts = new Map<string, number>();
  for (const b of briefs) {
    counts.set(b.matrixCell, (counts.get(b.matrixCell) || 0) + 1);
  }

  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Matrix coverage</div>
      <div className="grid grid-cols-5 gap-2 text-xs">
        <div />
        {ANGLES.map(a => (
          <div key={a} className="text-slate-500 text-center pb-1 font-semibold">
            {a}
          </div>
        ))}
        {STAGES.map(s => (
          <div key={s} className="contents">
            <div className="text-slate-500 font-semibold py-2">{s}</div>
            {ANGLES.map(a => {
              const cell = `${a}×${s}`;
              const count = counts.get(cell) || 0;
              return (
                <div
                  key={cell}
                  className={`p-2 rounded border text-center ${
                    count === 0
                      ? 'border-slate-800 text-slate-700'
                      : count === 1
                      ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300'
                      : 'border-amber-900/40 bg-amber-950/20 text-amber-300'
                  }`}
                  title={count > 1 ? 'Duplicate cell' : ''}
                >
                  {count > 0 ? count : '—'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500 mt-3">
        Unique cells: {counts.size}/12 (≥10 required)
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write gate-status.tsx**

```tsx
// src/components/workflows/creative-pipeline/gate-status.tsx
import type { GateReport } from '@/lib/workflows/creative-pipeline/types';

export function GateStatus({ gates }: { gates: GateReport }) {
  const entries = [
    { key: 'brand-voice', result: gates.brandVoice },
    { key: 'duplicate', result: gates.duplicate },
    { key: 'matrix-diversity', result: gates.matrixDiversity },
    ...(gates.sniffTest ? [{ key: 'sniff-test', result: gates.sniffTest }] : []),
  ];
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Gate status</div>
      <div className="space-y-2">
        {entries.map(({ key, result }) => (
          <div key={key} className="flex items-start gap-3">
            <span className={`text-lg ${result.passed ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.passed ? '✓' : '✗'}
            </span>
            <div className="flex-1">
              <div className="text-sm text-slate-200 font-medium">{result.name}</div>
              {result.failures.length > 0 && (
                <ul className="mt-1 text-xs text-red-300 list-disc pl-4">
                  {result.failures.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write hypothesis-trail.tsx**

```tsx
// src/components/workflows/creative-pipeline/hypothesis-trail.tsx
import type { Brief } from './brief-card';

export function HypothesisTrail({ briefs }: { briefs: Brief[] }) {
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Hypothesis trail</div>
      <ul className="space-y-2 text-sm">
        {briefs.map(b => (
          <li key={b.briefId} className="flex gap-3 items-start">
            <span className="font-mono text-xs text-slate-500 pt-0.5">{b.briefId}</span>
            <span className="text-slate-300 flex-1">
              {b.hypothesis || <span className="italic text-slate-600">no hypothesis recorded</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Write the cycle detail page**

```tsx
// src/app/workflows/creative-pipeline/[cycleId]/page.tsx
import { headers } from 'next/headers';
import { BriefCard, type Brief } from '@/components/workflows/creative-pipeline/brief-card';
import { MatrixCoverage } from '@/components/workflows/creative-pipeline/matrix-coverage';
import { GateStatus } from '@/components/workflows/creative-pipeline/gate-status';
import { HypothesisTrail } from '@/components/workflows/creative-pipeline/hypothesis-trail';
import type { GateReport } from '@/lib/workflows/creative-pipeline/types';

export const dynamic = 'force-dynamic';

async function loadCycle(cycleId: string): Promise<{
  briefs: Brief[];
  gates: GateReport;
} | null> {
  const h = await headers();
  const host = h.get('host');
  const proto = host?.startsWith('localhost') ? 'http' : 'https';
  const res = await fetch(`${proto}://${host}/api/creative-pipeline/cycle/${cycleId}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function CyclePage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const data = await loadCycle(cycleId);
  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 text-slate-400">
        Cycle {cycleId} not found.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Cycle {cycleId}</h1>
        <p className="text-sm text-slate-400 mt-1">{data.briefs.length} briefs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <MatrixCoverage briefs={data.briefs} />
        <GateStatus gates={data.gates} />
      </div>

      <HypothesisTrail briefs={data.briefs} />

      <div className="mt-8 space-y-2">
        {data.briefs.map(b => (
          <BriefCard key={b.briefId} brief={b} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Manual verify in browser**

```bash
npm run dev
```

Import a test cycle (Task 15 method), then visit `/workflows/creative-pipeline/2026-05`. Verify:
- Matrix panel shows coverage grid
- Gate status shows 3 gates (all green or with specific failures)
- Hypothesis trail lists all 12
- Brief cards expand on click, showing visual direction + primary text + headline + hypothesis

Check console for any runtime errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/creative-pipeline/cycle src/app/workflows/creative-pipeline/[cycleId] src/components/workflows/creative-pipeline
git commit -m "ui: cycle detail page with brief cards, matrix, gates, hypothesis trail"
```

### Task 18: Add inputs-loaded panel

The inputs-loaded panel requires the agent to write a `run-metrics.json` that `creative_pipeline_runs` row picks up. Phase 3 implements the panel with a placeholder data source; Phase 6 wires the real agent-written metrics.

**Files:**
- Create: `src/components/workflows/creative-pipeline/inputs-loaded.tsx`
- Modify: `src/app/workflows/creative-pipeline/[cycleId]/page.tsx` (add the panel)

- [ ] **Step 1: Write inputs-loaded.tsx**

```tsx
// src/components/workflows/creative-pipeline/inputs-loaded.tsx
import type { InputsLoaded } from '@/lib/workflows/creative-pipeline/types';

export function InputsLoadedPanel({ inputs }: { inputs: InputsLoaded | null }) {
  if (!inputs) {
    return (
      <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
        <div className="text-xs text-slate-500 uppercase mb-3">Inputs loaded</div>
        <p className="text-sm text-slate-500 italic">
          No agent-run metrics recorded yet for this cycle.
        </p>
      </div>
    );
  }
  const items = [
    { key: 'program.md', data: inputs.programMd },
    { key: 'creative-research.md', data: inputs.creativeResearchMd },
    { key: 'swipe-file.md', data: inputs.swipeFileMd },
    { key: 'experiment-log.md', data: inputs.experimentLog },
    { key: 'brand-voice/sle-brandscript.md', data: inputs.brandVoice },
  ];
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Inputs loaded</div>
      <ul className="space-y-2 text-sm">
        {items.map(({ key, data }) => (
          <li key={key} className="flex items-start gap-3">
            <span className={`text-lg ${data ? 'text-emerald-400' : 'text-slate-600'}`}>
              {data ? '✓' : '○'}
            </span>
            <div className="flex-1">
              <div className="font-mono text-xs text-slate-300">{key}</div>
              {data && 'bytes' in data && (
                <div className="text-xs text-slate-500">
                  {(data.bytes / 1024).toFixed(1)} KB
                  {'entries' in data ? ` · ${data.entries} entries` : ''}
                  {'totalEntries' in data
                    ? ` · ${data.totalEntries} entries (${data.resolvedEntries} resolved)`
                    : ''}
                </div>
              )}
              {!data && <div className="text-xs text-slate-600">not loaded</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Update cycle API to return the inputs**

Modify `src/app/api/creative-pipeline/cycle/[cycleId]/route.ts` to fetch the latest `creativePipelineRuns` row for the cycle and include `inputs_loaded` in the response.

Add to imports:
```ts
import { creativePipelineRuns } from '@/db/schema';
import { desc } from 'drizzle-orm';
```

Inside the GET handler, after loading briefs, add:

```ts
const latestRun = await db
  .select()
  .from(creativePipelineRuns)
  .where(eq(creativePipelineRuns.cycleId, cycleId))
  .orderBy(desc(creativePipelineRuns.startedAt))
  .limit(1);
const inputs = latestRun[0]?.inputsLoaded ?? null;
```

And include in the response:

```ts
return NextResponse.json({ cycleId, briefs, gates, inputs });
```

- [ ] **Step 3: Add the panel to the cycle page**

In `src/app/workflows/creative-pipeline/[cycleId]/page.tsx`, update the grid:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
  <InputsLoadedPanel inputs={data.inputs} />
  <MatrixCoverage briefs={data.briefs} />
  <GateStatus gates={data.gates} />
</div>
```

And import the component at the top.

- [ ] **Step 4: Manual verify**

Reload `/workflows/creative-pipeline/2026-05`. Expected: inputs panel shows (empty with "No agent-run metrics" until Phase 6 wires the agent to write).

- [ ] **Step 5: Commit**

```bash
git add src/components/workflows/creative-pipeline/inputs-loaded.tsx src/app/api/creative-pipeline/cycle src/app/workflows/creative-pipeline
git commit -m "ui: inputs-loaded panel (placeholder until agent writes run-metrics)"
```

**End of Phase 3 verification:** Brady runs `./run-cycle.sh`, then imports via `/api/creative-pipeline/import-briefs`, then opens `/workflows/creative-pipeline/2026-05`. He sees 12 brief cards, matrix coverage, gate statuses, hypothesis trail. No Meta push yet.

---

## Phase 4 — Shipper: Push to Meta

Goal: Click "Push to Meta" on a brief card → Meta ad draft appears in Ads Manager with populated copy/headline/CTA/URL and ad name `briefId · conceptName`.

### Task 19: Write meta-adset-map.ts

**Files:**
- Create: `src/lib/workflows/creative-pipeline/meta-adset-map.ts`

- [ ] **Step 1: Discover current ad set IDs**

Run this against the dashboard's Meta client to find live ad set IDs:

```bash
set -a && source .env.local && set +a && npx tsx scripts/list-meta-adsets.ts
```

Script content:

```ts
// scripts/list-meta-adsets.ts
import 'dotenv/config';
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';

FacebookAdsApi.init(process.env.META_ACCESS_TOKEN!);
const account = new AdAccount(process.env.META_AD_ACCOUNT_ID!);

async function main() {
  const adsets = await account.getAdSets(['id', 'name', 'campaign_id', 'status'], { limit: 200 });
  for (const a of adsets) {
    console.log(`${a.id}\t${a.status}\t${a.name}`);
  }
}

main().catch(console.error);
```

Record the IDs of the ad sets that will receive briefs by funnel stage.

- [ ] **Step 2: Write meta-adset-map.ts**

```ts
// src/lib/workflows/creative-pipeline/meta-adset-map.ts
import type { BriefFunnelStage } from './types';

// Static mapping of funnel stage → Meta ad set ID.
// Populate with real IDs from `scripts/list-meta-adsets.ts` output.

interface StageMapping {
  adSetId: string;
  campaignName: string; // for logging
}

export const FUNNEL_STAGE_MAP: Record<BriefFunnelStage, StageMapping> = {
  prospecting: {
    adSetId: 'REPLACE_WITH_TOF_ADSET_ID',
    campaignName: 'TOF - Salt Lake City',
  },
  retargeting: {
    adSetId: 'REPLACE_WITH_MOF_RETARGETING_ADSET_ID',
    campaignName: 'Middle (A) Retargeting',
  },
  awareness: {
    adSetId: 'REPLACE_WITH_AWARENESS_ADSET_ID',
    campaignName: 'Creative Testing - Incremental',
  },
};

export function getAdSetIdForStage(stage: BriefFunnelStage): string {
  const mapping = FUNNEL_STAGE_MAP[stage];
  if (!mapping) {
    throw new Error(`No ad set mapping for funnel stage: ${stage}`);
  }
  if (mapping.adSetId.startsWith('REPLACE_WITH')) {
    throw new Error(`Ad set ID not configured for ${stage}. See meta-adset-map.ts.`);
  }
  return mapping.adSetId;
}
```

Brady fills in the real IDs.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workflows/creative-pipeline/meta-adset-map.ts
git commit -m "config: meta ad-set mapping by funnel stage"
```

### Task 20: Push-brief API route

**Files:**
- Create: `src/app/api/creative-pipeline/push-brief/[briefId]/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/creative-pipeline/push-brief/[briefId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';
import { getAdSetIdForStage } from '@/lib/workflows/creative-pipeline/meta-adset-map';
import type { BriefFunnelStage } from '@/lib/workflows/creative-pipeline/types';

export const dynamic = 'force-dynamic';

const SLE_PAGE_ID = process.env.META_SLE_PAGE_ID!;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ briefId: string }> }
) {
  try {
    const { briefId } = await params;

    const rows = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.briefId, briefId))
      .limit(1);
    const brief = rows[0];
    if (!brief) {
      return NextResponse.json({ error: 'brief not found' }, { status: 404 });
    }
    if (brief.status !== 'proposed') {
      return NextResponse.json(
        { error: `brief already ${brief.status}` },
        { status: 400 }
      );
    }

    FacebookAdsApi.init(process.env.META_ACCESS_TOKEN!);
    const account = new AdAccount(process.env.META_AD_ACCOUNT_ID!);

    // Create ad creative
    const creativeName = `${brief.briefId} · ${brief.conceptName}`;
    const creative = await account.createAdCreative([], {
      name: creativeName,
      object_story_spec: {
        page_id: SLE_PAGE_ID,
        link_data: {
          message: brief.primaryText,
          link: brief.linkUrl,
          name: brief.headline,
          description: brief.description ?? undefined,
          call_to_action: { type: brief.cta },
        },
      },
    });

    // Create ad (PAUSED — Brady uploads image and launches manually)
    const ad = await account.createAd([], {
      name: creativeName,
      adset_id: getAdSetIdForStage(brief.funnelStage as BriefFunnelStage),
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    });

    await db
      .update(creativeBriefs)
      .set({
        status: 'pushed',
        metaAdId: ad.id,
        pushedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creativeBriefs.briefId, briefId));

    return NextResponse.json({
      briefId,
      metaAdId: ad.id,
      adsManagerUrl: `https://business.facebook.com/adsmanager/manage/ads/edit?ad_id=${ad.id}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add META_SLE_PAGE_ID to env**

Add to `.env.local`:
```
META_SLE_PAGE_ID=<real page id from Meta Business Suite>
```

Brady finds this in Meta Business Suite → Settings → Pages → SLE page ID.

- [ ] **Step 3: Manual smoke test with a single brief**

Start dev server. In the browser: import a fixture cycle with 1 brief, open the cycle page, click "Push to Meta" on the card.

Expected:
- Page reloads
- Brief status flips to `pushed`
- An ad draft appears in Meta Ads Manager (status: Paused), under the correct ad set, with populated copy

If the push fails, check:
- `.env.local` has META_SLE_PAGE_ID set
- Ad set IDs in `meta-adset-map.ts` are real
- Meta token hasn't expired

- [ ] **Step 4: Commit**

```bash
git add src/app/api/creative-pipeline/push-brief
git commit -m "feat: POST /api/creative-pipeline/push-brief/:briefId creates Meta ad draft"
```

**End of Phase 4 verification:** Brady clicks "Push to Meta" on a brief → sees a paused Meta ad appear in Ads Manager with the brief's copy/headline/URL and the name starting with the brief_id. Status in dashboard flips from `proposed` to `pushed`.

---

## Phase 5 — Monitor: cron poll + outcome panel + metric history

Goal: Ads shipped to Meta get their CPA/status automatically reflected in the dashboard. Score per cycle visible over time.

### Task 21: Cron poll route

**Files:**
- Create: `src/app/api/cron/poll-meta-outcomes/route.ts`
- Modify: `vercel.json` (add cron config)

- [ ] **Step 1: Write the cron route**

```ts
// src/app/api/cron/poll-meta-outcomes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';
import { FacebookAdsApi, Ad } from 'facebook-nodejs-business-sdk';

export const dynamic = 'force-dynamic';

// Vercel cron calls this daily at 8am MT (15:00 UTC)
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  FacebookAdsApi.init(process.env.META_ACCESS_TOKEN!);

  const activeBriefs = await db
    .select()
    .from(creativeBriefs)
    .where(inArray(creativeBriefs.status, ['pushed', 'live']));

  const results: Array<{ briefId: string; outcome: string }> = [];

  for (const brief of activeBriefs) {
    if (!brief.metaAdId) continue;
    try {
      const ad = new Ad(brief.metaAdId);
      const [insights, details] = await Promise.all([
        ad.getInsights(
          ['spend', 'actions', 'ctr', 'frequency', 'impressions'],
          { date_preset: 'maximum' }
        ),
        ad.read(['effective_status']),
      ]);

      if (insights.length === 0) {
        results.push({ briefId: brief.briefId, outcome: 'no-insights' });
        continue;
      }
      const r = insights[0];
      const purchases = Number(
        (r.actions || []).find((a: any) => a.action_type === 'purchase')?.value || 0
      );
      const spend = Number(r.spend || 0);
      const cpa = purchases > 0 ? spend / purchases : null;
      const frequency = Number(r.frequency || 0);
      const ctr = Number(r.ctr || 0);
      const impressions = Number(r.impressions || 0);

      // Determine new status
      const effStatus = String(details.effective_status || '').toUpperCase();
      const isLive = effStatus === 'ACTIVE';
      const isKilled = effStatus.includes('PAUSED') || effStatus.includes('DISAPPROVED');
      let newStatus: 'live' | 'resolved' | 'killed' | null = null;
      let decision: 'winner' | 'average' | 'killed' | null = null;
      let killReason: string | null = null;

      // Spend floor: if spend >= 200 AND (killed OR frequency > 4.0)
      if (spend >= 200 && cpa !== null) {
        if (cpa < 9) {
          newStatus = 'resolved';
          decision = 'winner';
        } else if (cpa < 14) {
          newStatus = 'resolved';
          decision = 'average';
        } else {
          newStatus = 'killed';
          decision = 'killed';
          killReason = `cpa=${cpa.toFixed(2)} > 14`;
        }
      } else if (isKilled && brief.status !== 'resolved') {
        newStatus = 'killed';
        decision = 'killed';
        killReason = `effective_status=${effStatus}`;
      } else if (isLive && brief.status === 'pushed') {
        newStatus = 'live';
      }

      const updateData: any = {
        spend: spend.toString(),
        cpa: cpa?.toString() ?? null,
        ctr: ctr.toString(),
        frequency: frequency.toString(),
        impressions,
        purchases,
        updatedAt: new Date(),
      };
      if (newStatus) {
        updateData.status = newStatus;
        if (newStatus === 'live' && !brief.launchedAt) {
          updateData.launchedAt = new Date();
        }
        if (newStatus === 'resolved' || newStatus === 'killed') {
          updateData.resolvedAt = new Date();
          updateData.decision = decision;
          updateData.killReason = killReason;
        }
      }
      await db.update(creativeBriefs).set(updateData).where(eq(creativeBriefs.briefId, brief.briefId));
      results.push({ briefId: brief.briefId, outcome: newStatus || 'updated' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ briefId: brief.briefId, outcome: `error: ${msg}` });
    }
  }

  return NextResponse.json({ count: results.length, results });
}
```

- [ ] **Step 2: Register the cron in vercel.json**

Read existing `vercel.json`. If it exists, add a `crons` array; if not, create it:

```json
{
  "crons": [
    {
      "path": "/api/cron/poll-meta-outcomes",
      "schedule": "0 15 * * *"
    }
  ]
}
```

- [ ] **Step 3: Set CRON_SECRET env var**

Add to `.env.local`:
```
CRON_SECRET=<generate a long random string>
```

Also set in Vercel prod env.

- [ ] **Step 4: Smoke test locally**

```bash
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll-meta-outcomes
```

Expected: `{ count: N, results: [...] }` where N is the number of `pushed`/`live` briefs.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/poll-meta-outcomes vercel.json
git commit -m "feat: daily cron polls Meta for brief outcomes"
```

### Task 22: Compute-score helper

**Files:**
- Create: `src/lib/workflows/creative-pipeline/compute-score.ts`
- Create: `src/lib/workflows/creative-pipeline/compute-score.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// compute-score.test.ts
import { describe, it, expect } from 'vitest';
import { computeCycleScore } from './compute-score';

describe('computeCycleScore (dashboard-side)', () => {
  it('returns 0 winners scenario', () => {
    const briefs = [
      { spend: '500', cpa: '15', status: 'resolved' },
      { spend: '300', cpa: '20', status: 'killed' },
    ] as any;
    const result = computeCycleScore(briefs);
    expect(result.score).toBe(0);
  });

  it('computes winners × (target/avg)', () => {
    const briefs = [
      { spend: '500', cpa: '6', status: 'resolved' },
      { spend: '400', cpa: '8', status: 'resolved' },
      { spend: '500', cpa: '20', status: 'killed' },
    ] as any;
    const result = computeCycleScore(briefs);
    expect(result.winners).toBe(2);
    expect(result.score).toBeCloseTo(2 * (9 / 7));
  });
});
```

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Write compute-score.ts**

```ts
// compute-score.ts — dashboard-side wrapper around the same logic in creative-pipeline/evaluate.ts.
// Kept as a separate file because the dashboard uses Drizzle rows (strings for numeric); the agent-side uses typed numbers.

const TARGET_CPA = 9;
const SPEND_FLOOR = 200;

export interface DbBrief {
  spend: string | null;
  cpa: string | null;
  status: string;
}

export interface CycleScore {
  score: number;
  hit_rate: number;
  avg_winner_cpa: number;
  winners: number;
  total: number;
  killed: number;
  average: number;
}

export function computeCycleScore(briefs: DbBrief[]): CycleScore {
  const resolved = briefs.filter(
    b =>
      (b.status === 'resolved' || b.status === 'killed') &&
      Number(b.spend || 0) >= SPEND_FLOOR
  );
  const winners = resolved.filter(b => {
    const cpa = b.cpa !== null ? Number(b.cpa) : Infinity;
    return cpa < TARGET_CPA;
  });
  const killed = resolved.filter(b => b.status === 'killed').length;
  const average = resolved.length - winners.length - killed;
  const avgWinnerCpa =
    winners.length > 0
      ? winners.reduce((s, b) => s + Number(b.cpa || 0), 0) / winners.length
      : 0;
  const hitRate = resolved.length > 0 ? winners.length / resolved.length : 0;
  const score = winners.length === 0 ? 0 : winners.length * (TARGET_CPA / avgWinnerCpa);

  return {
    score,
    hit_rate: hitRate,
    avg_winner_cpa: avgWinnerCpa,
    winners: winners.length,
    total: resolved.length,
    killed,
    average,
  };
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflows/creative-pipeline/compute-score.ts src/lib/workflows/creative-pipeline/compute-score.test.ts
git commit -m "feat: compute-score helper for dashboard cycle rows"
```

### Task 23: Push-outcome + metric-history panels

**Files:**
- Create: `src/components/workflows/creative-pipeline/push-outcome.tsx`
- Create: `src/components/workflows/creative-pipeline/metric-history.tsx`
- Create: `src/app/api/creative-pipeline/cycles/route.ts`
- Modify: `src/app/workflows/creative-pipeline/[cycleId]/page.tsx`

- [ ] **Step 1: Write push-outcome.tsx**

```tsx
// src/components/workflows/creative-pipeline/push-outcome.tsx
import type { Brief } from './brief-card';

export function PushOutcomePanel({ briefs }: { briefs: Brief[] }) {
  const counts = {
    proposed: briefs.filter(b => b.status === 'proposed').length,
    pushed: briefs.filter(b => b.status === 'pushed').length,
    live: briefs.filter(b => b.status === 'live').length,
    resolved: briefs.filter(b => b.status === 'resolved').length,
    killed: briefs.filter(b => b.status === 'killed').length,
  };
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Push &amp; outcome</div>
      <div className="grid grid-cols-5 gap-2 text-center text-xs">
        <StatusPill label="proposed" count={counts.proposed} color="slate" />
        <StatusPill label="pushed" count={counts.pushed} color="blue" />
        <StatusPill label="live" count={counts.live} color="emerald" />
        <StatusPill label="resolved" count={counts.resolved} color="violet" />
        <StatusPill label="killed" count={counts.killed} color="red" />
      </div>
    </div>
  );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-800 text-slate-400',
    blue: 'bg-blue-900/40 text-blue-300',
    emerald: 'bg-emerald-900/40 text-emerald-300',
    violet: 'bg-violet-900/40 text-violet-300',
    red: 'bg-red-900/40 text-red-300',
  };
  return (
    <div className={`rounded-md p-3 ${colors[color]}`}>
      <div className="text-xl font-bold">{count}</div>
      <div className="text-[10px] uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write cycles index API**

```ts
// src/app/api/creative-pipeline/cycles/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { computeCycleScore } from '@/lib/workflows/creative-pipeline/compute-score';

export const dynamic = 'force-dynamic';

export async function GET() {
  const allBriefs = await db.select().from(creativeBriefs);
  const byCycle = new Map<string, typeof allBriefs>();
  for (const b of allBriefs) {
    if (!byCycle.has(b.cycleId)) byCycle.set(b.cycleId, []);
    byCycle.get(b.cycleId)!.push(b);
  }
  const cycles = Array.from(byCycle.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([cycleId, rows]) => ({
      cycleId,
      briefsTotal: rows.length,
      metrics: computeCycleScore(rows as any),
    }));
  return NextResponse.json({ cycles });
}
```

- [ ] **Step 3: Write metric-history.tsx**

```tsx
// src/components/workflows/creative-pipeline/metric-history.tsx
'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Cycle {
  cycleId: string;
  metrics: { score: number; hit_rate: number; winners: number; total: number };
}

export function MetricHistory() {
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  useEffect(() => {
    fetch('/api/creative-pipeline/cycles')
      .then(r => r.json())
      .then(data => setCycles(data.cycles));
  }, []);
  if (!cycles) {
    return (
      <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30 min-h-[200px]">
        <div className="text-xs text-slate-500 uppercase mb-3">Metric history</div>
        <div className="text-sm text-slate-500 italic">Loading…</div>
      </div>
    );
  }
  const chartData = cycles
    .slice()
    .reverse()
    .map(c => ({ cycle: c.cycleId, score: Number(c.metrics.score.toFixed(2)) }));
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Metric history</div>
      {chartData.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No cycles with outcomes yet.</div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="cycle" stroke="#94a3b8" style={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="score" stroke="#eab308" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add panels to cycle page**

In `src/app/workflows/creative-pipeline/[cycleId]/page.tsx`, update the layout to include push-outcome and metric-history.

Add imports:
```tsx
import { PushOutcomePanel } from '@/components/workflows/creative-pipeline/push-outcome';
import { MetricHistory } from '@/components/workflows/creative-pipeline/metric-history';
```

After the 3-column grid (inputs, matrix, gates) and before the hypothesis trail, add:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
  <PushOutcomePanel briefs={data.briefs} />
  <MetricHistory />
</div>
```

- [ ] **Step 5: Manual verify in browser**

Reload the cycle page. Expected: push/outcome panel shows counts. Metric history panel shows a line chart (or "no outcomes yet" if nothing resolved).

- [ ] **Step 6: Commit**

```bash
git add src/components/workflows/creative-pipeline/push-outcome.tsx src/components/workflows/creative-pipeline/metric-history.tsx src/app/api/creative-pipeline/cycles src/app/workflows/creative-pipeline
git commit -m "ui: push-outcome and metric-history panels"
```

**End of Phase 5 verification:** After a cycle has some resolved briefs (triggered either by real Meta ads or manual DB updates in dev), the cycle page shows all 6 panels, push/outcome counts reflect status distribution, metric-history chart draws.

---

## Phase 6 — Sniff-test LLM gate

Goal: A Haiku-powered rubric evaluates each brief against the 11-point sniff test and fails the gate if 2+ red flags fire.

### Task 24: Sniff-test gate

**Files:**
- Create: `src/lib/workflows/creative-pipeline/gates/sniff-test.ts`
- Modify: `src/app/api/creative-pipeline/cycle/[cycleId]/route.ts`

- [ ] **Step 1: Write the sniff-test module**

```ts
// src/lib/workflows/creative-pipeline/gates/sniff-test.ts
import Anthropic from '@anthropic-ai/sdk';
import type { GateResult } from '../types';

const SNIFF_TEST_PROMPT = `You are evaluating a Meta static ad BRIEF against an 11-point sniff test. The brief describes what the finished ad will look like and say. You return JSON only.

For each brief, check these 11 red flags and count how many fire:

1. Visual aesthetic could run as a magazine ad (too polished / studio-like)
2. Obvious Midjourney / AI-generated perfection
3. Brand logo is the first thing the eye lands on
4. Copy uses banned words (discover, experience, journey, elevate, unlock, unleash)
5. Headline is clever wordplay instead of specific (should be specific)
6. Hook starts with a verb phrase instead of a specific noun phrase with dollar amount
7. Multiple angles stacked (price AND comfort AND convenience all in one brief)
8. Composition is centered (should be F-pattern top-left)
9. Proof is generic stars without a specific outcome quote
10. Visual has no native-document cues (no screenshot chrome, paper texture, handwriting, receipt)
11. Primary text tries to sell in first 125 chars instead of creating curiosity

Return JSON:
{
  "briefs": [
    {
      "briefId": "2026-05-c01",
      "redFlagCount": 0,
      "redFlags": [],
      "passed": true
    },
    ...
  ]
}

2+ red flags = passed=false.

Briefs to evaluate:
{briefs_json}`;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runSniffTestGate(briefs: any[]): Promise<GateResult> {
  const briefsJson = JSON.stringify(
    briefs.map(b => ({
      briefId: b.briefId,
      conceptName: b.conceptName,
      visualDirection: b.visualDirection,
      primaryText: b.primaryText,
      headline: b.headline,
      description: b.description,
      layoutArchetype: b.layoutArchetype,
    })),
    null,
    2
  );
  const prompt = SNIFF_TEST_PROMPT.replace('{briefs_json}', briefsJson);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      name: 'sniff-test',
      passed: false,
      failures: ['rubric response did not contain JSON'],
    };
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    briefs: Array<{ briefId: string; redFlagCount: number; redFlags: string[]; passed: boolean }>;
  };
  const failures: string[] = parsed.briefs
    .filter(b => !b.passed)
    .map(b => `${b.briefId}: ${b.redFlags.join('; ')}`);
  return {
    name: 'sniff-test',
    passed: failures.length === 0,
    failures,
    details: parsed,
  };
}
```

- [ ] **Step 2: Wire into the cycle route**

In `src/app/api/creative-pipeline/cycle/[cycleId]/route.ts`, add the sniff test:

Add import:
```ts
import { runSniffTestGate } from '@/lib/workflows/creative-pipeline/gates/sniff-test';
```

Inside the gate construction:
```ts
const sniffTest = await runSniffTestGate(briefs as any);
const gates = {
  brandVoice: runBrandVoiceGate(briefs as any, BANNED_WORDS),
  duplicate: runDuplicateGate(briefs as any, priorNames),
  matrixDiversity: runMatrixDiversityGate(briefs as any),
  sniffTest,
};
```

- [ ] **Step 3: Add ANTHROPIC_API_KEY to env**

Verify it's in `.env.local` (should already exist for the dashboard's other Claude uses).

- [ ] **Step 4: Smoke test**

Reload `/workflows/creative-pipeline/2026-05`. Expected: Gate status panel now shows 4 gates. Sniff test takes 2-4 seconds on first load (warm cache afterward).

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflows/creative-pipeline/gates/sniff-test.ts src/app/api/creative-pipeline/cycle
git commit -m "feat: sniff-test gate powered by Haiku rubric"
```

**End of Phase 6 verification:** All 4 gates display on the cycle page. A deliberately polished brief (fixture) is flagged as failing. Gate status visible separately from score (per learning #2.1).

---

## Phase 7 — Close the loop: export-log-outcomes

Goal: After 30 days, Brady runs `./run-cycle.sh` again. The sync script pulls Neon resolved outcomes and appends to experiment-log.md so the next cycle's agent has fresh memory.

### Task 25: Implement export-log-outcomes.ts

**Files:**
- Modify: `~/workspace/sle/products/creative-pipeline/export-log-outcomes.ts`

- [ ] **Step 1: Replace the stub with real implementation**

```ts
// export-log-outcomes.ts
// Pulls resolved brief outcomes from Neon and appends to experiment-log.md
// Runs at the start of every cycle (called by run-cycle.sh).

import 'dotenv/config';
import pg from 'pg';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const REPO = process.cwd();
const LOG_PATH = join(REPO, 'experiment-log.md');
const SYNC_FILE = join(REPO, '.last-sync');

async function main() {
  const since = readSyncCheckpoint();
  console.log(`[export-log] syncing outcomes resolved since ${since ?? 'epoch'}`);

  const client = new pg.Client({
    connectionString: process.env.POSTGRES_URL,
  });
  await client.connect();

  try {
    const rows = await client.query<any>(
      `select
         brief_id, cycle_id, concept_name, angle, funnel_stage, matrix_cell,
         layout_archetype, spend, cpa, ctr, frequency, impressions, purchases,
         decision, kill_reason, launched_at, resolved_at
       from creative_briefs
       where status in ('resolved', 'killed')
         and ($1::timestamptz is null or resolved_at > $1)
       order by resolved_at asc`,
      [since]
    );

    if (rows.rowCount === 0) {
      console.log('[export-log] no new entries');
      return;
    }

    const existing = existsSync(LOG_PATH) ? readFileSync(LOG_PATH, 'utf-8') : '';
    const entries = rows.rows.map(r => formatEntry(r)).join('\n\n');
    const appendText = existing.trim() === ''
      ? `# Experiment Log\n\n${entries}\n`
      : `${existing.trimEnd()}\n\n${entries}\n`;
    writeFileSync(LOG_PATH, appendText);

    const newSince = rows.rows[rows.rows.length - 1].resolved_at;
    writeFileSync(SYNC_FILE, new Date(newSince).toISOString());

    console.log(`[export-log] appended ${rows.rowCount} entries`);
  } finally {
    await client.end();
  }
}

function readSyncCheckpoint(): string | null {
  if (!existsSync(SYNC_FILE)) return null;
  return readFileSync(SYNC_FILE, 'utf-8').trim();
}

function formatEntry(r: any): string {
  return `## ${r.brief_id}
- concept: ${r.concept_name}
- angle: ${r.angle}
- stage: ${r.funnel_stage}
- matrix: ${r.matrix_cell}
- layout: ${r.layout_archetype}
- spend: $${Number(r.spend).toFixed(2)}
- cpa: ${r.cpa !== null ? '$' + Number(r.cpa).toFixed(2) : 'n/a'}
- ctr: ${r.ctr !== null ? Number(r.ctr).toFixed(2) + '%' : 'n/a'}
- frequency_at_death: ${r.frequency !== null ? Number(r.frequency).toFixed(2) : 'n/a'}
- purchases: ${r.purchases ?? 0}
- status: ${r.decision === 'winner' ? 'resolved-winner' : r.decision === 'average' ? 'resolved-average' : 'killed'}
- kill_reason: ${r.kill_reason ?? 'n/a'}
- resolved_at: ${new Date(r.resolved_at).toISOString().slice(0, 10)}`;
}

main().catch(err => {
  console.error('[export-log] error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke test**

```bash
cd ~/workspace/sle/products/creative-pipeline
set -a && source .env.local && set +a
npx tsx export-log-outcomes.ts
```

Expected: either "no new entries" (if nothing resolved yet) or "appended N entries" and `experiment-log.md` grows by N blocks.

- [ ] **Step 3: Commit**

```bash
git add export-log-outcomes.ts
git commit -m "feat: export-log-outcomes syncs Neon → experiment-log.md"
```

### Task 26: Smoke-test the full cycle end-to-end

No files changed — this task is the verification lap.

- [ ] **Step 1: Reset any test data**

If running against real Meta account with real budgets, skip this — keep the real state. Otherwise, clear the test cycles:

```bash
set -a && source .env.local && set +a && psql "$POSTGRES_URL" -c "delete from creative_briefs where cycle_id in ('test-01','test-02');"
```

- [ ] **Step 2: Run a full cycle**

```bash
cd ~/workspace/sle/products/creative-pipeline
./run-cycle.sh
```

Agent generates `briefs/2026-05.md` with 12 concept briefs. Git commit is automatic.

- [ ] **Step 3: Import to dashboard**

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
curl -X POST http://localhost:3000/api/creative-pipeline/import-briefs \
  -H 'content-type: application/json' \
  -d '{"cycleId":"2026-05"}'
```

Expected: `{ inserted: 12 }`.

- [ ] **Step 4: Review in browser**

`http://localhost:3000/workflows/creative-pipeline/2026-05`

Check each panel:
- [ ] Inputs loaded (shows which files agent read — will be empty until the agent writes run-metrics.json to Neon; Phase 6 wire is out-of-scope for this task set, expect empty state)
- [ ] Matrix coverage (12 cells, 10+ distinct)
- [ ] Gate status (4 gates — brand-voice, duplicate, matrix-diversity, sniff-test)
- [ ] Push & outcome (12 proposed, 0 else)
- [ ] Metric history (no cycles resolved yet — empty chart)
- [ ] Hypothesis trail (12 entries, each with inspiration note)
- [ ] 12 brief cards, each expandable with "Push to Meta" button

- [ ] **Step 5: Push one brief to Meta**

Click "Push to Meta" on one card. Confirm in Ads Manager that the ad draft appears. Verify ad name matches `{briefId} · {conceptName}`.

- [ ] **Step 6: Simulate cron poll (dev)**

```bash
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll-meta-outcomes
```

Expected: brief flips from `pushed` → `live` (or unchanged if you haven't uploaded an image + activated yet).

- [ ] **Step 7: Check metric-history panel**

With some fabricated data (via psql UPDATE) or waiting 1-2 weeks for real outcomes, verify that the metric-history panel renders a line chart as cycles close.

- [ ] **Step 8: Commit any fixes made during verification**

```bash
git add .
git commit -m "fix: end-to-end verification cleanup"
```

- [ ] **Step 9: Merge to master (when Brady is satisfied)**

```bash
git checkout master
git merge --no-ff creative-pipeline-autoresearch
git push origin master
```

(Or open a PR. Brady's call.)

**End of Phase 7 verification:** The full loop is closed. Brady can run `./run-cycle.sh` in the creative-pipeline repo any time, and the monthly cycle produces 12 briefs → dashboard → Meta → outcomes → log. All 6 visibility panels render, all 4 gates compute, metric history accumulates over cycles.

---

## Self-Review

**Spec coverage:** Every section of the spec maps to tasks in this plan:
- § Architecture (loop lives locally) — addressed in Task 1 (repo scaffold) + Task 6 (run-cycle.sh)
- § File layout — Tasks 1-7 cover creative-pipeline files; Task 8 covers dashboard schema
- § Cycle lifecycle — Task 6 (step 1 kickoff), Tasks 11, 15 (import), Tasks 17, 20 (push), Task 21 (cron)
- § Neon schema — Task 8
- § 6 visibility panels — Task 18 (inputs), Task 17 (matrix, gate status, hypothesis trail, brief cards), Task 23 (push-outcome, metric-history)
- § Meta API push — Task 20
- § Sync scripts — Task 15 (import), Task 25 (export)
- § Evaluate.ts locked metric — Task 5
- § Seeding experiment-log — Task 4
- § Program.md v0 — Task 2
- § Sniff-test LLM gate — Task 24

**Placeholder scan:** I have two explicitly-marked placeholders in the plan:
- `REPLACE_WITH_*_ADSET_ID` in meta-adset-map.ts (Task 19) — Brady fills with real IDs after running the discovery script
- Banned-words list in the cycle API route (Task 17) — uses a small hard-coded list as an interim; full brandscript-driven list would require a parser for sle-brandscript.md (out of scope for v1, could be done after Phase 6 if needed)

Both are deliberate and documented. No "TBD" / "TODO" buried in task code.

**Type consistency:** `ParsedBrief` is defined in Task 9 and used consistently. Gate result names match across file (`brand-voice`, `duplicate`, `matrix-diversity`, `sniff-test`). `BriefStatus` values match across evaluate.ts and compute-score.ts.

**Scope check:** 7 phases × 26 tasks. Each phase ends with a verification step. Phase 1 (creative-pipeline repo + seed) is independently testable. Phases 2-6 build the dashboard incrementally, each phase runnable on its own. Phase 7 closes the loop.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-creative-pipeline-autoresearch.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for the 26-task plan; each subagent gets clean context so we don't hit image-size or context-carryover issues.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Risk: this session already carries the Brunson screenshot image (>2000px) that's been causing subagent dimension errors — might hit similar issues on tasks that use the Read tool on images.

Which approach?
