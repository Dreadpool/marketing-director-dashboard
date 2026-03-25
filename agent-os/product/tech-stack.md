# Tech Stack

## Frontend

- **Next.js 15** (App Router) — full-stack React framework, server components for fast data loading
- **TypeScript** — type safety throughout the codebase
- **Tailwind CSS** — utility-first styling
- **shadcn/ui** — polished, customizable component library built on Radix primitives
- **Recharts** — flexible charting library for dashboard visualizations

## Backend

- **Next.js API Routes + Server Actions** — no separate backend service needed
- **Vercel AI SDK** — streaming chat UI, tool use, and Claude integration
- Server-side data fetching from all external APIs

## Data Layer

- **BigQuery** — single source of truth for sales/customer/revenue data
- `@google-cloud/bigquery` client in Next.js server components / route handlers
- **Next.js ISR caching** (`revalidate`) — avoids per-pageload BigQuery queries, revalidates every few hours
- **Vercel Postgres** — app state only: workflow progress, action items, manual spend entries, user preferences. Not for duplicating source data.

## AI Integration

- **Claude** (Anthropic) — AI assistant in side panel chat
- **Vercel AI SDK** — handles streaming responses, tool calling, context management
- Workflow-specific context loading: analysis frameworks, visualization guidelines, action item templates
- **Auth mechanism TBD** — goal is user authentication via existing Claude subscription (needs research into Anthropic OAuth capabilities; fallback is API key input)

## Data Sources (Server-Side API Calls)

No message broker (Kafka) or stream processing (Spark) needed. All data sources are request-response APIs pulled on-demand when workflows run.

| Source | API | Data |
|--------|-----|------|
| Meta Ads | Meta Marketing API (read-only) | Campaign performance, creative metrics, audience data |
| Google Ads | Google Ads API (GAQL) | Campaign spend, search terms, geographic performance |
| BigQuery | BigQuery API | Sales orders, customer data, CardPointe settlements |
| GA4 | GA4 Data API | Sessions, traffic sources, conversion data |
| Google Sheets | Sheets API | Ad spend budgets, SEO keyword rankings |

## Data Normalization

A lightweight **shared metric schema** (TypeScript interfaces) normalizes data from different ad platforms into common fields: spend, impressions, clicks, conversions, CPA, ROAS. This enables consistent dashboard rendering across channels and coherent cross-channel AI analysis. This is not a full ontology system — it's typed interfaces that map platform-specific fields to a shared structure.

## Auth

- **NextAuth.js (Auth.js)** — session management, extensible for future SaaS multi-tenancy
- OAuth providers as needed (Google for data source permissions)

## Deployment

- **Vercel** — hosting, serverless functions, Postgres, edge network
- Environment variables for API credentials (Meta, Google, BigQuery service account)

## Key Architecture Decisions

1. **No Kafka/Spark** — Data volumes are modest (one company's marketing data) and all sources are pull-based REST APIs. Simple server-side fetch calls handle this cleanly.
2. **No separate backend** — Next.js API routes and server actions provide the server-side logic needed. Avoids maintaining two services.
3. **Shared metric schema over ontology** — A TypeScript interface layer normalizes cross-platform data without the complexity of a full object-graph ontology system.
4. **On-demand data fetching** — Data is pulled when workflows run, not continuously streamed. Cached via Next.js ISR for fast re-access.
