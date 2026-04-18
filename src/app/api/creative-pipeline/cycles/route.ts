import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { computeCycleScore } from '@/lib/workflows/creative-pipeline/compute-score';

export const dynamic = 'force-dynamic';

export async function GET() {
  const allBriefs = await db.select().from(creativeBriefs);
  const byCycle = new Map<string, typeof allBriefs>();
  for (const b of allBriefs) {
    if (!byCycle.has(b.cycleId)) byCycle.set(b.cycleId, []);
    byCycle.get(b.cycleId)!.push(b);
  }
  const cycles = Array.from(byCycle.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([cycleId, rows]) => ({
      cycleId,
      briefsTotal: rows.length,
      metrics: computeCycleScore(rows as any),
    }));
  return NextResponse.json({ cycles });
}
