import type { InputsLoaded } from '@/lib/workflows/creative-pipeline/types';

type InputEntry =
  | { path: string; bytes: number }
  | { path: string; bytes: number; entries: number }
  | { path: string; totalEntries: number; resolvedEntries: number };

function renderMeta(data: InputEntry) {
  if ('totalEntries' in data) {
    return (
      <div className="text-xs text-slate-500">
        {data.totalEntries} entries ({data.resolvedEntries} resolved)
      </div>
    );
  }
  return (
    <div className="text-xs text-slate-500">
      {(data.bytes / 1024).toFixed(1)} KB
      {'entries' in data ? ` · ${data.entries} entries` : ''}
    </div>
  );
}

export function InputsLoadedPanel({ inputs }: { inputs: InputsLoaded | null }) {
  if (!inputs) {
    return (
      <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
        <div className="text-xs text-slate-500 uppercase mb-3">Inputs loaded</div>
        <p className="text-sm text-slate-500 italic">
          No agent-run metrics recorded yet for this cycle.
        </p>
      </div>
    );
  }
  const items = [
    { key: 'program.md', data: inputs.programMd },
    { key: 'reference/swipe-file.md', data: inputs.swipeFileMd },
    { key: 'results.md', data: inputs.resultsLog },
    { key: 'brand-voice/sle-brandscript.md', data: inputs.brandVoice },
  ];
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Inputs loaded</div>
      <ul className="space-y-2 text-sm">
        {items.map(({ key, data }) => (
          <li key={key} className="flex items-start gap-3">
            <span className={`text-lg ${data ? 'text-emerald-400' : 'text-slate-600'}`}>
              {data ? '✓' : '○'}
            </span>
            <div className="flex-1">
              <div className="font-mono text-xs text-slate-300">{key}</div>
              {data && renderMeta(data)}
              {!data && <div className="text-xs text-slate-600">not loaded</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
