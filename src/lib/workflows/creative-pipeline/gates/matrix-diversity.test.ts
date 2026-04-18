import { describe, it, expect } from 'vitest';
import { runMatrixDiversityGate } from './matrix-diversity';

describe('runMatrixDiversityGate', () => {
  it('passes with 12 unique matrix cells', () => {
    const briefs = Array.from({ length: 12 }, (_, i) => ({
      briefId: `2026-05-c${String(i + 1).padStart(2, '0')}`,
      matrixCell: `cell-${i}`,
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
      { briefId: '2026-05-c11', matrixCell: 'cell-0' },
      { briefId: '2026-05-c12', matrixCell: 'cell-1' },
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
