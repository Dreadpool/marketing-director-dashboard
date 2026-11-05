import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs, creativePipelineRuns } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { runDuplicateGate } from '@/lib/workflows/creative-pipeline/gates/duplicate';
import { runMatrixDiversityGate } from '@/lib/workflows/creative-pipeline/gates/matrix-diversity';
import type { InputsLoaded } from '@/lib/workflows/creative-pipeline/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
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

    const gates: Record<string, unknown> = {
      duplicate: runDuplicateGate(briefs, priorNames),
      matrixDiversity: runMatrixDiversityGate(briefs),
    };

    const latestRun = await db
      .select()
      .from(creativePipelineRuns)
      .where(eq(creativePipelineRuns.cycleId, cycleId))
      .orderBy(desc(creativePipelineRuns.startedAt))
      .limit(1);
    const inputs = (latestRun[0]?.inputsLoaded as InputsLoaded | null) ?? null;

    return NextResponse.json({ cycleId, briefs, gates, inputs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
