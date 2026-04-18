import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { runBrandVoiceGate } from '@/lib/workflows/creative-pipeline/gates/brand-voice';
import { runDuplicateGate } from '@/lib/workflows/creative-pipeline/gates/duplicate';
import { runMatrixDiversityGate } from '@/lib/workflows/creative-pipeline/gates/matrix-diversity';

export const dynamic = 'force-dynamic';

const BANNED_WORDS = ['discover', 'experience', 'journey', 'elevate', 'unlock', 'unleash'];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  try {
    const { cycleId } = await params;
    const briefs = await db
      .select()
      .from(creativeBriefs)
      .where(eq(creativeBriefs.cycleId, cycleId))
      .orderBy(creativeBriefs.briefId);

    if (briefs.length === 0) {
      return NextResponse.json({ error: 'no briefs for cycle' }, { status: 404 });
    }

    const priorRows = await db
      .select({ conceptName: creativeBriefs.conceptName })
      .from(creativeBriefs)
      .where(sql`${creativeBriefs.cycleId} < ${cycleId}`);
    const priorNames = priorRows.map(r => r.conceptName);

    const gates = {
      brandVoice: runBrandVoiceGate(briefs as any, BANNED_WORDS),
      duplicate: runDuplicateGate(briefs as any, priorNames),
      matrixDiversity: runMatrixDiversityGate(briefs as any),
    };

    return NextResponse.json({ cycleId, briefs, gates });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
