import type { Brief } from './brief-card';

export function HypothesisTrail({ briefs }: { briefs: Brief[] }) {
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Hypothesis trail</div>
      <ul className="space-y-2 text-sm">
        {briefs.map(b => (
          <li key={b.briefId} className="flex gap-3 items-start">
            <span className="font-mono text-xs text-slate-500 pt-0.5">{b.briefId}</span>
            <span className="text-slate-300 flex-1">
              {b.hypothesis || <span className="italic text-slate-600">no hypothesis recorded</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
