import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';
import { getAdSetIdForStage } from '@/lib/workflows/creative-pipeline/meta-adset-map';
import type { BriefFunnelStage } from '@/lib/workflows/creative-pipeline/types';

export const dynamic = 'force-dynamic';

const SLE_PAGE_ID = process.env.META_SLE_PAGE_ID!;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ briefId: string }> }
) {
  try {
    const { briefId } = await params;

    const rows = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.briefId, briefId))
      .limit(1);
    const brief = rows[0];
    if (!brief) {
      return NextResponse.json({ error: 'brief not found' }, { status: 404 });
    }
    if (brief.status !== 'proposed') {
      return NextResponse.json(
        { error: `brief already ${brief.status}` },
        { status: 400 }
      );
    }

    FacebookAdsApi.init(process.env.META_ACCESS_TOKEN!);
    const account = new AdAccount(process.env.META_AD_ACCOUNT_ID!);

    const creativeName = `${brief.briefId} · ${brief.conceptName}`;
    const creative = await account.createAdCreative([], {
      name: creativeName,
      object_story_spec: {
        page_id: SLE_PAGE_ID,
        link_data: {
          message: brief.primaryText,
          link: brief.linkUrl,
          name: brief.headline,
          description: brief.description ?? undefined,
          call_to_action: { type: brief.cta },
        },
      },
    });

    const ad = await account.createAd([], {
      name: creativeName,
      adset_id: getAdSetIdForStage(brief.funnelStage as BriefFunnelStage),
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    });

    await db
      .update(creativeBriefs)
      .set({
        status: 'pushed',
        metaAdId: ad.id,
        pushedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creativeBriefs.briefId, briefId));

    return NextResponse.json({
      briefId,
      metaAdId: ad.id,
      adsManagerUrl: `https://business.facebook.com/adsmanager/manage/ads/edit?ad_id=${ad.id}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
