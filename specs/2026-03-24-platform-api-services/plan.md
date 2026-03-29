# Platform API Services (Meta Ads + Google Ads)

## Problem
Dashboard KPI cards for Ad Spend and ROAS show nothing. BigQuery has revenue/customer data but platform spend, conversions, CPA, and ROAS need direct API calls.

## Solution
Node.js API clients in Next.js API routes, following the BigQuery service pattern.

## Services
- **Meta Ads**: `facebook-nodejs-business-sdk`, fetches campaign insights (spend, clicks, impressions, purchases)
- **Google Ads**: `google-ads-api`, fetches campaign metrics via GAQL

## Integration
- Dashboard API fetches BigQuery + Meta + Google in parallel via `Promise.allSettled`
- Existing transformers normalize raw rows into `DashboardMetrics`
- One platform failing does not break the dashboard

## Files
- `src/lib/services/meta-ads.ts` — Meta Ads client
- `src/lib/services/google-ads.ts` — Google Ads client
- `src/app/api/dashboard/route.ts` — Wires platform data into response
- `src/app/api/data-sources/route.ts` — Live connection checks
