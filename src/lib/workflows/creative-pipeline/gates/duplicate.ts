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
