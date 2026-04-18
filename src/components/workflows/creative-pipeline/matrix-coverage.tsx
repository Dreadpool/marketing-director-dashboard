const ANGLES: Array<{ key: string; label: string; full: string }> = [
  { key: 'price', label: 'price', full: 'price' },
  { key: 'convenience', label: 'convenience', full: 'convenience' },
  { key: 'social-proof', label: 'social-proof', full: 'social-proof' },
  { key: 'vs-driving', label: 'vs-driving', full: 'vs-driving' },
];
const STAGES: Array<{ key: string; label: string }> = [
  { key: 'prospecting', label: 'prospecting' },
  { key: 'retargeting', label: 'retargeting' },
  { key: 'awareness', label: 'awareness' },
];

export function MatrixCoverage({ briefs }: { briefs: { matrixCell: string }[] }) {
  const counts = new Map<string, number>();
  for (const b of briefs) {
    counts.set(b.matrixCell, (counts.get(b.matrixCell) || 0) + 1);
  }

  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Matrix coverage</div>
      <div
        className="grid gap-2 text-xs"
        style={{ gridTemplateColumns: 'auto repeat(4, minmax(0, 1fr))' }}
      >
        <div />
        {ANGLES.map(a => (
          <div
            key={a.key}
            className="text-slate-500 text-center pb-1 font-semibold whitespace-nowrap"
            title={a.full}
          >
            {a.label}
          </div>
        ))}
        {STAGES.map(s => (
          <div key={s.key} className="contents">
            <div className="text-slate-500 font-semibold py-2 pr-3 whitespace-nowrap">
              {s.label}
            </div>
            {ANGLES.map(a => {
              const cell = `${a.full}×${s.key}`;
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
                  title={count > 1 ? `Duplicate cell: ${a.full}×${s.key}` : `${a.full}×${s.key}`}
                >
                  {count > 0 ? count : '—'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500 mt-3">
        Unique cells: {counts.size}/12 (≥10 required)
      </div>
    </div>
  );
}
