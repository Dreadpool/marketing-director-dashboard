# Meta Ads Guided Evaluation — Design Spec

## Context

The Meta Ads Analysis workflow fetches all data at once and displays it as a dashboard. Users must cross-reference a separate CTC training guide to know what to evaluate, what thresholds apply, and what to do when metrics are off. This creates two problems:

1. **Wrong data slices.** The dashboard shows lifetime/monthly aggregates, but the training guide says to check 7-day frequency, MoM CPM trends, etc. The user sees a number but doesn't know if it's the right number for the evaluation they're doing.
2. **No guided path.** The user has to hold the entire CTC framework in their head while scanning a data dump. They get stuck at step one ("Is this 7-day frequency or lifetime?") and give up.

The guided evaluation replaces "here's all your data, figure it out" with "here's the one thing to evaluate right now, here's the data for it, and here's what the AI thinks." Human and AI work through the framework together, step by step.

## Architecture

### Relationship to Existing Workflows

The existing `meta-ads-analysis` workflow (fetch → analyze → recommend) stays as-is. It's useful for quick automated analysis. The guided evaluation is a **separate workflow** (`meta-ads-evaluation`) with a different execution model.

Both share the same initial data fetch (Meta Ads executor). The guided evaluation adds targeted API calls for specific time windows at steps that need them.

### New Workflow Type: `guided-evaluation`

The existing engine supports three step types (`fetch | analyze | recommend`) that run sequentially and automatically. The guided evaluation needs a fundamentally different interaction model:

- **Interactive**: Steps pause for user input (confirm/override) instead of auto-advancing
- **Branching**: Some steps only execute based on prior results (CPA diagnostic sub-flow)
- **Per-step action items**: Users edit action items at each step, not just at the end
- **Per-step AI evaluation**: Each step gets its own AI call with focused context and threshold criteria

Rather than retrofitting interactivity into the existing linear engine, this is a new evaluation engine that shares the same DB tables.

### Execution Flow

```
1. User clicks "Start Monthly Evaluation" on the workflow page
2. POST /api/workflows/meta-ads-evaluation/run { period }
3. Backend: create run record, execute initial data fetch (existing meta-ads executor)
4. Backend: prepare Step 1 data + run AI evaluation for Step 1
5. Return: { runId, currentStep: { data, aiEvaluation, suggestedActions } }
6. Frontend: render Step 1 (data cards → AI evaluation → action items)
7. User: reviews AI evaluation, clicks Agree or Override, edits action items
8. POST /api/workflows/.../runs/{id}/steps/{stepId}/respond { decision, actionItems }
9. Backend: record decision, determine next step, fetch additional data if needed, run AI for next step
10. Return: { nextStep: { data, aiEvaluation, suggestedActions } }
11. Repeat until final step (Action Items Summary)
```

Each step is a request-response cycle. The run lives in the DB so users can leave and resume later.

### Step UI Pattern (Stacked Layout)

Every evaluation step renders the same structure:

```
┌─────────────────────────────────────────┐
│ Progress bar (Step X of 6)              │
├─────────────────────────────────────────┤
│ DATA                                    │
│ Metric cards, tables, charts specific   │
│ to this step. Only what's relevant.     │
├─────────────────────────────────────────┤
│ AI EVALUATION                           │
│ AI's assessment with reasoning.         │
│ Status badge (on-target / elevated /    │
│ high / healthy / flagged).              │
│                                         │
│ [✓ Agree]  [✗ Override]                 │
│ (Override shows text input for reason)  │
├─────────────────────────────────────────┤
│ ACTION ITEMS (from this step)           │
│ AI-suggested items, editable by user.   │
│ Each has: text, priority, owner.        │
│ [+ Add item]                            │
├─────────────────────────────────────────┤
│ [← Back]              [Next: Step N →]  │
└─────────────────────────────────────────┘
```

## Decision Tree

### Main Spine (6 Steps — All Always Execute)

**Step 1: Decision Metrics Check**
- Data: Account CPA, ROAS, purchase volume, prospecting CPA, retargeting CPA (separately)
- Comparisons: MoM and YoY (SLE is seasonal, YoY more meaningful)
- Thresholds: CPA <$9 on-target, $9-14 elevated, >$14 high. ROAS floor 3.0x. Retargeting CPA should be lower than prospecting.
- Branch: If CPA elevated or high → enter CPA Diagnostic sub-flow before Step 2
- Data source: Existing meta-ads fetch (account_health + campaigns filtered by funnel_stage)

**Step 2: Backend Verification**
- Data: Meta-reported purchases vs actual SLE bookings (BigQuery), blended CAC (all ad spend / new customers), MER (total revenue / total ad spend)
- Thresholds: Attribution gap 10-15% = normal, 2x+ = broken. Blended CAC target <$22. MER target >3.0x.
- Data source: Cross-source — Meta fetch (purchases) + BigQuery (sales_orders, customer_first_order) + QuickBooks GL (total ad spend)
- Note: This step validates that Meta's numbers are trustworthy before we act on them

**Step 3: Campaign Structure**
- Data: Active campaigns and ad sets, budget per ad set, spend concentration, prospecting vs retargeting split, zombie campaigns
- Thresholds: Budget per ad set needs $6,000/mo to exit learning phase. At SLE's ~$6,900/mo budget, that's 1-2 properly funded ad sets max. Spend concentration >60% in one campaign = risk. Prospecting/retargeting split target ~80/20. Zombie = <$50 spend or zero purchases while active.
- Consolidation math: monthly spend / (5 × $9 target CPA × 30) = max properly funded ad sets
- Data source: Existing meta-ads fetch (campaigns array)

**Step 4: Creative Health**
- Data (all accounts): Which 3-5 ads carry most spend? Creative over-reliance? New creatives launched this month (none = red flag)? Fatigue signals (frequency up + CTR down + CPM up)?
- Data (CPA off-target, deeper): Hook rate (<25% flag), hold rate (<30% flag), top/bottom 5 ads by CPA, specific fatigue diagnosis per ad
- Note: Image-only ads have null hook/hold rates — skip video metrics for those
- Data source: Existing meta-ads fetch (ads array + signals.fatigued_ads)

**Step 5: Audience Check**
- Data (all accounts): Best/worst converting age/gender segments. Geo: spending in SLE route states (ID, UT, MT, NV, OR, WA)? Any spend going to states with no SLE service?
- Data (CPA off-target, deeper): Full efficiency index analysis by segment. Flag segments with efficiency_index >1.5 (spending 50%+ more per acquisition than average).
- Data source: Existing meta-ads fetch (audience breakdowns)

**Step 6: Action Items Summary**
- Accumulated action items from all steps
- Each item has: text, priority (CRITICAL / HIGH / MEDIUM), owner (Agency / Director / Joint)
- Owner definitions:
  - **Agency**: Actions they execute (creative rotation, targeting changes, bid adjustments)
  - **Director**: Your decisions (budget approval, strategic direction, channel mix)
  - **Joint**: Requires discussion (campaign consolidation, strategy pivots)
- Final edit pass before saving to action items board

### CPA Diagnostic Sub-Flow (Between Step 1 and Step 2, Only When CPA Off-Target)

**D1: Frequency Check**
- Data: 7-day rolling frequency by campaign
- Threshold: >3.0 in 7 days = fatigue risk
- Diagnosis: "People are seeing the same ad too many times. Creative fatigue or audience too small."
- Data source: **New API call** — Meta campaign insights with 7-day date range, frequency field

**D2: CPM Trend**
- Data: Current month CPM vs prior month CPM by campaign
- Threshold: >30% increase MoM
- Diagnosis: "Auction getting more expensive. Audience saturated or seasonal competition."
- Data source: **New API call** — Meta campaign insights for prior month (CPM field). Current month already fetched.

**D3: CTR Trend**
- Data: Current month CTR vs prior month CTR by campaign
- Threshold: >20% decrease MoM
- Diagnosis: "People ignoring the creative. Ad not grabbing attention or not relevant to audience."
- Data source: Same prior month fetch as D2 (CTR field)

**D4: Conversion Rate Check**
- Data: Click volume vs purchase volume (current month)
- Threshold: Clicks stable or up, purchases down
- Diagnosis: "Not an ads problem. People click but don't buy. Issue is landing page, booking flow, pricing, or offer."
- Data source: Existing meta-ads fetch (clicks + purchases in account_health)

**D5: Pattern Match**
- Data: Combined signals from D1-D4
- AI combines signals into root cause diagnosis:
  - freq↑ + CTR↓ + CPA↑ = **Creative fatigue**
  - CPM↑ + freq stable + CPA↑ = **Audience saturation**
  - CTR stable + CVR↓ + CPA↑ = **Landing page problem**
  - Retargeting CPA good + prospecting CPA bad = **Growth engine broken**
  - Meta purchases >> SLE bookings = **Attribution inflation**
- AI generates targeted action items based on the diagnosed root cause
- Data source: Results from D1-D4 (no new fetch)

## Data Requirements

### Existing Data (No New API Calls)

| Step | Data | Source |
|------|------|--------|
| Step 1 | Account CPA, ROAS, purchases, prospecting/retargeting split | meta-ads executor → account_health + campaigns by funnel_stage |
| Step 3 | Campaign list, spend, purchases, funnel_stage | meta-ads executor → campaigns array |
| Step 4 | Ad-level metrics, hook/hold rates, fatigue signals | meta-ads executor → ads array + signals |
| Step 5 | Audience breakdowns with efficiency_index | meta-ads executor → audience object |
| D4 | Clicks, purchases | meta-ads executor → account_health |

### New API Calls Required

| Step | Data Needed | API Call |
|------|-------------|----------|
| D1 | 7-day campaign frequency | `getMonthlyInsights()` with 7-day date range instead of full month |
| D2, D3 | Prior month CPM, CTR by campaign | `getMonthlyInsights()` for prior month period |
| Step 2 | SLE bookings count for the month | BigQuery: `sales_orders` WHERE period matches |
| Step 2 | New customer count | BigQuery: `customer_first_order` WHERE first order in period |
| Step 2 | Total ad spend (all channels) | QuickBooks GL: sum of ad accounts 65010-65017 |
| Step 2 | Total revenue | BigQuery: gross bookings for period |

### New Meta Ads Service Methods Needed

```typescript
// 7-day frequency for CPA diagnostic D1
getWeeklyFrequency(period: MonthPeriod): Promise<CampaignFrequencyRow[]>
// Returns: campaign_id, campaign_name, frequency (7-day rolling at end of month)

// Prior month insights for CPA diagnostic D2/D3
// Already possible: call existing getMonthlyInsights() with prior month period
```

## DB Schema Changes

### Additions to Existing Tables

**`workflowStepRuns`** — add column:
- `userResponse` (jsonb, nullable): `{ decision: "agree" | "override", overrideReason?: string }`

**`actionItems`** — add column:
- `owner` (varchar 20, nullable): `"agency" | "director" | "joint"`

### New: Evaluation Step Definitions

Step definitions live in code (not DB), similar to how workflow definitions work today. Each step definition includes:
- `id`: unique step identifier
- `label`: display name
- `description`: what this step evaluates
- `condition`: `"always"` or a function that checks prior step results
- `dataRequirements`: what data this step needs (for targeted fetching)
- `thresholds`: the evaluation criteria
- `promptTemplate`: AI prompt for this step's evaluation

## Workflow Registration

```typescript
// In src/lib/workflows.ts — add new workflow
{
  slug: "meta-ads-evaluation",
  title: "Meta Ads Monthly Evaluation",
  description: "Interactive step-by-step evaluation of Meta Ads performance using the CTC framework. AI evaluates each metric against thresholds, you confirm or override, and build action items as you go.",
  icon: "clipboard-check",
  status: "active",
  cadence: { frequency: "monthly", dueRule: { type: "day-of-month", day: 10 } },
  dataSources: ["meta_ads", "bigquery", "quickbooks_gl"],
  workflowType: "guided-evaluation",  // NEW field — distinguishes from linear workflows
  steps: [/* defined in evaluation engine, not here */]
}
```

The workflow detail page checks `workflowType` and renders either the existing linear UI or the new evaluation wizard UI.

## SLE-Specific Thresholds

The CTC training guide uses generic thresholds ($12 CPA, 6.9x ROAS). We recalculated from SLE unit economics:

| Metric | Training Guide | SLE Calculated | Reason |
|--------|---------------|----------------|--------|
| CPA on-target | <$12 | <$9 | $35.23 GP / 3 / 1.3x = $9.03 |
| CPA elevated | $12-18 | $9-14 | 2:1 GP ratio after over-attribution |
| ROAS floor | 6.9x | 3.0x | GP breakeven after COGS |
| Blended CAC ceiling | — | $22 | 3:1 LTV:CAC with $66 median LTV |
| Learning budget/ad set | $6,000/mo | $6,000/mo | Same (50 conversions/week × CPA) |
| Max funded ad sets | — | 1-2 | $6,900 budget / $6,000 |

The guided evaluation uses SLE values. The training guide values are noted for reference only.

## First Build Scope (Phase 1)

Build the core evaluation loop: **Step 1 (Decision Metrics) + CPA Diagnostic (D1-D5) + Step 6 (Action Items Summary)**.

This delivers the highest-value piece first: the part where users get stuck today. It requires:
- New evaluation engine (interactive step execution)
- New workflow page UI (wizard layout)
- One new Meta API call (7-day frequency)
- Prior month Meta fetch (for CPM/CTR trends)
- Per-step AI evaluation prompts
- Per-step editable action items with owners
- Agree/override interaction model

Steps 2-5 use data already fetched and have more straightforward evaluation logic. They become Phase 2.

### Phase 1 Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/workflows/evaluation-engine.ts` | Interactive evaluation execution (prepare step, handle response, determine next) |
| Create | `src/lib/workflows/evaluations/meta-ads-monthly.ts` | Step definitions, thresholds, conditions, data requirements |
| Create | `src/lib/workflows/evaluations/types.ts` | EvaluationStep, EvaluationRun, UserResponse types |
| Create | `src/lib/workflows/prompts/meta-ads-evaluation.ts` | Per-step AI prompt templates |
| Create | `src/lib/services/meta-ads.ts` | Add `getWeeklyFrequency()` method |
| Create | `src/components/workflows/evaluation-wizard.tsx` | Wizard container (progress bar, step navigation, state management) |
| Create | `src/components/workflows/evaluation-step.tsx` | Single step renderer (data → AI → actions layout) |
| Create | `src/components/workflows/evaluation-actions.tsx` | Per-step action item editor with owner tags |
| Create | `src/components/workflows/steps/decision-metrics.tsx` | Step 1 data visualization (CPA/ROAS/purchases cards) |
| Create | `src/components/workflows/steps/cpa-diagnostic.tsx` | D1-D5 data visualization |
| Create | `src/components/workflows/steps/action-summary.tsx` | Final accumulated action items view |
| Create | `src/app/api/workflows/[slug]/runs/[runId]/steps/[stepId]/respond/route.ts` | User response endpoint |
| Modify | `src/lib/workflows.ts` | Add meta-ads-evaluation workflow definition |
| Modify | `src/db/schema.ts` | Add userResponse to stepRuns, owner to actionItems |
| Modify | `src/app/workflows/[slug]/workflow-detail.tsx` | Route to evaluation wizard when workflowType is guided-evaluation |

### Phase 2 (Future)

Steps 2-5: Backend Verification, Campaign Structure, Creative Health, Audience Check. These use existing data and add evaluation logic on top.

### Phase 3 (Future)

Weekly evaluation workflow (lighter, 6 checks from the training guide's "Weekly Agency Call Prep" section). Different step set, faster cadence.

## Verification

1. `npm run build` passes
2. Navigate to `/workflows/meta-ads-evaluation`
3. Click "Start Monthly Evaluation" for a recent month
4. Step 1 shows: CPA, ROAS, purchases, prospecting/retargeting split with AI evaluation
5. Click "Agree" on healthy metrics → skips CPA diagnostic → advances to Step 2 placeholder (Phase 1 shows "Coming in Phase 2" for Steps 2-5, jumps to Step 6)
6. On a month with high CPA: diagnostic sub-flow D1-D5 renders with 7-day frequency data, MoM trends, pattern matching
7. Action items editable at each step with owner tags (Agency/Director/Joint)
8. Step 6 shows all accumulated action items, allows final editing
9. Completed evaluation saved to DB, action items saved to action items board
