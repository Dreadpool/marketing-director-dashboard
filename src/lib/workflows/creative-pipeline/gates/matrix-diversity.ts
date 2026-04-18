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
