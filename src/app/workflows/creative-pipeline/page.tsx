import { db } from '@/db';
import { creativeBriefs } from '@/db/schema';
import { sql, desc } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CreativePipelineIndex() {
  const cycles = await db
    .select({
      cycleId: creativeBriefs.cycleId,
      briefsTotal: sql<number>`count(*)::int`,
      proposed: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'proposed')::int`,
      pushed: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'pushed')::int`,
      live: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'live')::int`,
      resolved: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'resolved')::int`,
      killed: sql<number>`count(*) filter (where ${creativeBriefs.status} = 'killed')::int`,
    })
    .from(creativeBriefs)
    .groupBy(creativeBriefs.cycleId)
    .orderBy(desc(creativeBriefs.cycleId));

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Creative Pipeline</h1>
        <p className="text-sm text-slate-400 mt-1">
          Autoresearch loop. Agent-generated briefs, manual ship to Meta, automated outcome tracking.
        </p>
      </div>

      <div className="space-y-3">
        {cycles.length === 0 ? (
          <div className="border border-slate-800 rounded-lg p-6 text-center text-slate-500">
            No cycles yet. Run <code className="bg-slate-900 px-2 py-0.5 rounded">./run-cycle.sh</code> in the creative-pipeline repo, then import.
          </div>
        ) : (
          cycles.map(c => (
            <Link
              key={c.cycleId}
              href={`/workflows/creative-pipeline/${c.cycleId}`}
              className="block border border-slate-800 rounded-lg p-4 hover:border-slate-600 transition"
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold">{c.cycleId}</div>
                <div className="text-xs text-slate-500">{c.briefsTotal} briefs</div>
              </div>
              <div className="mt-2 flex gap-3 text-xs text-slate-400">
                <span>proposed: {c.proposed}</span>
                <span>pushed: {c.pushed}</span>
                <span>live: {c.live}</span>
                <span>resolved: {c.resolved}</span>
                <span>killed: {c.killed}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
