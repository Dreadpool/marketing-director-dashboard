import { getBigQueryClient } from "./bigquery-client";

export type ConnectionStatus = {
  ok: boolean;
  error?: string;
  latencyMs: number;
};

/** Health check: SELECT 1 to verify credentials work */
export async function testConnection(): Promise<ConnectionStatus> {
  const start = Date.now();
  try {
    const bq = getBigQueryClient();
    await bq.query({ query: "SELECT 1" });
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}
