import { googleClientOptions } from "@/lib/vercel-google";
import { BigQuery } from "@google-cloud/bigquery";

export const PROJECT_ID =
  process.env.BIGQUERY_PROJECT_ID ?? "jovial-root-443516-a7";

let client: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (!client) {
    client = new BigQuery({ projectId: PROJECT_ID, ...googleClientOptions() });
  }
  return client;
}
