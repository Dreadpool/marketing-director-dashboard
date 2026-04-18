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
