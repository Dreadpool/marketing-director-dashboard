// Shared types for the creative pipeline workflow.

export type BriefStatus = 'proposed' | 'pushed' | 'live' | 'resolved' | 'killed';
export type BriefAngle = 'price' | 'convenience' | 'social-proof' | 'vs-driving';
export type BriefFunnelStage = 'prospecting' | 'retargeting' | 'awareness';
export type BriefDecision = 'winner' | 'average' | 'killed';

export type LayoutArchetype =
  | 'post-it'
  | 'screenshot-dm'
  | 'quote-card'
  | 'receipt-tally'
  | 'handwritten-note'
  | 'ticket'
  | 'text-message'
  | 'before-after-split'
  | 'advertorial'
  | 'us-vs-them'
  | 'meme'
  | 'real-world-sign'
  | 'other';

export type CreativeCta = 'BOOK_TRAVEL' | 'SHOP_NOW' | 'LEARN_MORE';

export interface ParsedBrief {
  briefId: string;
  cycleId: string;
  conceptName: string;
  conceptType: string;
  angle: BriefAngle;
  funnelStage: BriefFunnelStage;
  matrixCell: string;
  layoutArchetype: LayoutArchetype;
  visualDirection: string;
  primaryText: string;
  headline: string;
  description: string | null;
  cta: CreativeCta;
  linkUrl: string;
  hypothesis: string | null;
}

export interface GateResult {
  name: string;
  passed: boolean;
  failures: string[];
  details?: Record<string, unknown>;
}

export interface GateReport {
  brandVoice?: GateResult;
  duplicate: GateResult;
  matrixDiversity: GateResult;
  sniffTest?: GateResult;
}

export interface InputsLoaded {
  programMd: { path: string; bytes: number } | null;
  swipeFileMd: { path: string; bytes: number; entries: number } | null;
  resultsLog: { path: string; totalEntries: number; resolvedEntries: number } | null;
  brandVoice: { path: string; bytes: number } | null;
}
