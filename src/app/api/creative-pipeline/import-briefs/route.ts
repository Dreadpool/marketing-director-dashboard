import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { parseBriefs } from '@/lib/workflows/creative-pipeline/parse-briefs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { cycleId: string; path?: string };
    const cycleId = body.cycleId;
    if (!cycleId?.match(/^\d{4}-\d{2}$/)) {
      return NextResponse.json({ error: 'invalid cycleId' }, { status: 400 });
    }
    const defaultPath = join(
      process.env.HOME || '/Users/brady',
      'workspace/sle/products/creative-pipeline/briefs',
      `${cycleId}.md`
    );
    const filePath = body.path || defaultPath;
    const markdown = readFileSync(filePath, 'utf-8');
    const briefs = parseBriefs(markdown, cycleId);

    const rows = briefs.map(b => ({
      briefId: b.briefId,
      cycleId: b.cycleId,
      conceptName: b.conceptName,
      angle: b.angle,
      funnelStage: b.funnelStage,
      matrixCell: b.matrixCell,
      layoutArchetype: b.layoutArchetype,
      visualDirection: b.visualDirection,
      primaryText: b.primaryText,
      headline: b.headline,
      description: b.description,
      cta: b.cta,
      linkUrl: b.linkUrl,
      hypothesis: b.hypothesis,
      status: 'proposed' as const,
    }));

    await db
      .insert(creativeBriefs)
      .values(rows)
      .onConflictDoUpdate({
        target: creativeBriefs.briefId,
        set: {
          conceptName: creativeBriefs.conceptName,
          angle: creativeBriefs.angle,
          funnelStage: creativeBriefs.funnelStage,
          matrixCell: creativeBriefs.matrixCell,
          layoutArchetype: creativeBriefs.layoutArchetype,
          visualDirection: creativeBriefs.visualDirection,
          primaryText: creativeBriefs.primaryText,
          headline: creativeBriefs.headline,
          description: creativeBriefs.description,
          cta: creativeBriefs.cta,
          linkUrl: creativeBriefs.linkUrl,
          hypothesis: creativeBriefs.hypothesis,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ inserted: rows.length, cycleId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
