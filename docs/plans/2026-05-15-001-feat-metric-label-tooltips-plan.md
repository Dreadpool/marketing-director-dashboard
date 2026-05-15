---
title: "feat: Hover-tooltip definitions for Meta Ads metric abbreviations"
type: feat
status: completed
date: 2026-05-15
---

# feat: Hover-tooltip definitions for Meta Ads metric abbreviations

## Overview

Abbreviations in the Meta Ads dashboard (CVR, CTR, CPA, CPM, ROAS, Frequency, Hook Rate, Hold Rate) do not declare their definition at the point where they appear. Brady asked "what is CVR? click CVR or impression CVR?" — the answer (purchases / clicks, i.e. click CVR) is correct but currently invisible in the UI. Every reader of this dashboard hits the same question.

Fix: build one shared `MetricLabel` React component that renders the abbreviation with a hover tooltip showing its plain-English definition and formula. Wire it into every place a metric abbreviation appears today — column headers and inline row labels in the Meta Ads main visualization, plus the column headers in the CPA-diagnostic substep tables. The same component covers any future surface where these abbreviations appear.

This was already on the roadmap as "Tooltips for hook rate and hold rate". The plan generalizes that line item to all metric abbreviations, since the underlying problem and solution are the same.

---

## Problem Frame

The Meta Ads workflow visualization renders dense tables of campaigns, ad sets, and ads with column headers like `CPA`, `ROAS`, `CTR`, plus inline row decorations like the muted `CVR` text inside the conversion-rate cell. Each abbreviation has a precise formula that determines whether it means what the reader assumes. CVR alone is ambiguous between click conversion rate (purchases / clicks) and impression conversion rate (purchases / impressions); CPA is "true CPA" or "Meta-reported CPA" depending on context; ROAS is revenue-based, not profit-based. Today the formulas live in the heads of whoever built the workflow, in evaluation prompts (`src/lib/workflows/prompts/meta-ads-evaluation.ts`), or in commentary inside KPI card tooltips for two of the abbreviations only. A non-expert reading the dashboard cannot tell whether the number on screen matches their mental model.

The KPI cards in the same file (the `MetricCard` component near the top of `src/components/workflows/meta-ads-fetch-summary.tsx`) already solve this for CPA and ROAS using shadcn `Tooltip` with `cursor-help` and an `Info` icon. The rest of the dashboard inherited none of that scaffolding.

---

## Requirements Trace

- R1. A reader hovering on any metric abbreviation in the Meta Ads dashboard sees the abbreviation expanded, its formula, and a one-sentence interpretation hint (when one exists).
- R2. Definitions live in one place; adding a new abbreviation later means editing one map, not visiting every table.
- R3. Existing KPI-card tooltips for CPA and ROAS (which contain SLE-specific interpretation copy like the 1.3x over-attribution caveat) continue to work and are not duplicated by the new component.
- R4. The dotted-underline or `cursor-help` affordance is visible enough that a reader notices it, but not so heavy that it makes dense tables noisier.
- R5. No behavioral or data-layer changes; this is purely a UI presentation change.

---

## Scope Boundaries

- Out of scope: KPI card definitions (already done via `MetricCard`'s `tooltip` prop).
- Out of scope: the Google Ads workflow visualization (`src/components/workflows/google-ads-fetch-summary.tsx`) — same problem class, but Brady asked specifically about Meta. Reusing the new component there is a one-line lift, but doing the wiring belongs in a follow-up.
- Out of scope: the promo-code workflow visualization (`src/components/workflows/promo-code-fetch-summary.tsx`) — same reasoning.
- Out of scope: a separate glossary or defined-terms surface anywhere on the page. We considered it; tooltips at point of confusion beat a lookup table for the reasons given in the conversation that led to this plan.
- Out of scope: building a `Popover`-based "?" icon next to section headings for skim-readers. Possible follow-up if the inline tooltip approach proves insufficient.

---

## Context & Research

### Relevant Code and Patterns

- `src/components/workflows/meta-ads-fetch-summary.tsx` — single ~1000-line file holding every Meta Ads UI surface: the headline KPI cards (`MetricCard`), the campaign/ad-set/ad hierarchy table with columns Spend / CPA / ROAS / Frequency / Purchases / CTR / Hook Rate / Hold Rate, the inline CVR/CTR labels inside ad-row cells (lines 780 and 794), and a separate "Highest CPA Ads" table.
- `src/components/workflows/steps/cpa-diagnostic.tsx` — D1 through D5 substep tables shown inside the guided evaluation flow. Each substep table has its own headers: Frequency (D1), CPM current/prior (D2), CTR current/prior (D3), CVR (D4), and a summary stack with labels like "7-Day Frequency", "CPM Change", "CTR Change", "Prospecting CPA", "Retargeting CPA" (D5).
- `src/components/ui/tooltip.tsx` — shadcn Tooltip wrapper around `@base-ui/react/tooltip`. Already in the project, used by `MetricCard`.
- `MetricCard` in `meta-ads-fetch-summary.tsx` (around lines 109–131) — established pattern. Renders a label with `cursor-help`, optional `Info` icon, and a `TooltipContent` body. The new `MetricLabel` component is the same pattern adapted for inline use in tables (smaller, no icon by default, accepts an abbreviation name and looks up the definition).

### Institutional Learnings

- The marketing-director-dashboard `CLAUDE.md` "Up Next" list already includes `Meta Ads Dashboard: Tooltips for hook rate and hold rate. Hook rate = 3-second video views / impressions. Hold rate = thruplay / 3-second views.` This plan supersedes that line item by generalizing to all abbreviations. Update the roadmap when the work lands.
- No relevant `docs/solutions/` entry exists; this is straightforward UI work.

### External References

- None needed. The shadcn `Tooltip` API is already in use locally; no new library or version-specific guidance applies.

---

## Key Technical Decisions

- **One central definition map, one component.** Definitions live in a single exported `METRIC_DEFINITIONS` object in the new `metric-label.tsx` file. The `MetricLabel` component takes a `name` prop, looks up the entry, and renders the abbreviation plus a tooltip. Rationale: matches R2 (single source of truth) and makes it impossible for two surfaces to disagree about what CVR means.
- **`name` is a TypeScript string-literal union, not a free string.** That way the type checker catches misspellings at compile time and the editor offers autocomplete for the available abbreviations.
- **Render as inline `<span>` with `cursor-help` and a subtle dotted underline.** Inline (not block) keeps it usable inside table cells, table headers, and prose. Dotted underline plus cursor change is the well-established affordance for "hover for a definition" — strong enough to discover, quiet enough not to add visual noise to a dense table. Rationale: R4.
- **Keep `MetricCard`'s existing tooltip prop intact.** The new component is for inline label use; KPI cards keep their richer per-instance tooltip text (which mixes definition with SLE-specific interpretation like the 1.3x over-attribution caveat). Rationale: R3 — avoid duplicating or contradicting copy that already exists.
- **Definitions contain three fields: `full` (expanded name), `formula` (the math), and optional `note` (interpretation hint when one applies).** Rendered inside the tooltip on separate lines. Plain prose, no jargon. Rationale: matches the prompt that triggered this work — Brady wanted to know not just "CVR" but specifically "click or impression?", which is answered by the formula line.
- **Single shared `TooltipProvider` at a high level in the component tree, not one per `MetricLabel` instance.** `MetricCard` currently wraps each instance in its own provider; that works but wastes nodes. For this round, mirror the existing per-instance pattern to avoid changing global structure — revisit if hover delay or perf becomes an issue.

---

## Open Questions

### Resolved During Planning

- "Inline tooltips or a separate glossary section?" — Resolved as inline tooltips. Reasons captured in the chat thread that produced this plan: tooltips answer at point of confusion, generalize to other abbreviations covered by the same Up Next roadmap item, and don't require the reader to know a glossary exists.
- "Should `MetricCard` adopt the new component too?" — No. The KPI cards have richer per-instance tooltip copy that mixes definition with SLE-specific interpretation; replacing those tooltips with the bare definition would lose information. Keep them as-is.
- "Should the new component be in `src/components/ui/` (shadcn-style primitive) or `src/components/workflows/` (domain-aware)?" — Place in `src/components/workflows/` because the definitions are domain-specific (Meta Ads metric vocabulary, with formulas like "hook rate = 3-second views / impressions" that are Meta-API-specific). `src/components/ui/` is reserved for generic shadcn primitives.

### Deferred to Implementation

- Whether to add a `side` prop override for the rare table-edge case where the default top-aligned tooltip overflows the viewport. Probably the shadcn primitive's auto-positioning handles this; verify during U2/U3 and add only if needed.

---

## Implementation Units

- U1. **Build the shared `MetricLabel` component and metric-definitions map**

**Goal:** Create one reusable React component that renders a metric abbreviation with a hover tooltip showing its definition, formula, and optional interpretation note. Definitions live in one exported map keyed by abbreviation name.

**Requirements:** R1, R2, R4

**Dependencies:** None

**Files:**
- Create: `src/components/workflows/metric-label.tsx`
- Test: `src/components/workflows/__tests__/metric-label.test.tsx` (component-level test using whichever test runner the project already uses — verify during implementation by checking `package.json`)

**Approach:**
- Export a `METRIC_DEFINITIONS` constant: a `Record<MetricName, { full: string; formula: string; note?: string }>`.
- Initial entries cover: `CVR`, `CTR`, `CPA`, `CPM`, `ROAS`, `Frequency`, `HookRate`, `HoldRate`. Use the formulas already implicit in the codebase — for example CVR is `purchases / clicks` (per `meta-ads-fetch-summary.tsx:780`), CTR is `clicks / impressions`, Hook Rate is `3-second video views / impressions`, Hold Rate is `thruplay / 3-second views` (per the CLAUDE.md roadmap entry).
- Export a `MetricName` string-literal union derived from the keys of the map.
- Export the `MetricLabel` component. Props: `name: MetricName`, optional `className?: string` (so callers can keep their existing `text-[10px] text-muted-foreground/40` muted styling on inline ad-row labels, but use full table-header styling on column headers).
- Render: `<TooltipProvider>` → `<Tooltip>` → `<TooltipTrigger asChild>` wrapping a `<span>` with `cursor-help` and dotted underline (`underline decoration-dotted decoration-muted-foreground/40 underline-offset-2`), containing the abbreviation text → `<TooltipContent>` with three stacked text lines: full name (slightly emphasized), formula (mono font), and note (muted) when present.
- The trigger span passes through `className` so callers control color/size while the underline-and-cursor affordance stays consistent.

**Patterns to follow:**
- `MetricCard` in `src/components/workflows/meta-ads-fetch-summary.tsx` (lines around 109–131) — same Tooltip/TooltipTrigger/TooltipContent composition, same `cursor-help` affordance, same `max-w-xs` content sizing.

**Test scenarios:**
- Happy path: renders the abbreviation text from the `name` prop (e.g. `name="CVR"` renders `CVR`).
- Happy path: applies the optional `className` to the trigger span without losing the dotted-underline classes.
- Happy path: on hover, the tooltip surfaces the full name, the formula string, and (when present) the note string from `METRIC_DEFINITIONS`. Asserting hover state in jsdom usually requires testing-library `userEvent.hover` or checking the rendered DOM after triggering — pick whichever the project's existing component tests already use.
- Edge case: a `name` value missing from the map is caught by the TypeScript compiler. Add a `@ts-expect-error` test case to assert the union type enforcement.
- Edge case: definitions with no `note` field render the tooltip body with only full name and formula, no third line and no extra whitespace.

**Verification:**
- TypeScript build passes (`npm run build`).
- Component test passes.
- A manual smoke render in Storybook (if the project has one — verify) or in a scratch route shows the dotted underline, the cursor change on hover, and the tooltip content for each `MetricName` value.

---

- U2. **Wire `MetricLabel` into the Meta Ads main visualization**

**Goal:** Replace every metric-abbreviation occurrence in `meta-ads-fetch-summary.tsx` with the new `MetricLabel` component so hovering any of them surfaces the definition.

**Requirements:** R1, R3, R5

**Dependencies:** U1

**Files:**
- Modify: `src/components/workflows/meta-ads-fetch-summary.tsx`

**Approach:**
- Identify every abbreviation occurrence and decide whether it's a label site (gets replaced) or a value site (left alone). Today's occurrences worth replacing:
  - Campaign hierarchy table column headers `CPA` and `ROAS` near lines 573–574, plus the header rows for the per-ad-set and per-ad nested tables.
  - The inline muted `CVR` label inside the ad-row conversion-rate cell at line 780 — replace the static `<span className="text-[10px] text-muted-foreground/40">CVR </span>` with `<MetricLabel name="CVR" className="text-[10px] text-muted-foreground/40 mr-1" />` (or whatever spacing matches today's render).
  - The inline muted `CTR` label at line 794 — same replacement pattern, `name="CTR"`.
  - The "Highest CPA Ads" table column headers around lines 943–944 (`CPA`, `ROAS`) and 967–970 (hook rate, hold rate) — replace the static `<th>` text with `<th>` containing the `MetricLabel`.
  - Any frequency cells where the column header says `Frequency` (around line 860 and the secondary table) — replace header text.
- Preserve all existing color/threshold classes on value cells (e.g., the `text-red-400` flagging on frequency > 3 or hook rate < 0.25). The new component only changes the label, not the numeric cell.
- Do not touch the `MetricCard` KPI tooltips for CPA and ROAS — those keep their existing richer prose.

**Patterns to follow:**
- The existing static label rendering pattern around lines 780 and 794 — same DOM position, same styling, just swap the inner `<span>` for `<MetricLabel>`.

**Test scenarios:**
- Test expectation: none — pure UI label substitution with no behavior change. Manual browser verification covers it.

**Verification:**
- `npm run build` passes.
- Load `/workflows/meta-ads-analysis` in the dev server after a fresh run completes. Hover each table column header (CPA, ROAS, CTR, Frequency, Hook Rate, Hold Rate) and each inline ad-row label (CVR, CTR) — tooltip surfaces the matching definition every time.
- KPI card tooltips for CPA and ROAS still render their existing SLE-specific text unchanged.

---

- U3. **Wire `MetricLabel` into the CPA-diagnostic substep tables**

**Goal:** Same substitution as U2, but for the diagnostic substep tables (D1 frequency, D2 CPM trend, D3 CTR trend, D4 conversion rate, D5 summary stack) used inside the guided evaluation.

**Requirements:** R1, R5

**Dependencies:** U1

**Files:**
- Modify: `src/components/workflows/steps/cpa-diagnostic.tsx`

**Approach:**
- D2 column headers `Current CPM` and `Prior CPM` (lines 119–120) — replace just the `CPM` portion with `<MetricLabel name="CPM" />`, leaving the `Current` / `Prior` qualifier as plain text.
- D3 column headers `Current CTR` and `Prior CTR` (lines 199–200) — same treatment with `name="CTR"`.
- D4 column header `CVR` (line 308) — direct replacement.
- D5 summary stack labels — `7-Day Frequency` (line 367), `CPM Change` (line 373), `CTR Change` (line 382), `Prospecting CPA` (line 397), `Retargeting CPA` (line 403). Replace just the abbreviation portion of each label so the qualifier ("7-Day", "Change", "Prospecting", "Retargeting") stays plain prose.
- D1 has a `frequency` column with no abbreviation in its header text, but the substep itself is named "Frequency Check" in the surrounding heading near line 15. Wrap that heading's `Frequency` word in `<MetricLabel name="Frequency" />` so the diagnostic explains itself.

**Patterns to follow:**
- Same swap pattern used in U2.

**Test scenarios:**
- Test expectation: none — pure UI label substitution with no behavior change. Manual browser verification covers it.

**Verification:**
- `npm run build` passes.
- Run the Meta Ads guided evaluation through the CPA-diagnostic substep in the dev server. Hover each abbreviated column header and each summary-stack label — tooltip surfaces the matching definition.

---

## System-Wide Impact

- **Interaction graph:** No callbacks, middleware, or workflow-engine touchpoints. Pure presentation layer.
- **Error propagation:** None; tooltips are read-only UI.
- **State lifecycle risks:** None; component is stateless beyond the shadcn Tooltip's internal hover state.
- **API surface parity:** Two adjacent surfaces — `google-ads-fetch-summary.tsx` and `promo-code-fetch-summary.tsx` — have the same class of abbreviated metrics (CPA, CTR, ROAS, etc.) and would benefit from the same component. Deferred to follow-up by scope; the new component is built to support them when that work happens.
- **Integration coverage:** None required; this is a UI substitution.
- **Unchanged invariants:** All numeric rendering, threshold-color logic, trend arrows, and KPI card tooltip text remain identical. The dashboard renders the same numbers; only the labels next to them gain hover affordance.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Dotted-underline affordance feels visually noisy in dense tables | Class is opt-in via `className`; if the result is too heavy in browser verification, fall back to plain `cursor-help` without underline. Decide at U2's manual verification step. |
| `MetricLabel` definitions drift from the actual formula in code (e.g., someone changes the executor to compute CVR as `purchases / impressions` but forgets the map) | Add a brief comment in `metric-label.tsx` next to each definition pointing to where the formula is computed in code. Acknowledged as a manual discipline, not enforced by tests. |
| Inline `MetricLabel` inside a `<th>` breaks table-header alignment because the underline adds vertical space | Verify during U2 manual browser pass; if it shifts header baseline, switch the underline to a `border-b border-dotted` on the span only, which doesn't alter line-box height. |

---

## Documentation / Operational Notes

- Update the `## Roadmap` section in `src/products/marketing-director-dashboard/CLAUDE.md` (i.e. the project CLAUDE.md): move `Tooltips for hook rate and hold rate` from "Up Next" to "Completed" with today's date, noting the broader scope (all metric abbreviations via shared `MetricLabel`).

---

## Sources & References

- Conversation that triggered this plan: Brady asked "what is CVR? is it impression cvr or click cvr?" then "where should we make that obvious in the ui? inline or in defined terms somewhere?"
- Related code:
  - `src/components/workflows/meta-ads-fetch-summary.tsx` — the file where CVR currently appears unlabeled in ad rows
  - `src/components/workflows/steps/cpa-diagnostic.tsx` — diagnostic substep tables that also use abbreviations
  - `src/components/ui/tooltip.tsx` — shadcn Tooltip primitive already installed
  - `src/lib/workflows/prompts/meta-ads-evaluation.ts:113` — current authoritative statement that CVR means `purchases / clicks`, captured in the definition map
- Project CLAUDE.md "Up Next" line item that this plan generalizes: `Meta Ads Dashboard: Tooltips for hook rate and hold rate`
