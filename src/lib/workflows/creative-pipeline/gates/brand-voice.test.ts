import { describe, it, expect } from 'vitest';
import { runBrandVoiceGate } from './brand-voice';

describe('runBrandVoiceGate', () => {
  it('passes clean briefs', () => {
    const briefs = [
      {
        briefId: '2026-05-c01',
        primaryText: '$35 Boise → SLC Sunday. No gas, no parking.',
        headline: 'Sunday Return $35',
      },
    ] as any;
    const banned = ['discover', 'experience', 'journey'];
    const result = runBrandVoiceGate(briefs, banned);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails briefs containing banned words', () => {
    const briefs = [
      {
        briefId: '2026-05-c01',
        primaryText: 'Discover the joy of bus travel.',
        headline: 'Experience Comfort',
      },
      {
        briefId: '2026-05-c02',
        primaryText: 'Clean copy',
        headline: 'Clean headline',
      },
    ] as any;
    const banned = ['discover', 'experience'];
    const result = runBrandVoiceGate(briefs, banned);
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('2026-05-c01');
  });

  it('is case-insensitive', () => {
    const briefs = [
      { briefId: '2026-05-c01', primaryText: 'DISCOVER this!', headline: 'x' },
    ] as any;
    const result = runBrandVoiceGate(briefs, ['discover']);
    expect(result.passed).toBe(false);
  });
});
