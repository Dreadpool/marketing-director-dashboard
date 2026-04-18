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
