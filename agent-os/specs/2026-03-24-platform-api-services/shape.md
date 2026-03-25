# Shaping Notes

## Decision: Node.js API Clients over MCP
MCP tools (`mcp__meta-ads__*`) only work during Claude conversations. The dashboard needs server-side data fetching in Next.js API routes, so direct Node.js clients are required.

## SDK Choices
- **Meta Ads**: `facebook-nodejs-business-sdk` (official SDK) over plain fetch. Handles pagination, rate limiting, field validation.
- **Google Ads**: `google-ads-api` npm package. Uses GAQL for queries, service account auth (same creds as BigQuery).
- **Fallback**: Both platforms have REST APIs. If SDKs cause issues, plain fetch to Graph API / Google Ads REST is straightforward.

## Auth
- **Meta**: System User Token (never expires, `ads_read` scope). Stored in `META_ACCESS_TOKEN`.
- **Google**: Service account via `GOOGLE_APPLICATION_CREDENTIALS` (shared with BigQuery). Developer token in `GOOGLE_ADS_DEVELOPER_TOKEN`.

## Attribution
- Meta uses 28d_click attribution window
- Google Ads conversions are GA4 events (not necessarily purchases), marked as non-ground-truth
