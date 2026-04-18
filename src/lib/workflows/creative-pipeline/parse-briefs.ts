import type {
  ParsedBrief,
  BriefAngle,
  BriefFunnelStage,
  LayoutArchetype,
  CreativeCta,
} from './types';

const BRIEF_ID_RE = /^##\s+(\d{4}-\d{2}-c\d{2})\s+—\s+(.+?)$/;
const BAD_HEADER_RE = /^##\s+(.+?)\s+—\s+(.+?)$/;
const FIELD_RE = /^-\s+([a-z_]+):\s*(.+)$/;

const ANGLES: BriefAngle[] = ['price', 'convenience', 'social-proof', 'vs-driving'];
const STAGES: BriefFunnelStage[] = ['prospecting', 'retargeting', 'awareness'];
const ARCHETYPES: LayoutArchetype[] = [
  'post-it',
  'screenshot-dm',
  'quote-card',
  'receipt-tally',
  'handwritten-note',
  'ticket',
  'text-message',
  'before-after-split',
  'advertorial',
  'us-vs-them',
  'meme',
  'real-world-sign',
  'other',
];
const CTAS: CreativeCta[] = ['BOOK_TRAVEL', 'SHOP_NOW', 'LEARN_MORE'];

export function parseBriefs(markdown: string, cycleId: string): ParsedBrief[] {
  const lines = markdown.split('\n');
  const briefs: ParsedBrief[] = [];
  let current: Partial<ParsedBrief> | null = null;

  for (const line of lines) {
    const headerMatch = line.match(BRIEF_ID_RE);
    if (headerMatch) {
      if (current) briefs.push(finalizeBrief(current, cycleId));
      current = {
        briefId: headerMatch[1],
        cycleId,
        conceptName: headerMatch[2].trim(),
      };
      continue;
    }
    const badHeader = line.match(BAD_HEADER_RE);
    if (badHeader && !headerMatch) {
      throw new Error(`Invalid brief_id format in header: "${line.trim()}"`);
    }
    if (!current) continue;
    const fieldMatch = line.match(FIELD_RE);
    if (!fieldMatch) continue;
    const [, key, raw] = fieldMatch;
    const value = raw.trim();
    switch (key) {
      case 'concept_type':
        current.conceptType = value;
        break;
      case 'angle':
        if (!ANGLES.includes(value as BriefAngle)) {
          throw new Error(`Invalid angle "${value}" in ${current.briefId}`);
        }
        current.angle = value as BriefAngle;
        break;
      case 'funnel_stage':
        if (!STAGES.includes(value as BriefFunnelStage)) {
          throw new Error(`Invalid funnel_stage "${value}" in ${current.briefId}`);
        }
        current.funnelStage = value as BriefFunnelStage;
        break;
      case 'matrix_cell':
        current.matrixCell = value;
        break;
      case 'layout_archetype':
        if (!ARCHETYPES.includes(value as LayoutArchetype)) {
          throw new Error(`Invalid layout_archetype "${value}" in ${current.briefId}`);
        }
        current.layoutArchetype = value as LayoutArchetype;
        break;
      case 'visual_direction':
        current.visualDirection = value;
        break;
      case 'primary_text':
        current.primaryText = value;
        break;
      case 'headline':
        current.headline = value;
        break;
      case 'description':
        current.description = value;
        break;
      case 'cta':
        if (!CTAS.includes(value as CreativeCta)) {
          throw new Error(`Invalid cta "${value}" in ${current.briefId}`);
        }
        current.cta = value as CreativeCta;
        break;
      case 'link_url':
        current.linkUrl = value;
        break;
      case 'hypothesis':
        current.hypothesis = value;
        break;
    }
  }
  if (current) briefs.push(finalizeBrief(current, cycleId));
  return briefs;
}

function finalizeBrief(partial: Partial<ParsedBrief>, cycleId: string): ParsedBrief {
  const required = [
    'briefId',
    'conceptName',
    'angle',
    'funnelStage',
    'matrixCell',
    'layoutArchetype',
    'visualDirection',
    'primaryText',
    'headline',
    'cta',
    'linkUrl',
  ] as const;
  for (const k of required) {
    if (!partial[k]) {
      throw new Error(`Brief ${partial.briefId} missing required field ${k}`);
    }
  }
  if (!partial.briefId?.match(/^\d{4}-\d{2}-c\d{2}$/)) {
    throw new Error(`Invalid brief_id format: ${partial.briefId}`);
  }
  return {
    cycleId,
    description: null,
    hypothesis: null,
    conceptType: 'new',
    ...partial,
  } as ParsedBrief;
}
