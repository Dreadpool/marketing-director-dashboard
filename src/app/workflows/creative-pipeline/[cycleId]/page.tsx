import { headers } from 'next/headers';
import { BriefCard, type Brief } from '@/components/workflows/creative-pipeline/brief-card';
import { MatrixCoverage } from '@/components/workflows/creative-pipeline/matrix-coverage';
import { GateStatus } from '@/components/workflows/creative-pipeline/gate-status';
import { HypothesisTrail } from '@/components/workflows/creative-pipeline/hypothesis-trail';
import { InputsLoadedPanel } from '@/components/workflows/creative-pipeline/inputs-loaded';
import { PushOutcomePanel } from '@/components/workflows/creative-pipeline/push-outcome';
import { MetricHistory } from '@/components/workflows/creative-pipeline/metric-history';
import type { GateReport, InputsLoaded } from '@/lib/workflows/creative-pipeline/types';

export const dynamic = 'force-dynamic';

async function loadCycle(cycleId: string): Promise<{
  briefs: Brief[];
  gates: GateReport;
  inputs: InputsLoaded | null;
} | null> {
  const h = await headers();
  const host = h.get('host');
  const proto = host?.startsWith('localhost') ? 'http' : 'https';
  const res = await fetch(`${proto}://${host}/api/creative-pipeline/cycle/${cycleId}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function CyclePage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const data = await loadCycle(cycleId);
  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 text-slate-400">
        Cycle {cycleId} not found.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Cycle {cycleId}</h1>
        <p className="text-sm text-slate-400 mt-1">{data.briefs.length} briefs</p>
      </div>

      <div className="mb-4">
        <MatrixCoverage briefs={data.briefs} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <InputsLoadedPanel inputs={data.inputs} />
        <GateStatus gates={data.gates} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <PushOutcomePanel briefs={data.briefs} />
        <MetricHistory />
      </div>

      <HypothesisTrail briefs={data.briefs} />

      <div className="mt-8 space-y-2">
        {data.briefs.map(b => (
          <BriefCard key={b.briefId} brief={b} />
        ))}
      </div>
    </div>
  );
}
