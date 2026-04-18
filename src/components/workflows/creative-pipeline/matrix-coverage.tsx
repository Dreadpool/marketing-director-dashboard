const ANGLES = ['price', 'convenience', 'social-proof', 'vs-driving'];
const STAGES = ['prospecting', 'retargeting', 'awareness'];

export function MatrixCoverage({ briefs }: { briefs: { matrixCell: string }[] }) {
  const counts = new Map<string, number>();
  for (const b of briefs) {
    counts.set(b.matrixCell, (counts.get(b.matrixCell) || 0) + 1);
  }

  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Matrix coverage</div>
      <div className="grid grid-cols-5 gap-2 text-xs">
        <div />
        {ANGLES.map(a => (
          <div key={a} className="text-slate-500 text-center pb-1 font-semibold">
            {a}
          </div>
        ))}
        {STAGES.map(s => (
          <div key={s} className="contents">
            <div className="text-slate-500 font-semibold py-2">{s}</div>
            {ANGLES.map(a => {
              const cell = `${a}×${s}`;
              const count = counts.get(cell) || 0;
              return (
                <div
                  key={cell}
                  className={`p-2 rounded border text-center ${
                    count === 0
                      ? 'border-slate-800 text-slate-700'
                      : count === 1
                      ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300'
                      : 'border-amber-900/40 bg-amber-950/20 text-amber-300'
                  }`}
                  title={count > 1 ? 'Duplicate cell' : ''}
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
