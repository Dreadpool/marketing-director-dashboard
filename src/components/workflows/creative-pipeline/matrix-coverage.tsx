const ANGLES: Array<{ key: string; label: string; desc: string }> = [
  { key: 'price', label: 'price', desc: 'Save money vs. driving (gas, parking, wear)' },
  { key: 'convenience', label: 'convenience', desc: 'WiFi, outlets, nap, work on the way' },
  { key: 'social-proof', label: 'social-proof', desc: 'Testimonials, reviews, influencers, UGC' },
  { key: 'vs-driving', label: 'vs-driving', desc: 'Avoid traffic, stress, 5 AM on I-15' },
];
const STAGES: Array<{ key: string; label: string; desc: string }> = [
  { key: 'prospecting', label: 'prospecting', desc: 'Cold audience, never heard of SLE' },
  { key: 'retargeting', label: 'retargeting', desc: 'Warm — visited site or engaged before' },
  { key: 'awareness', label: 'awareness', desc: 'Brand-building, top of funnel, no direct push' },
];

export function MatrixCoverage({ briefs }: { briefs: { matrixCell: string }[] }) {
  const counts = new Map<string, number>();
  for (const b of briefs) {
    counts.set(b.matrixCell, (counts.get(b.matrixCell) || 0) + 1);
  }

  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs text-slate-500 uppercase">Matrix coverage</div>
        <div className="text-xs text-slate-500">
          Unique cells: {counts.size}/12 (≥10 required)
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-4 leading-relaxed max-w-3xl">
        Every brief sits in one cell — what it promises (angle) × who sees it (stage). Gaps show untested combinations.
        Green = one brief in cell, amber = duplicates (we prefer spread). Hover any label for its definition.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-xs">
        <div className="border border-slate-800/60 rounded p-3 bg-slate-950/40">
          <div className="text-slate-500 uppercase tracking-wide mb-2">Angles (what the ad promises)</div>
          <ul className="space-y-1 text-slate-400">
            {ANGLES.map(a => (
              <li key={a.key}>
                <span className="text-slate-200 font-medium">{a.label}</span>
                <span className="text-slate-500"> — {a.desc}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-800/60 rounded p-3 bg-slate-950/40">
          <div className="text-slate-500 uppercase tracking-wide mb-2">Stages (who sees it)</div>
          <ul className="space-y-1 text-slate-400">
            {STAGES.map(s => (
              <li key={s.key}>
                <span className="text-slate-200 font-medium">{s.label}</span>
                <span className="text-slate-500"> — {s.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div
        className="grid gap-2 text-xs"
        style={{ gridTemplateColumns: 'auto repeat(4, minmax(0, 1fr))' }}
      >
        <div />
        {ANGLES.map(a => (
          <div
            key={a.key}
            className="text-slate-500 text-center pb-1 font-semibold whitespace-nowrap"
            title={a.desc}
          >
            {a.label}
          </div>
        ))}
        {STAGES.map(s => (
          <div key={s.key} className="contents">
            <div
              className="text-slate-500 font-semibold py-2 pr-3 whitespace-nowrap"
              title={s.desc}
            >
              {s.label}
            </div>
            {ANGLES.map(a => {
              const cell = `${a.key}×${s.key}`;
              const count = counts.get(cell) || 0;
              return (
                <div
                  key={cell}
                  className={`p-2 rounded border text-center min-w-0 ${
                    count === 0
                      ? 'border-slate-800 text-slate-700'
                      : count === 1
                      ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300'
                      : 'border-amber-900/40 bg-amber-950/20 text-amber-300'
                  }`}
                  title={count > 1 ? `Duplicate cell: ${a.label}×${s.label}` : `${a.label}×${s.label}`}
                >
                  {count > 0 ? count : '—'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
