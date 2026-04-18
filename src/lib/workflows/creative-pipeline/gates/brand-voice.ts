import { readFileSync, existsSync } from 'fs';
import type { ParsedBrief, GateResult } from '../types';

export function runBrandVoiceGate(
  briefs: ParsedBrief[],
  bannedPhrases: string[]
): GateResult {
  const failures: string[] = [];
  const lowerBanned = bannedPhrases.map(p => p.toLowerCase());

  for (const brief of briefs) {
    const haystack = `${brief.primaryText} ${brief.headline} ${brief.description ?? ''}`.toLowerCase();
    const hits = lowerBanned.filter(p => haystack.includes(p));
    if (hits.length > 0) {
      failures.push(`${brief.briefId}: contains banned phrases [${hits.map(h => `"${h}"`).join(', ')}]`);
    }
  }
  return { name: 'brand-voice', passed: failures.length === 0, failures };
}

// Parses the `### Never Use` section of sle-brandscript.md into an array of
// banned phrases. For each bullet, takes only quoted strings that appear BEFORE
// the first parenthetical (so "say 'Grab your seat'" alternatives aren't banned).
export function parseBannedPhrases(brandscriptPath: string): string[] {
  if (!existsSync(brandscriptPath)) return [];
  const md = readFileSync(brandscriptPath, 'utf-8');
  const sectionMatch = md.match(/### Never Use\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (!sectionMatch) return [];
  const phrases: string[] = [];
  for (const raw of sectionMatch[1].split('\n')) {
    if (!raw.trim().startsWith('- ')) continue;
    const beforeParen = raw.split('(')[0];
    for (const m of beforeParen.matchAll(/"([^"]+)"/g)) {
      phrases.push(m[1]);
    }
  }
  return phrases;
}
