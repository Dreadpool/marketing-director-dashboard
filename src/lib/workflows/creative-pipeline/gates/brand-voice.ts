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
