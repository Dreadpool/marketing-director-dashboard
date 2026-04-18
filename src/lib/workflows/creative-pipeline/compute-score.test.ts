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
