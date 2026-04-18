// One-time fetcher: pulls 365 days of ad-level insights from Meta for seeding
// the creative-pipeline experiment-log.md.
// Usage:
//   set -a && source .env.local && set +a
//   npx tsx scripts/fetch-meta-365-for-seed.ts > /tmp/meta-365-seed.json

import 'dotenv/config';
import { AdAccount, FacebookAdsApi } from 'facebook-nodejs-business-sdk';

FacebookAdsApi.init(process.env.META_ACCESS_TOKEN!);
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID ?? 'act_1599255740369627';
const account = new AdAccount(AD_ACCOUNT_ID);

interface MetaAction {
  action_type: string;
  value: string;
}

interface SeedRow {
  ad_id: string;
  ad_name: string;
  campaign_id: string | undefined;
  campaign_name: string | undefined;
  adset_id: string | undefined;
  adset_name: string | undefined;
  spend: number;
  ctr: number;
  frequency: number;
  impressions: number;
  clicks: number;
  purchases: number;
  cpa: number | null;
}

async function main() {
  // Fetch all campaigns for ID → name lookup
  const campaignCursor = await (account as unknown as {
    getCampaigns(fields: string[], params: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  }).getCampaigns(['id', 'name'], { limit: 500 });
  const campaignNameById = new Map<string, string>();
  for (const raw of campaignCursor) {
    const data = ((raw as Record<string, unknown>)._data ?? raw) as Record<string, unknown>;
    campaignNameById.set(String(data.id), String(data.name));
  }

  // Fetch all ad sets for ID → name lookup
  const adsetCursor = await (account as unknown as {
    getAdSets(fields: string[], params: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  }).getAdSets(['id', 'name'], { limit: 500 });
  const adsetNameById = new Map<string, string>();
  for (const raw of adsetCursor) {
    const data = ((raw as Record<string, unknown>)._data ?? raw) as Record<string, unknown>;
    adsetNameById.set(String(data.id), String(data.name));
  }

  const adsCursor = await (account as unknown as {
    getAds(fields: string[], params: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  }).getAds(
    ['id', 'name', 'adset_id', 'campaign_id', 'status'],
    { limit: 500 }
  );

  const results: SeedRow[] = [];

  for (const adRaw of adsCursor) {
    const ad = adRaw as Record<string, unknown>;
    const data = (ad._data ?? ad) as Record<string, unknown>;
    const adId = String(data.id);
    const adName = String(data.name);
    const adsetId = data.adset_id ? String(data.adset_id) : undefined;
    const campaignId = data.campaign_id ? String(data.campaign_id) : undefined;

    try {
      const adApi = ad as unknown as {
        getInsights(fields: string[], params: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
      };
      const insights = await adApi.getInsights(
        ['spend', 'actions', 'ctr', 'frequency', 'impressions', 'clicks'],
        { time_range: { since: '2025-04-17', until: '2026-04-17' } }
      );
      if (insights.length === 0) continue;
      const r = insights[0] as Record<string, unknown>;
      const actions = (r.actions as MetaAction[] | undefined) ?? [];
      const purchases = Number(actions.find(a => a.action_type === 'purchase')?.value || 0);
      const spend = Number(r.spend || 0);
      results.push({
        ad_id: adId,
        ad_name: adName,
        campaign_id: campaignId,
        campaign_name: campaignId ? campaignNameById.get(campaignId) : undefined,
        adset_id: adsetId,
        adset_name: adsetId ? adsetNameById.get(adsetId) : undefined,
        spend,
        ctr: Number(r.ctr || 0),
        frequency: Number(r.frequency || 0),
        impressions: Number(r.impressions || 0),
        clicks: Number(r.clicks || 0),
        purchases,
        cpa: purchases > 0 ? spend / purchases : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[warn] failed to fetch insights for ad ${adId}: ${msg}`);
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
