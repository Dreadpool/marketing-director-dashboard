interface SavedRun {
  id: string;
  periodYear: number;
  periodMonth: number;
  status: string;
  startedAt: string;
}

export function latestPeriodRun<T extends SavedRun>(runs: T[], year: number, month: number): T | undefined {
  const matches = runs.filter((r) => r.periodYear === year && r.periodMonth === month)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  return matches[0]?.status === "running" ? matches[0] : matches.find((r) => r.status === "completed") ?? matches[0];
}

// Old runs can contain cached data; never use the run's completion time as retrieval time.
export function getDataRetrievedAt(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const value = data as { dataRetrievedAt?: unknown; metadata?: { generated_at?: unknown } };
  const date = value.dataRetrievedAt ?? value.metadata?.generated_at;
  return typeof date === "string" && Number.isFinite(Date.parse(date)) ? date : null;
}
