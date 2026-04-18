'use client';
import { useState } from 'react';

export interface Brief {
  briefId: string;
  conceptName: string;
  angle: string;
  funnelStage: string;
  matrixCell: string;
  layoutArchetype: string;
  visualDirection: string;
  primaryText: string;
  headline: string;
  cta: string;
  hypothesis: string | null;
  status: string;
}

export function BriefCard({ brief }: { brief: Brief }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-900/50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-500">{brief.briefId}</span>
          <span className="text-white font-semibold text-sm">{brief.conceptName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {brief.angle}×{brief.funnelStage}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {brief.layoutArchetype}
          </span>
          <span className={`px-2 py-0.5 rounded ${statusColor(brief.status)}`}>
            {brief.status}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-800 px-4 py-4 text-sm text-slate-300 space-y-3">
          <section>
            <div className="text-xs text-slate-500 uppercase mb-1">Visual direction</div>
            <p>{brief.visualDirection}</p>
          </section>
          <section>
            <div className="text-xs text-slate-500 uppercase mb-1">Primary text</div>
            <p className="italic">{brief.primaryText}</p>
          </section>
          <section>
            <div className="text-xs text-slate-500 uppercase mb-1">Headline</div>
            <p>{brief.headline}</p>
          </section>
          {brief.hypothesis && (
            <section>
              <div className="text-xs text-slate-500 uppercase mb-1">Hypothesis</div>
              <p className="text-slate-400">{brief.hypothesis}</p>
            </section>
          )}
          {brief.status === 'proposed' && (
            <button
              onClick={() => pushToMeta(brief.briefId)}
              className="mt-2 px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 rounded text-slate-950 font-medium transition"
            >
              Push to Meta →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

async function pushToMeta(briefId: string) {
  const res = await fetch(`/api/creative-pipeline/push-brief/${briefId}`, {
    method: 'POST',
  });
  if (res.ok) {
    window.location.reload();
  } else {
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    alert(`Push failed: ${err.error}`);
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'proposed': return 'bg-slate-800 text-slate-400';
    case 'pushed': return 'bg-blue-900/50 text-blue-300';
    case 'live': return 'bg-emerald-900/50 text-emerald-300';
    case 'resolved': return 'bg-violet-900/50 text-violet-300';
    case 'killed': return 'bg-red-900/50 text-red-300';
    default: return 'bg-slate-800 text-slate-400';
  }
}
