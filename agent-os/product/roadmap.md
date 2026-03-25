# Product Roadmap

## Phase 1: MVP

### Core Dashboard
- High-level metrics dashboard (revenue, CAC, ad spend, new customers, ROAS) as the main screen
- Key metrics pulled from BigQuery sales data and ad platform APIs

### Data Layer
- **BigQuery** as single source of truth for sales/customer data (no intermediate DB for source data)
- **Vercel Postgres** for app state: workflow progress, action items, manual spend entries, user preferences
- Server-side BigQuery client in Next.js server components
- Next.js ISR caching (revalidate every few hours) to avoid per-pageload queries
- Data source status page (`/settings/data-sources`) for the next marketing director to diagnose connection issues

### Platform API Services (shared infrastructure)
- `src/lib/services/meta-ads.ts` — wraps Meta Ads MCP, returns normalized ad spend + performance
- `src/lib/services/google-ads.ts` — wraps Google Ads MCP, returns normalized ad spend + performance
- Shared by both dashboard KPI cards and individual workflows
- Feeds into existing transformers (`src/lib/schemas/transformers/`)

### Manual Marketing Spend Entry
- Simple form UI for entering non-platform marketing costs (print, sponsorships, events, etc.)
- Stored in Vercel Postgres
- Included in total spend for CAC calculation alongside platform ad spend

### Workflow Engine
- Workflow scheduler that surfaces tasks based on cadence (monthly, quarterly, yearly)
- Workflow state tracking (pending, in-progress, completed, action items logged)
- State persisted in Vercel Postgres

### 5 Launch Workflows

**1. Meta Ads Analysis**
- Uses shared Meta Ads service for campaign performance data
- 5-phase analysis: account health, campaign structure, creative performance, audience/delivery, synthesis
- Creative fatigue detection, audience efficiency scoring
- Prioritized action items with decision matrix

**2. Google Ads Analysis**
- Uses shared Google Ads service for campaign data
- Campaign spend summaries by type, daily trends, search terms, geographic performance
- CAC calculation combined with BigQuery new customer data

**3. BigQuery Sales Analysis**
- Revenue calculations (net vs gross, void/cancel handling)
- Customer segmentation (new vs returning, LTV)
- Trip analysis by route, payment method breakdown
- Foundation data for CAC and cross-channel validation

**4. SEO Ranking Analysis**
- Pull keyword ranking data from Google Sheets
- Visibility scoring, tier distribution, biggest movers
- Month-over-month rank movement tracking across 3 websites

**5. Monthly Analytics Review (Orchestrator)**
- Unified monthly report combining all data sources
- Revenue (CardPointe CC settlements + cash + account credit)
- Customer metrics, CAC, payment breakdown, promo code analysis
- MoM and YoY comparisons with master_metrics.json output

### AI Chat Panel
- Claude-powered side panel for conversational data exploration
- Workflow-specific context loading (frameworks, guidelines, available data)
- User authenticates with their Claude subscription (auth mechanism TBD — requires research into Anthropic OAuth/subscription integration)

### Data Visualization
- Consistent chart components across all workflows (Recharts)
- Standardized metric cards, trend lines, comparison tables

### Deployment
- Vercel hosting with environment variables for all credentials
- BigQuery service account key, Meta/Google API tokens
- Domain setup

## Phase 2: Post-Launch

To be determined. Potential directions include additional workflow types, SaaS multi-tenancy, and custom data source connections. The product will evolve significantly before any SaaS launch.

---

## Build Order

1. ~~Shared metric schema (types, transformers)~~ ✓
2. ~~BigQuery data service + dashboard KPI wiring~~ ✓
3. ~~Data source status page~~ ✓
4. ~~Platform API services (Meta Ads + Google Ads)~~ ✓
5. Manual marketing spend entry → non-platform costs, complete CAC
6. ~~Workflow engine foundation → scheduler, state (Neon Postgres), step-based execution~~ ✓
7. ~~First workflow end-to-end (Monthly Analytics Review)~~ ✓
8. AI chat panel with real Claude integration
9. Remaining workflows
10. Data visualization / Recharts components
11. Deployment
