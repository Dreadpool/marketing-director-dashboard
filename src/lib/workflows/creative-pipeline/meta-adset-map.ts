import type { BriefFunnelStage } from './types';

interface StageMapping {
  adSetId: string;
  campaignName: string;
}

export const FUNNEL_STAGE_MAP: Record<BriefFunnelStage, StageMapping> = {
  prospecting: {
    adSetId: '120235253687880492',
    campaignName: 'TOF | Salt Lake City (Rexburg)',
  },
  retargeting: {
    adSetId: '120230146405980492',
    campaignName: 'Middle (A) RETARGETING (All Shuttle Fares)',
  },
  awareness: {
    adSetId: '120247360511970492',
    campaignName: 'Creative Testing | Incremental (Video Testing | Top Areas)',
  },
};

export function getAdSetIdForStage(stage: BriefFunnelStage): string {
  const mapping = FUNNEL_STAGE_MAP[stage];
  if (!mapping) {
    throw new Error(`No ad set mapping for funnel stage: ${stage}`);
  }
  if (mapping.adSetId.startsWith('REPLACE_WITH')) {
    throw new Error(`Ad set ID not configured for ${stage}. See meta-adset-map.ts.`);
  }
  return mapping.adSetId;
}
