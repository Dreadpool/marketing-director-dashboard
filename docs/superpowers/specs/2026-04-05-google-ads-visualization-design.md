# Google Ads Visualization Dashboard Design

## Problem

The Google Ads workflow renders AI analysis as a wall of text. The Meta Ads workflow renders a structured dashboard with KPI cards, color-coded metrics, campaign tables, and collapsible sections. A marketing director needs to scan and decide, not read an essay. The Google Ads visualization should match Meta's quality while reflecting Google Ads' unique structure (segments, ground truth, CPA decomposition).

## Design Decisions (User-Approved)

1. **Segment-first layout** -- No blended account CPA. Each segment (brand, non-brand, competitor, PMax, video, other) gets its own health card. Brand's 1,299x ROAS inflates blended metrics and hides problems.
2. **Total spend in header** -- Present but compact, not a hero metric.
3. **Channel context (not ground truth warning)** -- "Google claims X of Y total bookings (Z%)" as informational text in the header. Not a warning, not color-coded. BigQuery includes all channels, so the comparison is context, not a data quality signal.
4. **4-metric grid cards with status badge and YoY trend** -- Each segment card shows Spend, CPA, ROAS, Conversions in a 2x2 grid. Status badge (Healthy/Watch/Bleeding). YoY trend line at bottom.
5. **Inline diagnostics when CPA is elevated or high** -- CPA = CPC / CVR decomposition auto-shows below the segment card metrics. One-line diagnosis explains the cause and recommended action. No extra click needed.
6. **YoY as primary trend** -- Year-over-year catches seasonality. MoM shown as secondary when YoY unavailable.
7. **Campaign tables grouped by segment** -- Non-brand open by default (the real acquisition engine). Other segments collapsed with inline summary (campaign count, spend, CPA).
8. **Zombie badge** -- Campaigns spending with zero conversions get a gray "ZOMBIE" badge in the campaign table.
9. **Video uses different metrics** -- CPV and VTR instead of CPA/ROAS (awareness, not conversion).

## Component Architecture

### New File

`src/components/workflows/google-ads-fetch-summary.tsx`

Single file containing:
- Type guard: `isGoogleAdsMetrics(data)` -- checks for `ground_truth` field (unique to Google Ads)
- Main component: `GoogleAdsFetchSummary({ data: GoogleAdsMetrics })`
- Sub-components (not exported, internal to file):
  - `SegmentCard` -- 4-metric grid card with status badge, YoY trend, conditional diagnostic
  - `CpaDiagnostic` -- CPC/CVR decomposition with YoY comparison and one-line diagnosis
  - `SegmentCampaignTable` -- Campaign table for one segment
  - `CollapsibleSection` -- Reusable collapsible wrapper (same pattern as Meta component)

### Modified Files

- `src/components/workflows/fetch-step-summary.tsx` -- Add import and routing: if `isGoogleAdsMetrics(data)` render `GoogleAdsFetchSummary`
- `src/lib/schemas/sources/google-ads-metrics.ts` -- Add `GoogleAdsSegmentTrend` type and `segment_trends` field to `GoogleAdsMetrics`
- `src/lib/workflows/executors/fetch-google-ads.ts` -- Compute per-segment trends (CPA, CPC, CVR YoY) from prior period data

## Layout (Top to Bottom)

### 1. Header Row

Left side:
- Title: "Google Ads Analysis"
- Subtitle: campaign description text

Right side:
- Period: "March 2026"
- Total spend: "$12,847" (bold but not oversized)
- Channel context: "Google claims 5,732 of 9,862 total bookings (58%)"

### 2. Source Badges

Horizontal row of 4 badges (same pattern as Meta):
- Google Ads (Current Month) -- green check / red X
- Google Ads (Prior Month) -- green check / amber warning
- Google Ads (Prior Year) -- green check / amber warning
- BigQuery Sales -- green check / amber warning

### 3. Segment Health Cards

3-column grid. Each card:

```
┌─────────────────────────────────┐
│ NON-BRAND              [Watch] │
├─────────────────────────────────┤
│ SPEND     $5,841  │ CPA  $10.22│  ← CPA color-coded
│ ROAS       8.0x   │ CONV   572 │
├─────────────────────────────────┤
│ vs. last year: CPA +18% · Conv -12%
├─────────────────────────────────┤  ← only when CPA elevated/high
│ ⚠ WHY: CPA Decomposition       │
│ CPC $1.89 (+2% YoY)            │
│ CVR 3.2% (-22% YoY)            │  ← CVR highlighted as the problem
│ → CVR is the problem. Check     │
│   landing pages and search terms │
└─────────────────────────────────┘
```

**Status badge logic:**
- `Healthy` (green) -- CPA on-target (< $9) and not zombie
- `Watch` (amber) -- CPA elevated ($9-$14)
- `Bleeding` (red) -- CPA high (> $14) or zombie (spending with zero conversions)
- `Awareness` (gray) -- Video segment (different benchmarks, no CPA evaluation)

**Segment colors** (left border + label):
- Brand: `#60a5fa` (blue-400)
- Non-Brand: `#4ade80` (emerald-400)
- PMax: `#c084fc` (purple-400)
- Competitor: `#f97316` (orange-500)
- Video: `#06b6d4` (cyan-500)
- Other: `#888` (muted)

**Cards only render for segments with data** (campaign_count > 0).

**Video segment card uses different metrics:** Instead of CPA/ROAS, show CPV (cost per view = spend / impressions) and VTR (view-through rate = clicks / impressions as proxy). No CPA status badge. Status badge shows "Awareness" in gray. No diagnostic section (CPA decomposition doesn't apply).

Second row of cards if > 3 segments exist.

### 4. Diagnostic Logic (CPA Decomposition)

Appears inline on segment card when `cpa_status` is `"elevated"` or `"high"`.

The master equation: **CPA = CPC / CVR**

CVR (conversion rate) = conversions / clicks. Computed from existing segment health data.

**Diagnosis rules:**

| CPC YoY | CVR YoY | Diagnosis text | Color |
|---------|---------|----------------|-------|
| Up (>10%) | Stable (within 10%) | "CPC is the problem. Competition or Quality Score issue." | amber |
| Stable | Down (>10%) | "CVR is the problem. Check landing pages and search term relevance." | amber |
| Up | Down | "Both CPC and CVR degrading. Fix conversion rate first (free, higher leverage)." | red |
| Stable | Stable | "CPA elevated but components stable. Check if seasonal (compare YoY)." | muted |

**When YoY data is unavailable:** Show MoM comparison instead with "(MoM)" label. If neither available, show current values only with no diagnosis text.

**Zombie campaigns (zero conversions):** No CPC/CVR decomposition (division by zero). Instead show: "Spending with zero conversions. Pause or restructure."

### 5. Campaign Tables (Grouped by Segment)

One collapsible section per segment. Non-brand open by default, others collapsed.

**Collapsed header shows summary:**
```
▶ Brand Campaigns    3 campaigns · $1,973 spend · CPA $0.57
```

**Expanded table columns:**
| Column | Format | Color logic |
|--------|--------|-------------|
| Campaign | Text (left-aligned) | Muted for paused campaigns |
| Spend | USD, no decimals | None |
| CPA | USD, 2 decimals | Green < $9, Amber $9-14, Red > $14 |
| ROAS | X.Xx | Muted if >= 3.0, Red if < 3.0 |
| Clicks | Number | None |
| Conv | Number | Red if 0 and spend > 0 |

**Zombie badge:** Gray `ZOMBIE` badge next to campaign name when conversions = 0 and spend > 0. Row gets faint red background (`rgba(239,68,68,0.05)`).

**Sort order:** By spend descending within each segment.

**Video segment table uses different columns:**
| Campaign | Spend | Impressions | Clicks | CTR | Avg CPC |

(No CPA/ROAS/Conv columns for video campaigns since they're awareness, not conversion.)

## Data Requirements

### Executor Extension

The current executor computes trends at the account level only. The visualization needs per-segment trends for the diagnostic cards.

**New type** (`google-ads-metrics.ts`):

```typescript
export type GoogleAdsSegmentTrend = {
  segment: CampaignSegment;
  cpa: GoogleAdsTrend;
  avg_cpc: GoogleAdsTrend;
  cvr: GoogleAdsTrend; // conversions / clicks
  conversions: GoogleAdsTrend;
};
```

**New field on `GoogleAdsMetrics`:**
```typescript
segment_trends: GoogleAdsSegmentTrend[];
```

**Executor change:** After mapping prior month and prior year campaign rows, compute segment health for those periods too. Then build `GoogleAdsSegmentTrend` for each active segment by comparing current vs prior segment health values.

### Component Data Flow

1. Type guard checks for `ground_truth` field (unique to Google Ads, not present in Meta or Monthly Analytics)
2. Component receives `GoogleAdsMetrics` data
3. Segment cards render from `account_health.segments[]`
4. Diagnostic section on each card reads from `segment_trends[]` for the matching segment
5. Campaign tables render from `campaigns[]` filtered by segment
6. Ground truth renders from `ground_truth` (channel context line)
7. Source badges render from `metadata.source_details`

## Color Helpers

```typescript
function cpaColor(cpa: number): string {
  if (cpa <= 0) return "";
  if (cpa < 9) return "text-emerald-400";
  if (cpa < 14) return "text-amber-400";
  return "text-red-400";
}

function roasColor(roas: number): string {
  return roas >= 3.0 ? "text-muted-foreground" : "text-red-400";
}

function trendColor(change: number, inverted = false): string {
  // For CPA: positive change is bad (inverted=true)
  // For conversions: positive change is good (inverted=false)
  const isBad = inverted ? change > 0 : change < 0;
  if (Math.abs(change) < 0.05) return "text-muted-foreground"; // within 5% = neutral
  return isBad ? "text-red-400" : "text-emerald-400";
}
```

## Formatters

Same pattern as Meta component:
```typescript
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-US");
const pct = (n: number) => `${n.toFixed(1)}%`;
```

## UI Components Used

From `src/components/ui/`:
- `Badge` (variant="outline") -- for status badges, segment labels, zombie tags
- `Tooltip` / `TooltipProvider` / `TooltipTrigger` / `TooltipContent` -- for metric explanations

From `lucide-react`:
- `ChevronDown`, `ChevronRight` -- collapsible sections
- `CheckCircle2`, `AlertTriangle`, `XCircle` -- source status icons
- `Info` -- tooltip trigger icons

## Testing

1. **Build**: `npm run build` must pass
2. **Unit tests**: Add `isGoogleAdsMetrics` type guard tests
3. **UI verification**: Run the Google Ads workflow from `/workflows/google-ads-analysis`, verify:
   - Segment cards render with correct colors and status badges
   - Diagnostics appear only on elevated/high CPA segments
   - Campaign tables are grouped by segment, non-brand open
   - Zombie campaigns show badge
   - Channel context line shows in header
   - Source badges reflect data availability
   - No runtime errors in browser console
4. **Cross-contamination**: Verify Meta Ads and Monthly Analytics workflows still render correctly (type guards don't leak)
