import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';
import { FacebookAdsApi, Ad } from 'facebook-nodejs-business-sdk';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  FacebookAdsApi.init(process.env.META_ACCESS_TOKEN!);

  const activeBriefs = await db
    .select()
    .from(creativeBriefs)
    .where(inArray(creativeBriefs.status, ['accepted', 'live']));

  const results: Array<{ briefId: string; outcome: string }> = [];

  for (const brief of activeBriefs) {
    if (!brief.metaAdId) continue;
    try {
      const ad = new Ad(brief.metaAdId);
      const [insights, details] = await Promise.all([
        ad.getInsights(
          ['spend', 'actions', 'ctr', 'frequency', 'impressions'],
          { date_preset: 'maximum' }
        ),
        ad.read(['effective_status']),
      ]);

      if (insights.length === 0) {
        results.push({ briefId: brief.briefId, outcome: 'no-insights' });
        continue;
      }
      const r = insights[0];
      const purchases = Number(
        (r.actions as Array<{ action_type: string; value: string }> | undefined)?.find(
          a => a.action_type === 'purchase'
        )?.value || 0
      );
      const spend = Number(r.spend || 0);
      const cpa = purchases > 0 ? spend / purchases : null;
      const frequency = Number(r.frequency || 0);
      const ctr = Number(r.ctr || 0);
      const impressions = Number(r.impressions || 0);

      const effStatus = String(details.effective_status || '').toUpperCase();
      const isLive = effStatus === 'ACTIVE';
      const isKilled = effStatus.includes('PAUSED') || effStatus.includes('DISAPPROVED');
      let newStatus: 'live' | 'resolved' | 'killed' | null = null;
      let decision: 'winner' | 'average' | 'killed' | null = null;
      let killReason: string | null = null;

      if (spend >= 200 && cpa !== null) {
        if (cpa < 9) {
          newStatus = 'resolved';
          decision = 'winner';
        } else if (cpa < 14) {
          newStatus = 'resolved';
          decision = 'average';
        } else {
          newStatus = 'killed';
          decision = 'killed';
          killReason = `cpa=${cpa.toFixed(2)} > 14`;
        }
      } else if (isKilled && brief.status !== 'resolved') {
        newStatus = 'killed';
        decision = 'killed';
        killReason = `effective_status=${effStatus}`;
      } else if (isLive && brief.status === 'accepted') {
        newStatus = 'live';
      }

      const updateData: Record<string, unknown> = {
        spend: spend.toString(),
        cpa: cpa?.toString() ?? null,
        ctr: ctr.toString(),
        frequency: frequency.toString(),
        impressions,
        purchases,
        updatedAt: new Date(),
      };
      if (newStatus) {
        updateData.status = newStatus;
        if (newStatus === 'live' && !brief.launchedAt) {
          updateData.launchedAt = new Date();
        }
        if (newStatus === 'resolved' || newStatus === 'killed') {
          updateData.resolvedAt = new Date();
          updateData.decision = decision;
          updateData.killReason = killReason;
        }
      }
      await db.update(creativeBriefs).set(updateData).where(eq(creativeBriefs.briefId, brief.briefId));
      results.push({ briefId: brief.briefId, outcome: newStatus || 'updated' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ briefId: brief.briefId, outcome: `error: ${msg}` });
    }
  }

  return NextResponse.json({ count: results.length, results });
}
