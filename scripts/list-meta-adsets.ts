// Lists Meta ad sets with id, name, campaign, status.
// Usage: set -a && source .env.local && set +a && npx tsx scripts/list-meta-adsets.ts

import 'dotenv/config';
import { AdAccount, FacebookAdsApi } from 'facebook-nodejs-business-sdk';

FacebookAdsApi.init(process.env.META_ACCESS_TOKEN!);
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID ?? 'act_1599255740369627';
const account = new AdAccount(AD_ACCOUNT_ID);

async function main() {
  const campaignCursor = await (account as unknown as {
    getCampaigns(fields: string[], params: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  }).getCampaigns(['id', 'name', 'status'], { limit: 500 });
  const campaignById = new Map<string, { name: string; status: string }>();
  for (const raw of campaignCursor) {
    const data = ((raw as Record<string, unknown>)._data ?? raw) as Record<string, unknown>;
    campaignById.set(String(data.id), {
      name: String(data.name),
      status: String(data.status),
    });
  }

  const adsetCursor = await (account as unknown as {
    getAdSets(fields: string[], params: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  }).getAdSets(['id', 'name', 'campaign_id', 'status', 'effective_status'], { limit: 500 });

  for (const raw of adsetCursor) {
    const d = ((raw as Record<string, unknown>)._data ?? raw) as Record<string, unknown>;
    const campaignId = String(d.campaign_id);
    const c = campaignById.get(campaignId);
    console.log(
      [
        String(d.id),
        String(d.effective_status || d.status),
        String(d.name),
        c ? `${c.status} | ${c.name}` : '(unknown campaign)',
      ].join('\t')
    );
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
