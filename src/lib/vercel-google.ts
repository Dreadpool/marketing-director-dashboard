import { getVercelOidcToken } from "@vercel/oidc";

export function productionGoogleCredentials() {
  if (process.env.VERCEL_ENV !== "production") return undefined;
  return {
    type: "external_account",
    audience: "//iam.googleapis.com/projects/67709781143/locations/global/workloadIdentityPools/vercel-sle/providers/marketing-director-dashboard",
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/bigquery-analysis-sa@jovial-root-443516-a7.iam.gserviceaccount.com:generateAccessToken",
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
  };
}

export function googleClientOptions() {
  const workload = productionGoogleCredentials();
  if (workload) return { credentials: workload };
  const json = process.env.GOOGLE_CREDENTIALS_JSON;
  return json ? { credentials: JSON.parse(json) } : {};
}
