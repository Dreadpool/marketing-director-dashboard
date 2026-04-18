import type { GateReport } from '@/lib/workflows/creative-pipeline/types';

export function GateStatus({ gates }: { gates: GateReport }) {
  const entries = [
    ...(gates.brandVoice ? [{ key: 'brand-voice', result: gates.brandVoice }] : []),
    { key: 'duplicate', result: gates.duplicate },
    { key: 'matrix-diversity', result: gates.matrixDiversity },
    ...(gates.sniffTest ? [{ key: 'sniff-test', result: gates.sniffTest }] : []),
  ];
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Gate status</div>
      <div className="space-y-2">
        {entries.map(({ key, result }) => (
          <div key={key} className="flex items-start gap-3">
            <span className={`text-lg ${result.passed ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.passed ? '✓' : '✗'}
            </span>
            <div className="flex-1">
              <div className="text-sm text-slate-200 font-medium">{result.name}</div>
              {result.failures.length > 0 && (
                <ul className="mt-1 text-xs text-red-300 list-disc pl-4">
                  {result.failures.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
