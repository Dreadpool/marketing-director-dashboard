# Karpathy Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the creative pipeline to Karpathy's autoresearch vocabulary (prepare / program / results), fold scattered priors and examples into program.md, and add a rejection-at-review flow so Brady's kills become training signal for the next cycle's agent.

**Architecture:** Three coordinated changes — (1) verbatim fold of 3 source docs into program.md, (2) file renames in the creative-pipeline repo, (3) new `rejected-at-review` status + reject UI + API in the dashboard — all without changing the loop's core mechanics (metric, matrix, 30-day cycle).

**Tech Stack:** creative-pipeline repo (plain Node + TS + markdown), marketing-director-dashboard (Next.js 15 App Router, Drizzle ORM on Neon Postgres, Tailwind + shadcn/ui).

---

## Phase 1 — Fold content into program.md

### Task 1: Write "Why this loop exists" preamble

**Files:**
- Modify: `~/workspace/sle/products/creative-pipeline/program.md:1-20`
- Read-only reference: `~/workspace/personal/knowledge-base/wiki/concepts/meta-creative-pipeline.md` (source content)

- [ ] **Step 1: Insert preamble as the first section of program.md**

Open `~/workspace/sle/products/creative-pipeline/program.md` and insert this block immediately below the `# SLE Creative Autoresearch — program.md` header and above `## Goal`:

```markdown
## Why this loop exists

This is an autoresearch loop for SLE's Meta static ads, modeled on Karpathy's
program.md + locked-metric pattern from the `autoresearch` repo.

The core premise: an LLM agent can grind on creative concept generation the
same way Karpathy's agent grinds on model training. Three files are sacred:

- `program.md` — rules, human-edited, agent reads
- `prepare.ts` — the locked metric (Karpathy's `prepare.py` analog)
- `results.md` — append-only memory (Karpathy's `results.tsv` analog)

Every other file is the agent's surface or domain data.

Every month, the agent reads last month's outcomes in `results.md`, reads real
customer feedback (NPS), reads the swipe-file of wild-caught winning ads, and
writes 12 new concept briefs covering a 4×3 matrix of angles × funnel stages.
Brady gatekeeps — accept, reject, or request edits. Accepted briefs become
Meta ads. A daily cron classifies outcomes. Next month's agent reads the
richer log.

**Deviations from Karpathy's pure pattern (justified):**

- 12 parallel hypotheses per cycle (`briefs/YYYY-MM.md`) instead of 1 serial
  model iteration (`train.py`). Real creative needs parallel exploration per
  cycle, not sequential mutation of one artifact.
- Human-in-loop (Brady reviews before push) because real ad spend + brand
  safety require a gate.
- 30-day cycle instead of Karpathy's 5-minute time budget. Real ads need real
  spend to produce meaningful CPA signal.

**The score** rewards hit rate × margin of victory: `winners × (target / avg_winner_cpa)`.
Higher is better. Goal: score trends up cycle over cycle.

---
```

- [ ] **Step 2: Commit**

```bash
cd ~/workspace/sle/products/creative-pipeline
git add program.md
git commit -m "program.md: add why-this-loop-exists preamble"
```

---

### Task 2: Append creative-research.md into program.md

**Files:**
- Modify: `~/workspace/sle/products/creative-pipeline/program.md` (append content)
- Read: `~/workspace/sle/products/creative-pipeline/reference/creative-research.md`

- [ ] **Step 1: Read the full content of reference/creative-research.md**

```bash
cat ~/workspace/sle/products/creative-pipeline/reference/creative-research.md
```

Expected: 328-line markdown with sections on visual gist, F-pattern, rule of thirds, social proof, layout archetypes, sniff test, etc. Image paths use `images/filename.ext` (relative to reference/).

- [ ] **Step 2: Append content to program.md with image path fix**

At the end of `program.md`, append:

```markdown

---

# Creative priors

_(Folded verbatim from what was `reference/creative-research.md`. Image paths adjusted: `images/` → `reference/images/`.)_

```

Then append the entire body of `reference/creative-research.md` (everything from its title line down), with one change: every occurrence of `images/` in image references becomes `reference/images/`. Do this with a sed pass after paste:

```bash
cd ~/workspace/sle/products/creative-pipeline
# Paste reference/creative-research.md content into program.md first (via editor),
# then fix image paths:
sed -i '' 's|`images/|`reference/images/|g; s|(images/|(reference/images/|g' program.md
```

Verify:
```bash
grep -c "reference/images/" program.md
```
Expected: at least 6 (the content has 6 image references).

- [ ] **Step 3: Commit**

```bash
git add program.md
git commit -m "program.md: fold creative priors inline (was reference/creative-research.md)"
```

---

### Task 3: Append ad-copy top performers into program.md

**Files:**
- Modify: `~/workspace/sle/products/creative-pipeline/program.md` (append content)
- Read: `~/workspace/sle/context/ad-copy/meta-ads-top-performers.md`

- [ ] **Step 1: Read the full content**

```bash
cat ~/workspace/sle/context/ad-copy/meta-ads-top-performers.md
```

Expected: 125-line markdown with performance table + top 5 ad copy variants + campaign structure + patterns.

- [ ] **Step 2: Append content to program.md**

At the end of `program.md`, append:

```markdown

---

# Historical SLE ads (what's worked)

_(Folded verbatim from `~/workspace/sle/context/ad-copy/meta-ads-top-performers.md` as of 2026-04-04. This is pattern-match source material — "copy first, then iterate" starts here.)_

```

Then append the entire body of `meta-ads-top-performers.md` (everything from the `# SLE Meta Ads` line down). No path adjustments needed — this doc has no relative image references.

- [ ] **Step 3: Verify final program.md size**

```bash
wc -l ~/workspace/sle/products/creative-pipeline/program.md
```
Expected: approximately 600–700 lines total.

- [ ] **Step 4: Commit**

```bash
git add program.md
git commit -m "program.md: fold historical SLE ad copy inline"
```

---

### Task 4: Update Files-in-scope section + delete creative-research.md

**Files:**
- Modify: `~/workspace/sle/products/creative-pipeline/program.md` (the "Files in scope" section)
- Delete: `~/workspace/sle/products/creative-pipeline/reference/creative-research.md`

- [ ] **Step 1: Replace the "You read" list in program.md**

Find the existing "You read:" list (previously edited to 9 items) and replace with:

```markdown
**You read:**
- `program.md` (this file — rules + creative priors + historical ads all inline)
- `reference/swipe-file.md` (your wild-caught winning ads)
- `reference/images/` (screenshots referenced from program.md and swipe-file.md)
- `results.md` (outcomes memory, grows each cycle)
- `~/workspace/sle/context/nps-feedback/nps-only.csv` (customer voice data)
- `~/workspace/sle/context/brand-voice/sle-brandscript.md` (evidence-backed voice)
- `~/workspace/sle/context/business-context.md` (routes, pricing, segments)
- `briefs/` directory (the last 3 months' files — for concept-avoidance only)
```

Also find the old "### Using NPS data" subsection (if still present) and leave it in place — the NPS guidance is still valid.

- [ ] **Step 2: Delete the now-redundant source file**

```bash
cd ~/workspace/sle/products/creative-pipeline
git rm reference/creative-research.md
```

- [ ] **Step 3: Remove any dangling references inside program.md**

Search and update:

```bash
# Places that say "reference/creative-research.md §5" or "§12" need updating
grep -n "reference/creative-research.md" program.md
```

Replace all occurrences:
- `reference/creative-research.md §5` → `§ "Creative priors" → Layout archetypes` (or similar pointer)
- `reference/creative-research.md §12` → `§ "Creative priors" → Sniff test`

Use sed:

```bash
sed -i '' 's|reference/creative-research.md §5|§ "Creative priors" above, the layout archetypes list|g; s|reference/creative-research.md §12|§ "Creative priors" above, the sniff-test checklist|g; s|reference/creative-research.md|§ "Creative priors" (below)|g' program.md
```

Verify no stragglers:

```bash
grep "reference/creative-research" program.md
```
Expected: 0 matches.

- [ ] **Step 4: Commit**

```bash
git add program.md reference/creative-research.md
git commit -m "program.md: drop reference/creative-research.md file; all refs updated"
```

---

### Task 5: Verify image paths resolve

**Files:** None modified — verification only.

- [ ] **Step 1: Confirm every image reference in program.md points at a real file**

```bash
cd ~/workspace/sle/products/creative-pipeline
grep -oE '\breference/images/[a-zA-Z0-9._-]+' program.md | sort -u | while read path; do
  if [[ -f "$path" ]]; then
    echo "OK $path"
  else
    echo "MISSING $path"
  fi
done
```

Expected: all OK, zero MISSING. If any MISSING, fix the reference in program.md to match actual filename in `reference/images/`.

- [ ] **Step 2: Confirm program.md is not broken**

```bash
head -20 program.md && echo "---" && tail -20 program.md
```

Expected: clean start (# header + preamble) and clean end (last historical-ad section).

---

## Phase 2 — Rename files to match Karpathy vocab

### Task 6: Rename files in creative-pipeline repo

**Files:**
- Rename: `evaluate.ts` → `prepare.ts`
- Rename: `evaluate.test.ts` → `prepare.test.ts`
- Rename: `experiment-log.md` → `results.md`
- Rename: `export-log-outcomes.ts` → `export-results.ts`

- [ ] **Step 1: Run the renames**

```bash
cd ~/workspace/sle/products/creative-pipeline
git mv evaluate.ts prepare.ts
git mv evaluate.test.ts prepare.test.ts
git mv experiment-log.md results.md
git mv export-log-outcomes.ts export-results.ts
```

- [ ] **Step 2: Update the import inside prepare.test.ts**

Open `prepare.test.ts` and change the import path:

```ts
// before:
import { computeCycleScore } from './evaluate';
// after:
import { computeCycleScore } from './prepare';
```

- [ ] **Step 3: Update header comment inside prepare.ts**

Open `prepare.ts` and update the top-of-file comment block:

```ts
// DO NOT MODIFY without Brady's explicit approval.
// The agent must not change this file — it's the frozen metric (Karpathy's prepare.py analog).
```

- [ ] **Step 4: Run tests to confirm rename didn't break anything**

```bash
npm test
```

Expected: 4 tests pass in `prepare.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add prepare.ts prepare.test.ts results.md export-results.ts
git commit -m "rename: evaluate→prepare, experiment-log→results, export-log→export-results"
```

---

### Task 7: Update program.md path references

**Files:**
- Modify: `~/workspace/sle/products/creative-pipeline/program.md`

- [ ] **Step 1: Run the string replacement**

```bash
cd ~/workspace/sle/products/creative-pipeline
sed -i '' 's|evaluate\.ts|prepare.ts|g; s|experiment-log\.md|results.md|g; s|export-log-outcomes\.ts|export-results.ts|g' program.md
```

- [ ] **Step 2: Verify no stragglers**

```bash
grep -E "evaluate\.ts|experiment-log\.md|export-log-outcomes\.ts" program.md
```
Expected: 0 matches.

- [ ] **Step 3: Commit**

```bash
git add program.md
git commit -m "program.md: update file refs (evaluate→prepare, experiment-log→results)"
```

---

### Task 8: Update run-cycle.sh + package.json

**Files:**
- Modify: `~/workspace/sle/products/creative-pipeline/run-cycle.sh`
- Modify: `~/workspace/sle/products/creative-pipeline/package.json`

- [ ] **Step 1: Update run-cycle.sh**

Find this line in `run-cycle.sh`:

```bash
  npx tsx export-log-outcomes.ts
```

Replace with:

```bash
  npx tsx export-results.ts
```

- [ ] **Step 2: Update package.json scripts**

Open `package.json`. Change:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "export-log": "tsx export-log-outcomes.ts",
  "evaluate": "tsx evaluate.ts"
},
```

To:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "export-results": "tsx export-results.ts"
},
```

(We drop the old `"evaluate"` script. `prepare.ts` is a library — it only exports functions and has no runnable entrypoint, so no script alias is needed.)

- [ ] **Step 3: Smoke-test run-cycle.sh syntax**

```bash
bash -n run-cycle.sh && echo "syntax OK"
```
Expected: `syntax OK`.

- [ ] **Step 4: Commit**

```bash
git add run-cycle.sh package.json
git commit -m "run-cycle.sh + package.json: use renamed files"
```

---

### Task 9: Update dashboard-side comment references

**Files:**
- Modify: `~/workspace/sle/products/marketing-director-dashboard/src/lib/workflows/creative-pipeline/compute-score.ts`

- [ ] **Step 1: Update the file-top comment**

Find the top-of-file comment in `compute-score.ts` (if any) that references `evaluate.ts`, and update to `prepare.ts`.

If no such comment exists, skip this step.

- [ ] **Step 2: Grep broadly for other mentions**

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
grep -rn "evaluate\.ts\|experiment-log\.md\|export-log-outcomes" src/ docs/
```

For each hit: if it's a code-level rename needed (inline docstring, JSDoc), update to match the new names. Skip references in historic spec docs (those should reflect history as-of-then).

Note: `docs/superpowers/specs/2026-04-17-creative-pipeline-autoresearch-design.md` and `docs/superpowers/plans/2026-04-17-creative-pipeline-autoresearch.md` should NOT be edited — they are historical records.

- [ ] **Step 3: Commit**

```bash
git add -p src/
git commit -m "dashboard: update comment references to new file names"
```

(Use `git add -p` to interactively stage only comment changes, skipping anything you don't want.)

---

## Phase 3 — Rename status `pushed` → `accepted`

### Task 10: Update BriefStatus type + default

**Files:**
- Modify: `~/workspace/sle/products/marketing-director-dashboard/src/lib/workflows/creative-pipeline/types.ts`

- [ ] **Step 1: Update BriefStatus union**

Find the existing `BriefStatus` type:

```ts
export type BriefStatus = 'proposed' | 'pushed' | 'live' | 'resolved' | 'killed';
```

Change to:

```ts
export type BriefStatus =
  | 'proposed'
  | 'accepted'
  | 'rejected-at-review'
  | 'live'
  | 'resolved'
  | 'killed';
```

(We add both `accepted` (replaces `pushed`) and `rejected-at-review` (new) in this single type update.)

- [ ] **Step 2: Run typecheck to find downstream compile errors**

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
npm run build 2>&1 | grep -iE "type ?error|\.tsx?:[0-9]+:[0-9]+" | head -30
```

Expected: errors at every site that uses the old `'pushed'` literal (brief-card, push-outcome, push-brief route, cron route, workflow index page).

- [ ] **Step 3: Commit the type change (code still broken at call sites, fix in next tasks)**

```bash
git add src/lib/workflows/creative-pipeline/types.ts
git commit -m "types: BriefStatus renames pushed→accepted, adds rejected-at-review"
```

---

### Task 11: Update all `'pushed'` usages in dashboard code

**Files:**
- Modify: `src/app/api/creative-pipeline/push-brief/[briefId]/route.ts`
- Modify: `src/app/api/cron/poll-meta-outcomes/route.ts`
- Modify: `src/components/workflows/creative-pipeline/brief-card.tsx`
- Modify: `src/components/workflows/creative-pipeline/push-outcome.tsx`
- Modify: `src/app/workflows/creative-pipeline/page.tsx`

- [ ] **Step 1: Replace `'pushed'` with `'accepted'` in each file's string literals**

For each file above:
1. Open the file
2. Find occurrences of `'pushed'` or `"pushed"` as status values (not inside URL paths like `push-brief` — those are route names, leave alone)
3. Replace with `'accepted'`

Concretely, a safe grep + manual review:

```bash
grep -n "'pushed'\|\"pushed\"" src/ -r | head -30
```

Edit each match that represents a status value (the surrounding code will say things like `status: 'pushed'`, `status === 'pushed'`, `inArray(status, ['pushed', 'live'])`).

- [ ] **Step 2: Update push-outcome.tsx pill counts**

In `push-outcome.tsx`, find the counts map:

```ts
const counts = {
  proposed: briefs.filter(b => b.status === 'proposed').length,
  pushed: briefs.filter(b => b.status === 'pushed').length,
  live: briefs.filter(b => b.status === 'live').length,
  resolved: briefs.filter(b => b.status === 'resolved').length,
  killed: briefs.filter(b => b.status === 'killed').length,
};
```

Replace with (adding rejected too):

```ts
const counts = {
  proposed: briefs.filter(b => b.status === 'proposed').length,
  rejected: briefs.filter(b => b.status === 'rejected-at-review').length,
  accepted: briefs.filter(b => b.status === 'accepted').length,
  live: briefs.filter(b => b.status === 'live').length,
  resolved: briefs.filter(b => b.status === 'resolved').length,
  killed: briefs.filter(b => b.status === 'killed').length,
};
```

Then update the JSX to render 6 pills instead of 5. Change the grid from `grid-cols-5` to `grid-cols-6` and add:

```tsx
<StatusPill label="proposed" count={counts.proposed} color="slate" />
<StatusPill label="rejected" count={counts.rejected} color="red" />
<StatusPill label="accepted" count={counts.accepted} color="blue" />
<StatusPill label="live" count={counts.live} color="emerald" />
<StatusPill label="resolved" count={counts.resolved} color="violet" />
<StatusPill label="killed" count={counts.killed} color="red" />
```

Note `rejected` and `killed` both use `red`. That's OK for visual consistency — the pill labels disambiguate.

- [ ] **Step 3: Update brief-card.tsx statusColor function**

In `brief-card.tsx`, find the `statusColor` function:

```ts
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

Replace the `pushed` line with `accepted`:

```ts
    case 'accepted': return 'bg-blue-900/50 text-blue-300';
```

Also add a new case:

```ts
    case 'rejected-at-review': return 'bg-red-900/50 text-red-300';
```

- [ ] **Step 4: Update cron classifier's status check**

In `src/app/api/cron/poll-meta-outcomes/route.ts`, find:

```ts
const activeBriefs = await db
  .select()
  .from(creativeBriefs)
  .where(inArray(creativeBriefs.status, ['pushed', 'live']));
```

Replace with:

```ts
const activeBriefs = await db
  .select()
  .from(creativeBriefs)
  .where(inArray(creativeBriefs.status, ['accepted', 'live']));
```

Also find the status-flip logic `if (isLive && brief.status === 'pushed')` — update to `'accepted'`.

- [ ] **Step 5: Update push-brief route**

In `src/app/api/creative-pipeline/push-brief/[briefId]/route.ts`, find:

```ts
await db
  .update(creativeBriefs)
  .set({
    status: 'pushed',
    metaAdId: ad.id,
    pushedAt: new Date(),
    updatedAt: new Date(),
  })
```

Replace with:

```ts
await db
  .update(creativeBriefs)
  .set({
    status: 'accepted',
    metaAdId: ad.id,
    pushedAt: new Date(),
    updatedAt: new Date(),
  })
```

- [ ] **Step 6: Typecheck**

```bash
npm run build 2>&1 | grep -iE "type ?error|\.tsx?:[0-9]+:[0-9]+" | head -10
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "status: rename pushed→accepted + add rejected-at-review placeholder"
```

---

### Task 12: Run data migration on Neon

**Files:** None modified in source — one-time migration command.

- [ ] **Step 1: Run the UPDATE**

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
set -a && source .env.local && set +a
npx tsx -e "
import { db } from './src/db';
import { creativeBriefs } from './src/db/schema';
import { eq } from 'drizzle-orm';
(async () => {
  const r = await db.update(creativeBriefs).set({ status: 'accepted' }).where(eq(creativeBriefs.status, 'pushed'));
  console.log('renamed pushed→accepted rows; done');
})();
"
```

Expected: command exits cleanly.

- [ ] **Step 2: Verify no stale `pushed` rows**

```bash
npx tsx -e "
import { db } from './src/db';
import { creativeBriefs } from './src/db/schema';
import { eq } from 'drizzle-orm';
(async () => {
  const r = await db.select().from(creativeBriefs).where(eq(creativeBriefs.status, 'pushed'));
  console.log('rows with status=pushed:', r.length);
})();
"
```

Expected: `rows with status=pushed: 0`.

---

## Phase 4 — Rejection logging

### Task 13: Add `rejected_at` column

**Files:**
- Modify: `~/workspace/sle/products/marketing-director-dashboard/src/db/schema.ts`

- [ ] **Step 1: Add rejectedAt column to creativeBriefs table**

Find the `creativeBriefs` table definition. Next to the existing `resolvedAt: timestamp("resolved_at")`, add:

```ts
  rejectedAt: timestamp("rejected_at"),
```

(Keep all other columns unchanged.)

- [ ] **Step 2: Generate migration**

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
npx drizzle-kit generate
```

Expected: a new file in `drizzle/` like `0003_*.sql` that adds the column.

- [ ] **Step 3: Inspect migration SQL**

```bash
ls -t drizzle/0003* | head -1 | xargs cat
```

Expected SQL:

```sql
ALTER TABLE "creative_briefs" ADD COLUMN "rejected_at" timestamp;
```

- [ ] **Step 4: Push to Neon**

```bash
set -a && source .env.local && set +a && npx drizzle-kit push
```

Expected: "Changes applied".

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "schema: add rejected_at column to creative_briefs"
```

---

### Task 14: TDD reject-brief API route

**Files:**
- Create: `src/app/api/creative-pipeline/reject-brief/[briefId]/route.ts`
- Create: `src/app/api/creative-pipeline/reject-brief/[briefId]/route.test.ts`

- [ ] **Step 1: Write the failing validation test**

Scope: the unit test covers only the request-parsing and reason-validation logic (the 400 paths that exit before any DB call). The happy-path 200 is covered by the integration smoke test in Task 19, which hits real Neon.

```ts
// src/app/api/creative-pipeline/reject-brief/[briefId]/route.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock db so the import chain resolves. The 400 paths exit before any db call,
// so the mock stays trivial.
vi.mock('@/db', () => ({
  db: {
    update: () => ({ set: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }) }),
  },
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://x/api/creative-pipeline/reject-brief/2026-04-c01', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/creative-pipeline/reject-brief/[briefId]', () => {
  it('returns 400 when body is not JSON', async () => {
    const req = new Request('http://x/api/creative-pipeline/reject-brief/2026-04-c01', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    });
    const res = await POST(req as any, { params: Promise.resolve({ briefId: '2026-04-c01' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is missing', async () => {
    const res = await POST(makeReq({}) as any, { params: Promise.resolve({ briefId: '2026-04-c01' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is under 10 chars', async () => {
    const res = await POST(makeReq({ reason: 'too short' }) as any, { params: Promise.resolve({ briefId: '2026-04-c01' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is only whitespace', async () => {
    const res = await POST(makeReq({ reason: '              ' }) as any, { params: Promise.resolve({ briefId: '2026-04-c01' }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
npx vitest run src/app/api/creative-pipeline/reject-brief/
```

Expected: FAIL — route module not found.

- [ ] **Step 3: Write the route**

```ts
// src/app/api/creative-pipeline/reject-brief/[briefId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const MIN_REASON_LENGTH = 10;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ briefId: string }> }
) {
  try {
    const { briefId } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const reason = (body.reason ?? '').trim();

    if (reason.length < MIN_REASON_LENGTH) {
      return NextResponse.json(
        { error: `reason must be at least ${MIN_REASON_LENGTH} characters` },
        { status: 400 }
      );
    }

    const now = new Date();
    const result = await db
      .update(creativeBriefs)
      .set({
        status: 'rejected-at-review',
        killReason: reason,
        rejectedAt: now,
        updatedAt: now,
      })
      .where(and(eq(creativeBriefs.briefId, briefId), eq(creativeBriefs.status, 'proposed')));

    const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
    if (rowCount === 0) {
      return NextResponse.json(
        { error: 'brief not found or not in proposed status' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      briefId,
      status: 'rejected-at-review',
      kill_reason: reason,
      rejected_at: now.toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npx vitest run src/app/api/creative-pipeline/reject-brief/
```

Expected: 4/4 pass. If not, fix the route until all pass.

- [ ] **Step 5: Typecheck the whole project**

```bash
npm run build 2>&1 | grep -iE "type ?error|\.tsx?:[0-9]+:[0-9]+" | head -10
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/creative-pipeline/reject-brief
git commit -m "feat: POST /api/creative-pipeline/reject-brief/:briefId with reason validation"
```

---

### Task 15: Update export-results.ts to include rejections

**Files:**
- Modify: `~/workspace/sle/products/creative-pipeline/export-results.ts`

- [ ] **Step 1: Update the SQL query**

Open `export-results.ts`. Find the current query:

```ts
const rows = await client.query<BriefRow>(
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
```

Replace with:

```ts
const rows = await client.query<BriefRow>(
  `select
     brief_id, cycle_id, concept_name, angle, funnel_stage, matrix_cell,
     layout_archetype, spend, cpa, ctr, frequency, impressions, purchases,
     decision, kill_reason, launched_at, resolved_at, rejected_at, status,
     coalesce(resolved_at, rejected_at) as finalized_at
   from creative_briefs
   where status in ('resolved', 'killed', 'rejected-at-review')
     and ($1::timestamptz is null or coalesce(resolved_at, rejected_at) > $1)
   order by coalesce(resolved_at, rejected_at) asc`,
  [since]
);
```

- [ ] **Step 2: Update the BriefRow interface**

In the same file, find the `interface BriefRow` definition and add:

```ts
  rejected_at: Date | null;
  status: string;
  finalized_at: Date;
```

(Add alongside existing fields. Keep the rest as-is.)

- [ ] **Step 3: Update the formatEntry function**

Find `function formatEntry`. Replace with a version that branches on status:

```ts
function formatEntry(r: BriefRow): string {
  if (r.status === 'rejected-at-review') {
    return `## ${r.brief_id}
- concept: ${r.concept_name}
- angle: ${r.angle}
- stage: ${r.funnel_stage}
- matrix: ${r.matrix_cell}
- layout: ${r.layout_archetype}
- status: rejected-at-review
- kill_reason: ${r.kill_reason ?? 'n/a'}
- resolved_at: ${new Date(r.finalized_at).toISOString().slice(0, 10)}`;
  }
  // resolved or killed
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
- resolved_at: ${new Date(r.finalized_at).toISOString().slice(0, 10)}`;
}
```

- [ ] **Step 4: Update the checkpoint write**

Find:

```ts
const newSince = rows.rows[rows.rows.length - 1].resolved_at;
writeFileSync(SYNC_FILE, new Date(newSince).toISOString());
```

Replace with:

```ts
const newSince = rows.rows[rows.rows.length - 1].finalized_at;
writeFileSync(SYNC_FILE, new Date(newSince).toISOString());
```

- [ ] **Step 5: Typecheck**

```bash
cd ~/workspace/sle/products/creative-pipeline
npx tsc --noEmit export-results.ts 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add export-results.ts
git commit -m "export-results: include rejected-at-review entries with kill_reason"
```

---

### Task 16: Update program.md 60-day rule

**Files:**
- Modify: `~/workspace/sle/products/creative-pipeline/program.md`

- [ ] **Step 1: Find and extend the 60-day rule**

Search program.md for the existing rule:

```
Don't re-propose a concept killed within 60 days unless the reason was external
```

Replace that sentence with:

```
Don't re-propose a concept killed or rejected-at-review within 60 days. Read the `kill_reason` field:
- If the reason describes a content issue ("off-brand", "wrong angle", "clever wordplay"), the rule is firm.
- If the reason describes an external factor ("wrong season", "saving for different cycle"), the concept can return.
```

- [ ] **Step 2: Commit**

```bash
git add program.md
git commit -m "program.md: extend 60-day rule to cover rejected-at-review entries"
```

---

## Phase 5 — Rejection UI in brief-card

### Task 17: Rename Push→Accept button + add Reject button

**Files:**
- Modify: `~/workspace/sle/products/marketing-director-dashboard/src/components/workflows/creative-pipeline/brief-card.tsx`

- [ ] **Step 1: Rename the existing button label**

Find the existing button JSX:

```tsx
<button
  onClick={() => pushToMeta(brief.briefId)}
  className="mt-2 px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 rounded text-slate-950 font-medium transition"
>
  Push to Meta →
</button>
```

Replace with a two-button row (Accept + Reject):

```tsx
<div className="flex items-center gap-2 mt-3">
  <button
    onClick={() => pushToMeta(brief.briefId)}
    className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 rounded text-slate-950 font-medium transition"
  >
    Accept →
  </button>
  <button
    onClick={() => setRejecting(true)}
    className="px-3 py-1.5 text-xs bg-transparent border border-red-900/60 hover:border-red-600/80 hover:bg-red-950/30 rounded text-red-300 font-medium transition"
  >
    Reject
  </button>
</div>
```

- [ ] **Step 2: Add `rejecting` local state + rejection UI**

At the top of the `BriefCard` component function (just below `const [expanded, setExpanded] = useState(false);`), add:

```tsx
const [rejecting, setRejecting] = useState(false);
const [rejectReason, setRejectReason] = useState('');
const [rejectingError, setRejectingError] = useState<string | null>(null);
```

Then, in the expanded-card body, after the existing two-button row (only shown when `status === 'proposed'` — you'll add that guard in step 3), add the conditional rejection form:

```tsx
{rejecting && (
  <div className="mt-3 rounded border border-red-900/40 bg-red-950/20 p-3">
    <label className="block text-xs text-red-200 uppercase tracking-wide mb-1">
      Reason (required, min 10 chars)
    </label>
    <textarea
      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 min-h-[72px] focus:outline-none focus:border-slate-500"
      placeholder="off-brand, we don't use 'Seriously.' as a hook"
      value={rejectReason}
      onChange={e => setRejectReason(e.target.value)}
    />
    {rejectingError && (
      <div className="mt-2 text-xs text-red-400">{rejectingError}</div>
    )}
    <div className="flex gap-2 mt-2 justify-end">
      <button
        onClick={() => {
          setRejecting(false);
          setRejectReason('');
          setRejectingError(null);
        }}
        className="px-3 py-1.5 text-xs bg-transparent border border-slate-700 hover:border-slate-500 rounded text-slate-300 transition"
      >
        Cancel
      </button>
      <button
        disabled={rejectReason.trim().length < 10}
        onClick={() => rejectBrief(brief.briefId, rejectReason.trim(), setRejectingError)}
        className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed rounded text-red-100 transition"
      >
        Save rejection
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Guard the buttons behind `status === 'proposed'`**

Wrap both the Accept/Reject button-row and the rejection form in `{brief.status === 'proposed' && (...)}`. The snippet structure:

```tsx
{brief.status === 'proposed' && (
  <>
    {!rejecting && (
      <div className="flex items-center gap-2 mt-3">
        {/* Accept + Reject buttons from step 1 */}
      </div>
    )}
    {rejecting && (
      <div className="mt-3 rounded border border-red-900/40 bg-red-950/20 p-3">
        {/* textarea + save/cancel from step 2 */}
      </div>
    )}
  </>
)}
```

- [ ] **Step 4: Add the rejected-state display block**

Immediately after the above `status === 'proposed'` block, add a display for the rejected state. (Augment the `Brief` interface first — see step 5.)

```tsx
{brief.status === 'rejected-at-review' && brief.killReason && (
  <div className="mt-3 rounded border border-red-900/40 bg-red-950/20 p-3">
    <div className="text-xs text-red-200 uppercase tracking-wide mb-1">
      Rejected {brief.rejectedAt ? new Date(brief.rejectedAt).toISOString().slice(0, 10) : ''}
    </div>
    <div className="text-sm text-red-100">{brief.killReason}</div>
  </div>
)}
```

- [ ] **Step 5: Extend the Brief interface to include killReason + rejectedAt**

At the top of `brief-card.tsx`, find:

```tsx
export interface Brief {
  briefId: string;
  conceptName: string;
  // ...
  status: string;
}
```

Add these two fields to the interface:

```tsx
  killReason?: string | null;
  rejectedAt?: string | null;
```

- [ ] **Step 6: Add the rejectBrief fetch helper**

At the bottom of the file (next to the existing `pushToMeta` helper), add:

```tsx
async function rejectBrief(
  briefId: string,
  reason: string,
  setError: (e: string | null) => void
) {
  const res = await fetch(`/api/creative-pipeline/reject-brief/${briefId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (res.ok) {
    window.location.reload();
    return;
  }
  const err = await res.json().catch(() => ({ error: 'unknown' }));
  setError(err.error || 'rejection failed');
}
```

- [ ] **Step 7: Typecheck**

```bash
npm run build 2>&1 | grep -iE "type ?error|\.tsx?:[0-9]+:[0-9]+" | head -10
```

Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/workflows/creative-pipeline/brief-card.tsx
git commit -m "ui: brief-card Accept/Reject with inline rejection form"
```

---

### Task 18: Verify cycle API returns killReason + rejectedAt

**Files:**
- Modify: `src/app/api/creative-pipeline/cycle/[cycleId]/route.ts` (if needed)

- [ ] **Step 1: Check current select shape**

Open `src/app/api/creative-pipeline/cycle/[cycleId]/route.ts`. Find where briefs are selected. The current call is:

```ts
const briefs = await db
  .select()
  .from(creativeBriefs)
  .where(eq(creativeBriefs.cycleId, cycleId))
  .orderBy(creativeBriefs.briefId);
```

`db.select()` with no fields returns all columns by Drizzle default, so `killReason` and `rejectedAt` are included. No code change needed if the default holds.

- [ ] **Step 2: Smoke-test the response includes the new fields**

Start the dev server if not already running (`npm run dev` in the dashboard repo), then:

```bash
set -a && source .env.local && set +a
curl -s http://localhost:3000/api/creative-pipeline/cycle/2026-04 | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('briefs'):
  keys = list(d['briefs'][0].keys())
  has_kr = 'killReason' in keys or 'kill_reason' in keys
  has_ra = 'rejectedAt' in keys or 'rejected_at' in keys
  print('has killReason:', has_kr)
  print('has rejectedAt:', has_ra)
  print('sample keys:', keys[:15])
"
```

Expected: both `has killReason: True` and `has rejectedAt: True`.

If either is False, replace the implicit `db.select()` in `cycle/[cycleId]/route.ts` with an explicit column list that includes both `killReason` and `rejectedAt`. For example:

```ts
const briefs = await db
  .select({
    briefId: creativeBriefs.briefId,
    cycleId: creativeBriefs.cycleId,
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
    status: creativeBriefs.status,
    metaAdId: creativeBriefs.metaAdId,
    spend: creativeBriefs.spend,
    cpa: creativeBriefs.cpa,
    decision: creativeBriefs.decision,
    killReason: creativeBriefs.killReason,
    rejectedAt: creativeBriefs.rejectedAt,
  })
  .from(creativeBriefs)
  .where(eq(creativeBriefs.cycleId, cycleId))
  .orderBy(creativeBriefs.briefId);
```

- [ ] **Step 3: Commit (only if changes were needed)**

```bash
git add src/app/api/creative-pipeline/cycle
git commit -m "api/cycle: include killReason + rejectedAt in response"
```

---

### Task 19: End-to-end reject-flow smoke test

**Files:** None modified — verification only.

- [ ] **Step 1: Start dev server**

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
set -a && source .env.local && set +a
npm run dev &
sleep 10
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/workflows/creative-pipeline/2026-04
```

Expected: `HTTP 200`.

- [ ] **Step 2: Reject a brief via curl**

Pick any proposed brief (e.g., `2026-04-c12`) and POST:

```bash
curl -sX POST http://localhost:3000/api/creative-pipeline/reject-brief/2026-04-c12 \
  -H 'content-type: application/json' \
  -d '{"reason":"smoke test — clever wordplay headline"}'
```

Expected: JSON response with `status: "rejected-at-review"`.

- [ ] **Step 3: Verify DB state**

```bash
npx tsx -e "
import { db } from './src/db';
import { creativeBriefs } from './src/db/schema';
import { eq } from 'drizzle-orm';
(async () => {
  const r = await db.select().from(creativeBriefs).where(eq(creativeBriefs.briefId, '2026-04-c12'));
  console.log('row:', r[0]);
})();
"
```

Expected: `status: 'rejected-at-review'`, `killReason: 'smoke test — clever wordplay headline'`, `rejectedAt` is a recent timestamp.

- [ ] **Step 4: Verify cycle page reflects the rejection**

Load `http://localhost:3000/workflows/creative-pipeline/2026-04` in the browser. Expected:
- Push & outcome panel shows `rejected: 1`
- The c12 brief card (when expanded) shows the rejection reason + date, no Accept/Reject buttons

- [ ] **Step 5: Test the validation**

```bash
curl -sX POST http://localhost:3000/api/creative-pipeline/reject-brief/2026-04-c11 \
  -H 'content-type: application/json' \
  -d '{"reason":"too"}'
```

Expected: HTTP 400 with error message about reason length.

- [ ] **Step 6: Test duplicate reject (already rejected)**

```bash
curl -sX POST http://localhost:3000/api/creative-pipeline/reject-brief/2026-04-c12 \
  -H 'content-type: application/json' \
  -d '{"reason":"this should 409 because it is already rejected"}'
```

Expected: HTTP 409.

- [ ] **Step 7: Kill dev server**

```bash
lsof -ti:3000 | xargs kill 2>/dev/null || true
```

---

## Phase 6 — Visualizer + final sweep

### Task 20: Update the 15-step visualizer

**Files:**
- Modify: `~/workspace/personal/share-artifacts/sle-creative-autoresearch.html`

- [ ] **Step 1: Update file-path references in the visualizer content**

Open the HTML file and find the STEPS data array. Update every mention of:
- `evaluate.ts` → `prepare.ts`
- `experiment-log.md` → `results.md`
- `export-log-outcomes.ts` → `export-results.ts`

Quickest approach:

```bash
cd ~/workspace/personal/share-artifacts
sed -i '' 's|evaluate\.ts|prepare.ts|g; s|experiment-log\.md|results.md|g; s|export-log-outcomes\.ts|export-results.ts|g' sle-creative-autoresearch.html
```

Verify:

```bash
grep -E "evaluate\.ts|experiment-log\.md|export-log-outcomes\.ts" sle-creative-autoresearch.html
```
Expected: 0 matches.

- [ ] **Step 2: Add briefs/train.py mapping callout on step 7**

Find step 7's `body` (the "Agent writes 12 briefs" step). In its body HTML, add a callout (a `<div class="tip">` block) immediately after the opening paragraph:

```html
<div class="tip mb-5">
  <strong>Karpathy analog.</strong> In Karpathy's <span class="code">autoresearch</span> repo, the agent edits a single <span class="code">train.py</span> in place each iteration, committing to git. Ours writes a new <span class="code">briefs/YYYY-MM.md</span> per cycle — 12 parallel hypotheses instead of one sequential mutation. The directory stays named <span class="code">briefs/</span> because that's what it is semantically; the Karpathy mapping lives in the mental model, not the filename.
</div>
```

Place it before the existing "Each brief block contains:" paragraph.

- [ ] **Step 3: Smoke test by re-opening**

```bash
open ~/workspace/personal/share-artifacts/sle-creative-autoresearch.html
```

Expected: page loads, step 7 shows the new Karpathy callout, no broken references.

- [ ] **Step 4: Commit**

```bash
cd ~/workspace/personal/share-artifacts
git add sle-creative-autoresearch.html 2>/dev/null || true
# (share-artifacts may or may not be a git repo — skip commit if not)
```

---

### Task 21: Final typecheck + test sweep

**Files:** None modified — verification only.

- [ ] **Step 1: creative-pipeline repo tests**

```bash
cd ~/workspace/sle/products/creative-pipeline
npm test
```

Expected: all tests pass (4 from `prepare.test.ts`).

- [ ] **Step 2: Dashboard typecheck**

```bash
cd ~/workspace/sle/products/marketing-director-dashboard
npm run build 2>&1 | grep -iE "type ?error|\.tsx?:[0-9]+:[0-9]+" | head -10
```

Expected: no type errors.

- [ ] **Step 3: Dashboard tests**

```bash
npx vitest run src/lib/workflows/creative-pipeline src/app/api/creative-pipeline
```

Expected: all tests pass (existing 15 + 3 new reject-brief tests = 18 tests).

- [ ] **Step 4: Sanity-check cycle page renders fast**

```bash
set -a && source .env.local && set +a
npm run dev &
sleep 10
curl -s -o /dev/null -w "HTTP %{http_code} | time %{time_total}s\n" http://localhost:3000/api/creative-pipeline/cycle/2026-04
lsof -ti:3000 | xargs kill 2>/dev/null
```

Expected: `HTTP 200` with `time < 1.0s` (sniff-test still opt-in, default path is fast).

- [ ] **Step 5: Final commit if anything leaked**

```bash
git status
```

If anything unstaged, commit it with a clear message. Otherwise no action.

---

## Summary of changed files

**creative-pipeline repo:**
- `program.md` — major rewrite (preamble, folded content, updated refs, extended 60-day rule)
- `reference/creative-research.md` — deleted
- `prepare.ts` (was evaluate.ts), `prepare.test.ts` (was evaluate.test.ts) — renamed
- `results.md` (was experiment-log.md) — renamed
- `export-results.ts` (was export-log-outcomes.ts) — renamed + extended query
- `run-cycle.sh`, `package.json` — updated refs

**marketing-director-dashboard repo:**
- `src/db/schema.ts` + new drizzle migration — `rejected_at` column
- `src/lib/workflows/creative-pipeline/types.ts` — BriefStatus union updated
- `src/components/workflows/creative-pipeline/brief-card.tsx` — Accept/Reject UI + rejection form
- `src/components/workflows/creative-pipeline/push-outcome.tsx` — 6 status pills
- `src/app/api/creative-pipeline/push-brief/[briefId]/route.ts` — status literal
- `src/app/api/creative-pipeline/reject-brief/[briefId]/route.ts` + test — new route
- `src/app/api/cron/poll-meta-outcomes/route.ts` — status literals
- `src/app/workflows/creative-pipeline/page.tsx` — status literals

**share-artifacts:**
- `sle-creative-autoresearch.html` — path refs + briefs/train.py callout

**docs:**
- `docs/superpowers/specs/2026-04-18-karpathy-alignment-design.md` — already written
- `docs/superpowers/plans/2026-04-18-karpathy-alignment.md` — this file

---

## Self-review notes (to the implementer)

The three phases are mostly independent; do them in order if possible. The status rename (Phase 3) must land before the reject-flow (Phase 4) compiles cleanly because both touch the `BriefStatus` union.

If a task's tests fail for reasons unrelated to the task's intent (pre-existing flakiness), note it and continue — don't spend cycles debugging unrelated code. Report pre-existing flakes to Brady after the plan completes.

No tasks require Meta API credentials to be valid — the reject-flow is a pure Neon mutation. Tests use mocked db.

The only place image paths move is in program.md's folded creative-research content: `images/` → `reference/images/` (Task 2 Step 2). Verify Task 5 passes before moving on.
