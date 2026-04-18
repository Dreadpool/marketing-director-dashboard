import type { Brief } from './brief-card';

export function PushOutcomePanel({ briefs }: { briefs: Brief[] }) {
  const counts = {
    proposed: briefs.filter(b => b.status === 'proposed').length,
    pushed: briefs.filter(b => b.status === 'pushed').length,
    live: briefs.filter(b => b.status === 'live').length,
    resolved: briefs.filter(b => b.status === 'resolved').length,
    killed: briefs.filter(b => b.status === 'killed').length,
  };
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Push &amp; outcome</div>
      <div className="grid grid-cols-5 gap-2 text-center text-xs">
        <StatusPill label="proposed" count={counts.proposed} color="slate" />
        <StatusPill label="pushed" count={counts.pushed} color="blue" />
        <StatusPill label="live" count={counts.live} color="emerald" />
        <StatusPill label="resolved" count={counts.resolved} color="violet" />
        <StatusPill label="killed" count={counts.killed} color="red" />
      </div>
    </div>
  );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-800 text-slate-400',
    blue: 'bg-blue-900/40 text-blue-300',
    emerald: 'bg-emerald-900/40 text-emerald-300',
    violet: 'bg-violet-900/40 text-violet-300',
    red: 'bg-red-900/40 text-red-300',
  };
  return (
    <div className={`rounded-md p-3 ${colors[color]}`}>
      <div className="text-xl font-bold">{count}</div>
      <div className="text-[10px] uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
