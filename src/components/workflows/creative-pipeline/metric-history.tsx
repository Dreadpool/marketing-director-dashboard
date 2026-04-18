'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Cycle {
  cycleId: string;
  metrics: { score: number; hit_rate: number; winners: number; total: number };
}

export function MetricHistory() {
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  useEffect(() => {
    fetch('/api/creative-pipeline/cycles')
      .then(r => r.json())
      .then(data => setCycles(data.cycles));
  }, []);
  if (!cycles) {
    return (
      <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30 min-h-[200px]">
        <div className="text-xs text-slate-500 uppercase mb-3">Metric history</div>
        <div className="text-sm text-slate-500 italic">Loading…</div>
      </div>
    );
  }
  const chartData = cycles
    .slice()
    .reverse()
    .map(c => ({ cycle: c.cycleId, score: Number(c.metrics.score.toFixed(2)) }));
  return (
    <div className="border border-slate-800 rounded-lg p-5 bg-slate-900/30">
      <div className="text-xs text-slate-500 uppercase mb-3">Metric history</div>
      {chartData.length === 0 ? (
        <div className="text-sm text-slate-500 italic">No cycles with outcomes yet.</div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="cycle" stroke="#94a3b8" style={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="score" stroke="#eab308" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
