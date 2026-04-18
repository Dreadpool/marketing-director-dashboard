const TARGET_CPA = 9;
const SPEND_FLOOR = 200;

export interface DbBrief {
  spend: string | null;
  cpa: string | null;
  status: string;
}

export interface CycleScore {
  score: number;
  hit_rate: number;
  avg_winner_cpa: number;
  winners: number;
  total: number;
  killed: number;
  average: number;
}

export function computeCycleScore(briefs: DbBrief[]): CycleScore {
  const resolved = briefs.filter(
    b =>
      (b.status === 'resolved' || b.status === 'killed') &&
      Number(b.spend || 0) >= SPEND_FLOOR
  );
  const winners = resolved.filter(b => {
    const cpa = b.cpa !== null ? Number(b.cpa) : Infinity;
    return cpa < TARGET_CPA;
  });
  const killed = resolved.filter(b => b.status === 'killed').length;
  const average = resolved.length - winners.length - killed;
  const avgWinnerCpa =
    winners.length > 0
      ? winners.reduce((s, b) => s + Number(b.cpa || 0), 0) / winners.length
      : 0;
  const hitRate = resolved.length > 0 ? winners.length / resolved.length : 0;
  const score = winners.length === 0 ? 0 : winners.length * (TARGET_CPA / avgWinnerCpa);

  return {
    score,
    hit_rate: hitRate,
    avg_winner_cpa: avgWinnerCpa,
    winners: winners.length,
    total: resolved.length,
    killed,
    average,
  };
}
