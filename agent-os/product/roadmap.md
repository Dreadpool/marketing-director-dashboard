# Product Roadmap

## Phase 1: MVP

### Core Dashboard
- High-level metrics dashboard (revenue, CAC, ad spend, new customers, ROAS) as the main screen
- Key metrics pulled from BigQuery sales data and ad platform APIs

### Workflow Engine
- Workflow scheduler that surfaces tasks based on cadence (monthly, quarterly, yearly)
- Workflow state tracking (pending, in-progress, completed, action items logged)

### 5 Launch Workflows

**1. Meta Ads Analysis**
- Pull campaign performance data via Meta Ads API
- 5-phase analysis: account health, campaign structure, creative performance, audience/delivery, synthesis
- Creative fatigue detection, audience efficiency scoring
- Prioritized action items with decision matrix

**2. Google Ads Analysis**
- Pull campaign data via Google Ads API (GAQL)
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

## Phase 2: Post-Launch

To be determined. Potential directions include additional workflow types, SaaS multi-tenancy, and custom data source connections. The product will evolve significantly before any SaaS launch.
