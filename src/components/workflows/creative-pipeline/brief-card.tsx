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
  killReason?: string | null;
  rejectedAt?: string | null;
}

export function BriefCard({ brief }: { brief: Brief }) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingError, setRejectingError] = useState<string | null>(null);
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
          {brief.status === 'proposed' && !rejecting && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => pushToMeta(brief.briefId)}
                className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 rounded text-slate-950 font-medium transition"
              >
                Accept →
              </button>
              <button
                onClick={() => setRejecting(true)}
                className="px-3 py-1.5 text-xs bg-transparent border border-red-900/60 hover:border-red-600/80 hover:bg-red-950/30 rounded text-red-300 font-medium transition"
              >
                Reject
              </button>
            </div>
          )}
          {brief.status === 'proposed' && rejecting && (
            <div className="mt-3 rounded border border-red-900/40 bg-red-950/20 p-3">
              <label className="block text-xs text-red-200 uppercase tracking-wide mb-1">
                Reason (required, min 10 chars)
              </label>
              <textarea
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 min-h-[72px] focus:outline-none focus:border-slate-500"
                placeholder="off-brand, we don't use 'Seriously.' as a hook"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
              {rejectingError && (
                <div className="mt-2 text-xs text-red-400">{rejectingError}</div>
              )}
              <div className="flex gap-2 mt-2 justify-end">
                <button
                  onClick={() => {
                    setRejecting(false);
                    setRejectReason('');
                    setRejectingError(null);
                  }}
                  className="px-3 py-1.5 text-xs bg-transparent border border-slate-700 hover:border-slate-500 rounded text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  disabled={rejectReason.trim().length < 10}
                  onClick={() => rejectBrief(brief.briefId, rejectReason.trim(), setRejectingError)}
                  className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed rounded text-red-100 transition"
                >
                  Save rejection
                </button>
              </div>
            </div>
          )}
          {brief.status === 'rejected-at-review' && brief.killReason && (
            <div className="mt-3 rounded border border-red-900/40 bg-red-950/20 p-3">
              <div className="text-xs text-red-200 uppercase tracking-wide mb-1">
                Rejected {brief.rejectedAt ? new Date(brief.rejectedAt).toISOString().slice(0, 10) : ''}
              </div>
              <div className="text-sm text-red-100">{brief.killReason}</div>
            </div>
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

async function rejectBrief(
  briefId: string,
  reason: string,
  setError: (e: string | null) => void
) {
  const res = await fetch(`/api/creative-pipeline/reject-brief/${briefId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (res.ok) {
    window.location.reload();
    return;
  }
  const err = await res.json().catch(() => ({ error: 'unknown' }));
  setError(err.error || 'rejection failed');
}

function statusColor(status: string): string {
  switch (status) {
    case 'proposed': return 'bg-slate-800 text-slate-400';
    case 'accepted': return 'bg-blue-900/50 text-blue-300';
    case 'live': return 'bg-emerald-900/50 text-emerald-300';
    case 'resolved': return 'bg-violet-900/50 text-violet-300';
    case 'killed': return 'bg-red-900/50 text-red-300';
    case 'rejected-at-review': return 'bg-red-900/50 text-red-300';
    default: return 'bg-slate-800 text-slate-400';
  }
}
