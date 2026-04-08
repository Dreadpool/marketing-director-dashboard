# Dashboard KPI Board: Route Revenue

## Context

The marketing director dashboard homepage currently shows 4 placeholder KPI cards (Gross Bookings, New Customers, Ad Spend, ROAS). These get replaced with the full route revenue view from Jacob's MMC Ridership Summaries dashboard (mmc-ridership-summaries.vercel.app). Data fetched via proxy API routes to Jacob's Vercel deployment.

## Design

### Data Flow

Three proxy API routes, server-side fetch, no transformation:

- `GET /api/mmc-report?month=FEB26` → `GET mmc-ridership-summaries.vercel.app/api/report?month=FEB26`
- `GET /api/mmc-report/months` → `GET mmc-ridership-summaries.vercel.app/api/months`
- `POST /api/mmc-report/refresh?month=FEB26` → `POST mmc-ridership-summaries.vercel.app/api/report/refresh?month=FEB26`

### Homepage Layout (top to bottom)

1. **Header row** - "Route Revenue" title + month picker dropdown + refresh icon button (triggers recalculation)
2. **4 KPI cards** - Total Revenue, SLE Revenue, Interline Revenue, Total Passengers. Each with YoY delta (green/red arrow, % change, prior year value).
3. **Decomposition bars** - SLE delta, Interline delta, Net change. Diverging horizontal bars from center. Contextual caption.
4. **Route table** - Sortable columns: Route, Revenue, SLE/Interline stacked bar, YoY Rev, Passengers, YoY Pax, Avg Ticket. Rows expand to show SLE/FLIX/Other channel breakdown.
5. **Collapsible sections** - Allocated Fees, Non-Allocated Fees, Interline Commissions.

### Styling

Restyled to marketing dashboard design system:
- Dark theme, shadcn/ui Card components
- Space Grotesk headings, IBM Plex Sans body (project fonts, not DM Mono/DM Sans)
- SLE blue (#4a8cff) and interline amber (#f59e0b) kept for channel colors
- Growth green / decline red from project's existing color tokens

### Files

**New:**
- `src/app/api/mmc-report/route.ts` - proxy for report data
- `src/app/api/mmc-report/months/route.ts` - proxy for available months
- `src/app/api/mmc-report/refresh/route.ts` - proxy for refresh
- `src/components/dashboard/kpi-cards.tsx` - 4 revenue KPI cards with YoY
- `src/components/dashboard/decomposition-bars.tsx` - YoY delta diverging bars
- `src/components/dashboard/route-table.tsx` - sortable expandable route table
- `src/lib/types/mmc-report.ts` - TypeScript types for MMC report API response

**Modified:**
- `src/app/page.tsx` - full rewrite, replace current content

### Verification

1. `npm run build` passes
2. Homepage loads, month picker works, KPI cards show data
3. Refresh button triggers recalculation and updates display
4. Route table sorts by column, rows expand to show channel breakdown
5. Fees and commissions sections expand/collapse
