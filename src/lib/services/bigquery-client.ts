import { BigQuery } from "@google-cloud/bigquery";

export const PROJECT_ID =
  process.env.BIGQUERY_PROJECT_ID ?? "jovial-root-443516-a7";

let client: BigQuery | null = null;

/**
 * Shared BigQuery client singleton.
 *
 * Credential resolution order:
 * 1. GOOGLE_CREDENTIALS_JSON env var (inline JSON string, for Vercel/deployment)
 * 2. GOOGLE_APPLICATION_CREDENTIALS env var (file path, for local dev)
 * 3. Application Default Credentials (gcloud auth)
 */
export function getBigQueryClient(): BigQuery {
  if (!client) {
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    if (credentialsJson) {
      const credentials = JSON.parse(credentialsJson);
      client = new BigQuery({ projectId: PROJECT_ID, credentials });
    } else {
      client = new BigQuery({ projectId: PROJECT_ID });
    }
  }
  return client;
}
