import type { BriefFunnelStage } from './types';

interface StageMapping {
  adSetId: string;
  campaignName: string;
}

export const FUNNEL_STAGE_MAP: Record<BriefFunnelStage, StageMapping> = {
  prospecting: {
    adSetId: 'REPLACE_WITH_TOF_ADSET_ID',
    campaignName: 'TOF - Salt Lake City',
  },
  retargeting: {
    adSetId: 'REPLACE_WITH_MOF_RETARGETING_ADSET_ID',
    campaignName: 'Middle (A) Retargeting',
  },
  awareness: {
    adSetId: 'REPLACE_WITH_AWARENESS_ADSET_ID',
    campaignName: 'Creative Testing - Incremental',
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
