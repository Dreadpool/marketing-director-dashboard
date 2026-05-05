# Google Ads Decision Framework

A composite analysis framework for evaluating Google Ads performance at Salt Lake Express. Built primarily on Frederick Vallaeys' campaign categorization methodology (tested across $5-6B in managed spend via Optmyzr), supplemented by Brad Geddes' Quality Score formula and the Lin-Rodnitzky Ratio from 3Q Digital.

## Framework Philosophy

Three roles for a marketing director reviewing Google Ads (from Vallaeys' *Unlevel the Playing Field*, 2022):

- **Doctor**: Diagnose problems. Are decision metrics healthy? If yes, stop analyzing.
- **Pilot**: Steer direction. Scale stars, cut bleeders, reallocate budget.
- **Teacher**: Train the algorithm. Feed better conversion data, set appropriate bid targets.

Phase 1 and 2 cover Doctor and Pilot. Phase 3 and 4 add diagnostic depth and Teacher capabilities.

## Framework Sources

| Source | What We Use | Credibility |
|--------|-------------|-------------|
| Frederick Vallaeys (Optmyzr) | Stars/Optimized/Zombies/Bleeders campaign categorization, Automation Layering philosophy | Ex-Google employee #500, built Quality Score at Google. Optmyzr manages $5-6B in ad spend across hundreds of thousands of accounts. Book: *Unlevel the Playing Field* (2022). |
| Brad Geddes (Adalysis) | Reverse-engineered Quality Score formula, 15-Part Audit hierarchy | PPC practitioner since 1998, author of *Advanced Google AdWords* (Wiley). QS formula derived from analysis of 15,000+ accounts (SEISO/Search Engine Land). |
| 3Q Digital (Will Lin, David Rodnitzky) | Lin-Rodnitzky Ratio for search term efficiency | Originated at 3Q Digital (now Tinuiti). Adopted industry-wide as standard PPC health metric. |
| WordStream/LocaliQ | Travel industry benchmarks | 2025 study of 16,446 Google Ads campaigns across industries. |
| Optmyzr Research | PMax budget allocation data | Study of 24,702 Performance Max campaigns (largest published PMax dataset). |
| Kirk Williams (ZATO Marketing) | PMax troubleshooting framework | Top 3 PPC expert (PPCSurvey 2025), 6-step PMax diagnostic. Shopping/PMax specialist since 2009. |
| SLE Unit Economics | CPA/ROAS thresholds | $35.23 gross profit per booking, 43% gross margin, 1.3x platform over-attribution, 3:1 LTV:CAC target. Same thresholds as Meta Ads workflow. |

## Key Difference from Meta (CTC Framework)

The CTC framework for Meta says: "If CPA is healthy, stop analyzing." Google Ads adds a second question that Meta doesn't have:

**"Are we capturing enough demand?"**

Google Search shows you exactly how much search volume exists and how much you're missing through Impression Share metrics. Even with healthy CPA, low Impression Share means you're leaving profitable demand on the table. This signal doesn't exist in Meta because Meta is push advertising (you choose the audience), while Google Search is pull advertising (the audience is already searching).

---

## Phase 1: Decision Metrics

**Question answered:** "Is this good or bad?"

### Step 0: Segment (mandatory, always first)

Before evaluating any metric, classify every campaign into a segment. Blended metrics across segments are meaningless because brand campaigns convert at 15-25% while non-brand converts at 2-5%.

| Segment | How to Identify (SLE naming conventions) | Why Separate |
|---------|------------------------------------------|-------------|
| **Brand** | Campaign name contains "Brand" (e.g., `SLE \| Search \| Brand`) | Cheap conversions inflate blended CPA. These people already know you. |
| **Non-Brand** | Campaign name contains "Non-Branded" (e.g., `SLE \| Search \| Non-Branded`, `STGEO \| Search \| Non-Branded`) | The real acquisition engine. This is where you find new customers. |
| **Competitor** | Campaign name contains "Competitors" (e.g., `SLE \| Search \| Competitors`) | Different economics: higher CPC, lower CVR. Evaluate separately. |
| **PMax** | Campaign type = Performance Max (e.g., `Charters - P-Max`) | Black box. Needs its own evaluation criteria (Phase 4). |
| **Video** | Campaign type = Video (e.g., `GMA \| Video Remarketing`) | Awareness/retargeting. Different benchmarks than direct response. |

Classification logic: Match against campaign name patterns. SLE uses a consistent `Brand \| Type \| Segment` naming convention. If a campaign doesn't match any pattern, flag it for manual classification.

### Decision Metrics

Three metrics per segment, evaluated in order:

#### 1. CPA (Cost Per Acquisition)

The primary decision metric. Same thresholds as Meta because they're derived from SLE's unit economics, not the platform.

| Status | Threshold | What It Means | Derivation |
|--------|-----------|---------------|------------|
| **On-Target** (green) | < $9 | Profitable acquisition. 3:1+ GP ratio after over-attribution adjustment. | $35.23 GP / (3.0 LTV:CAC x 1.3 over-attribution) = $9.04 |
| **Elevated** (yellow) | $9 - $14 | Watch closely. 2:1 to 3:1 GP ratio. Still above breakeven but margin shrinking. | $35.23 GP / (2.0 LTV:CAC x 1.3 over-attribution) = $13.55 |
| **High** (red) | > $14 | Losing money. Below 2:1 GP ratio. Diagnose immediately (Phase 3). | Below breakeven after attribution adjustment |

#### 2. ROAS (Return on Ad Spend)

Secondary confirmation metric. If CPA is healthy but ROAS is low, investigate conversion value tracking.

| Status | Threshold | What It Means |
|--------|-----------|---------------|
| **Healthy** (green) | >= 3.0x | Revenue exceeds 3x ad spend. Sustainable. |
| **Watch** (yellow) | 2.0x - 3.0x | Marginal. Profitable only if unit economics hold. |
| **Below Floor** (red) | < 2.0x | Unprofitable. Either CPA is too high or conversion values are wrong. |

#### 3. Conversion Volume

Trend-based, no absolute threshold. Compared month-over-month and year-over-year.

| Signal | Threshold | What It Means |
|--------|-----------|---------------|
| **Stable/Growing** (green) | Flat or up MoM | Demand is healthy. |
| **Declining** (yellow) | Down 10-20% MoM | Investigate: seasonal? Budget change? Competition? |
| **Dropping** (red) | Down >20% MoM | Something broke. Check tracking first, then demand. |

Always compare YoY for the same month to account for seasonality (ski season vs. summer travel).

### Ground Truth Caveat

Google Ads conversions are GA4 events, not actual bookings. The existing transformer already notes this: `"Conversions may be GA4 events, not actual purchases"`. The dashboard must surface both:

- **Google Ads reported conversions**: What Google says happened
- **BigQuery actual bookings**: What SLE's system recorded

When these diverge by more than 30%, flag it. The 1.3x over-attribution multiplier (same as Meta) accounts for this gap in CPA threshold calculations.

### Data Requirements (Phase 1)

| Data | Source | Status |
|------|--------|--------|
| Campaign spend, clicks, impressions | Google Ads API (`getMonthlySpend`) | **Exists** in `src/lib/services/google-ads.ts` |
| Campaign conversions, conversion value | Google Ads API (same query) | **Exists** in same service |
| Campaign name (for segmentation) | Google Ads API (same query) | **Exists** in same service |
| Actual bookings for the period | BigQuery (`getSalesOrders`) | **Exists** in `src/lib/services/bigquery-sales.ts` |
| Prior month data (MoM comparison) | Google Ads API | **Exists**: call `getMonthlySpend()` with prior month's `MonthPeriod` |
| Same-month-last-year data (YoY) | Google Ads API | **Exists**: call `getMonthlySpend()` with same-month-last-year `MonthPeriod` |

### Implementation Reference (Phase 1)

**Existing code to reuse:**
- `src/lib/services/google-ads.ts` — `getMonthlySpend(period)` fetches campaign-level data via GAQL
- `src/lib/schemas/sources/google-ads.ts` — `GoogleAdsCampaignRow` type
- `src/lib/schemas/transformers/google-ads.ts` — `normalizeGoogleAdsData()` (extend with segmentation)
- `src/lib/workflows/evaluations/meta-ads-monthly.ts` — `SLE_THRESHOLDS` pattern. CPA/ROAS/GP values are identical. Implementation should extract shared values (`cpa_on_target`, `cpa_elevated`, `roas_floor`, `over_attribution`, `gp_per_order`, `gross_margin`) into a shared `SLE_UNIT_ECONOMICS` constant that both Meta and Google Ads thresholds import, preventing drift.
- `src/lib/services/bigquery-sales.ts` — `getSalesOrders()` for ground truth booking count

**New files to create:**
- `src/lib/workflows/executors/fetch-google-ads.ts` — executor function following `fetchMetaAds` pattern. Calls `getMonthlySpend()` + `getSalesOrders()` via `Promise.allSettled()`. Classifies campaigns by segment. Calculates CPA/ROAS per segment. Returns `GoogleAdsMetrics` object.
- `src/lib/schemas/sources/google-ads-metrics.ts` — `GoogleAdsMetrics` type (account health with status flags per segment, campaign rows with segment classification, period metadata, ground truth comparison)
- `src/lib/workflows/prompts/google-ads.ts` — analyze + recommend prompts referencing the decision framework
- Register executor in `src/lib/workflows/executors/index.ts`
- Register prompts in `src/lib/workflows/prompts/index.ts`
- Update `src/lib/workflows.ts` — change `google-ads-analysis` status from `"coming-soon"` to `"active"`

---

## Phase 2: Growth & Allocation

**Question answered:** "Should I scale, maintain, or cut?"

### Impression Share (Google's Unique Signal)

Three metrics that tell you how much search demand you're capturing:

| Metric | GAQL Field | What It Tells You |
|--------|------------|-------------------|
| **Search Impression Share** | `metrics.search_impression_share` | % of eligible impressions where your ad appeared |
| **Lost IS (Budget)** | `metrics.search_budget_lost_impression_share` | % lost because daily budget ran out before end of day |
| **Lost IS (Rank)** | `metrics.search_rank_lost_impression_share` | % lost because Ad Rank was too low (bid x Quality Score) |

**Targets by segment:**

| Segment | IS Target | Rationale |
|---------|-----------|-----------|
| Brand | > 90% | Users searching your name should see your ad. Losing brand IS means competitors are stealing your traffic. |
| Non-Brand | > 65% | Diminishing returns above ~80% on non-brand. 65% captures the profitable core without overpaying for marginal impressions. |
| Competitor | No target | IS on competitor terms is inherently low. Not a useful diagnostic. |

**Diagnostic logic:**

| CPA Status | IS Status | Lost IS Type | Diagnosis | Action |
|------------|-----------|-------------|-----------|--------|
| Green | Low | Budget | Profitable campaign is budget-capped | Scale: increase budget |
| Green | High | N/A | Working and capturing demand | Maintain |
| Red | High | N/A | Showing up plenty, efficiency is the problem | Diagnose (Phase 3) |
| Red | Low | Budget | Unprofitable AND budget-capped | Do NOT increase budget. Fix efficiency first. |
| Red | Low | Rank | Quality Score or bid problem | Fix QS (Phase 3), then reconsider bids |
| Any | Low | Rank | Ad quality problem | Check Quality Score components (Phase 3) |

**Important:** If Lost IS (Budget) is significant, Lost IS (Rank) data is unreliable because Google can't measure rank for auctions you didn't enter due to budget. Fix budget issues first, then re-evaluate rank.

### Campaign Categorization (Vallaeys)

Every campaign gets a category based on CPA performance and conversion volume. Categories determine action.

| Category | CPA | Conversions/Month | Spend | Action |
|----------|-----|-------------------|-------|--------|
| **Stars** | On-target (<= $9) | 10+ | Any | Scale budget. Check IS for headroom. These are your growth engine. |
| **Optimized** | On-target (<= $9) | 5-10 | Any | Maintain. Monitor for promotion to Star or decline to Zombie. |
| **Zombies** | Any | < 5 | < $500 | Investigate: is there search demand? Wrong keywords? Wrong match type? Kill if no potential after 60 days. |
| **Bleeders** | Elevated or High (> $9) | Any | > $500 | Cut budget or pause. Every dollar here is better spent on Stars. |

**Conversion thresholds are SLE-calibrated.** At ~$2 average CPC (travel industry, WordStream 2025) and $10-15K monthly total spend:
- 10 conversions/month = enough data for Google's Smart Bidding to optimize (Google recommends 15-30, but 10 is the practical minimum for mid-market accounts)
- 5 conversions/month = insufficient signal. The campaign isn't generating enough data to evaluate performance reliably.
- $500/month spend on a Bleeder = ~250 wasted clicks. That budget redirected to a Star at $9 CPA would generate ~55 additional conversions.

**Dashboard treatment:** Campaign table sorted by urgency. Bleeders first (red, alert icon), Zombies second (gray, warning icon), Stars third (green, scale icon), Optimized last (neutral). The director sees problems first, opportunities second.

### Data Requirements (Phase 2)

| Data | Source | Status |
|------|--------|--------|
| Search Impression Share | Google Ads API (new GAQL fields) | **New**: add `metrics.search_impression_share`, `metrics.search_budget_lost_impression_share`, `metrics.search_rank_lost_impression_share` to campaign query |
| Campaign type | Google Ads API | **New**: add `campaign.advertising_channel_type` to distinguish Search/PMax/Video |
| All Phase 1 data | See Phase 1 | Required (categorization depends on CPA status) |

**GAQL query update** (extend existing `getMonthlySpend`):
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  metrics.cost_micros,
  metrics.clicks,
  metrics.impressions,
  metrics.conversions,
  metrics.conversions_value,
  metrics.search_impression_share,
  metrics.search_budget_lost_impression_share,
  metrics.search_rank_lost_impression_share
FROM campaign
WHERE segments.date >= '{startDate}'
  AND segments.date <= '{endDate}'
ORDER BY metrics.cost_micros DESC
```

### Implementation Reference (Phase 2)

**Extend existing code:**
- `src/lib/schemas/sources/google-ads.ts` — add IS fields and `advertising_channel_type` to `GoogleAdsCampaignRow`
- `src/lib/services/google-ads.ts` — extend GAQL query with IS metrics
- `src/lib/schemas/sources/google-ads-metrics.ts` — add `campaign_category` field and IS data to metrics type

**New code:**
- Campaign categorization logic in the executor (classify each campaign as Star/Optimized/Zombie/Bleeder based on CPA status + conversion count + spend)
- IS diagnostic logic (combine CPA status + IS level + lost IS type into actionable diagnosis)

---

## Phase 3: Diagnostics (Future)

**Question answered:** "WHY is it bad, and what do I fix?"

This phase activates when Phase 1 flags a problem (CPA elevated or high). It decomposes CPA into its components and identifies root cause.

### Tool 1: CPA Decomposition

The master diagnostic equation:

```
CPA = CPC / Conversion Rate
```

When CPA is off-target, it's always one of two things (or both):
- **CPC is too high** — paying too much per click (auction/quality problem)
- **Conversion rate is too low** — clicks aren't converting (landing page/intent problem)

Compare against travel industry benchmarks (WordStream 2025, 16,446 campaigns):

| Metric | Travel Industry Average | SLE Target | If SLE Is Worse |
|--------|------------------------|------------|-----------------|
| CPC | $2.12 | < $2.50 | Check Quality Score (Tool 2) and Auction Insights (Phase 4) |
| CTR | 8.73% | > 7% | Ad copy or keyword relevance problem |
| CVR | 5.75% | > 5% | Landing page, booking flow, or intent mismatch |
| CPA | $73.70 (industry) | < $9 (SLE) | SLE target is 8x better than industry average because SLE's ticket prices are low ($82 median) and conversion path is simple |

**Decision logic:**
- If CPC is the problem → Tool 2 (Quality Score) and Phase 4 (Auction Insights)
- If CVR is the problem → landing page speed, mobile UX, ad-to-page message match, booking flow friction
- If both → fix CVR first (higher leverage, no cost to fix)

### Tool 2: Quality Score Analysis (Geddes)

Brad Geddes' reverse-engineered formula (derived from analysis of 15,000+ accounts, published on Search Engine Land):

```
Quality Score = 1 (base) + Expected CTR points + Ad Relevance points + Landing Page points
```

| Component | Below Average | Average | Above Average | Weight |
|-----------|--------------|---------|---------------|--------|
| Expected CTR | 0 pts | 1.75 pts | 3.5 pts | **39%** |
| Landing Page Experience | 0 pts | 1.75 pts | 3.5 pts | **39%** |
| Ad Relevance | 0 pts | 1.75 pts | 3.5 pts | **22%** |

**Target:** QS 7+ on all converting keywords (impression-weighted average across 107M impressions = 7.1).

**Fix priority:** Expected CTR and Landing Page carry 2x the weight of Ad Relevance. Focus on moving "Below Average" components up. Once a component reaches "Above Average," further improvement on that component provides no additional QS benefit.

**CPC relationship:** Every QS point increase reduces CPC. Improving QS from 5 to 8 reduces CPCs by 25-35% at identical ad positions.

**Data required:** `metrics.historical_quality_score`, keyword-level QS components (not available at campaign level, requires keyword-level GAQL query).

### Tool 3: Lin-Rodnitzky Ratio (3Q Digital)

A single number that tells you if your search term targeting is healthy without reading hundreds of queries.

```
L/R Ratio = Total Account CPA / Converting-Search-Terms-Only CPA
```

| Score | Diagnosis | Action |
|-------|-----------|--------|
| 1.0 - 1.5 | Too conservative. Very low waste but missing growth opportunities. | Loosen match types, add more keywords, test broader targeting. |
| 1.5 - 2.0 | Well-managed. Healthy balance of proven performers and experimental queries. | Maintain. This is the target range. |
| 2.0 - 2.5 | Too aggressive. Excessive spend on non-converting search terms. | Tighten match types, add negative keywords, review search terms report. |
| 2.5+ | Mismanaged. Significant budget waste on irrelevant queries. | Immediate search term audit. Likely missing critical negative keywords. |

**Data required:** Search terms report with conversion data. GAQL resource: `search_term_view` with `metrics.conversions` and `metrics.cost_micros`.

### Also in Phase 3

- **Search term waste analysis**: Sort search terms by spend, filter non-converters. Industry estimate: ~20% of Google Ads spend goes to irrelevant clicks. If waste exceeds 15% of spend, fix before any other optimization.
- **Negative keyword gap identification**: n-gram analysis of non-converting search terms to find patterns (common word fragments that consistently fail).
- **Match type performance comparison**: Broad vs. phrase vs. exact by CPA and conversion volume. Broad match without Smart Bidding and sufficient conversion data (30+/month) is typically wasteful.

### Data Requirements (Phase 3)

| Data | Source | GAQL Resource |
|------|--------|---------------|
| Keyword-level Quality Score | Google Ads API | `keyword_view` with `metrics.historical_quality_score`, `ad_group_criterion.quality_info.*` |
| Search terms with conversions | Google Ads API | `search_term_view` with `metrics.conversions`, `metrics.cost_micros`, `metrics.clicks` |
| Match type performance | Google Ads API | `keyword_view` with `ad_group_criterion.keyword.match_type` |

---

## Phase 4: Advanced (Future)

**Question answered:** "What's the competition doing? Is this seasonal? Is PMax helping or hurting?"

### PMax Sub-Framework (Kirk Williams, ZATO Marketing)

Performance Max is a black box. Kirk Williams' 6-step diagnostic (from ZATO, Top 3 PPC expert PPCSurvey 2025) works from the outside in. The first five steps rule out external factors before blaming PMax itself.

1. **Check the calendar** — Is this seasonal? Compare YoY across all channels, not week-over-week.
2. **Look across channels** — Is Meta also down? Email? Organic? If everything dropped, it's not a PMax problem.
3. **Assess business changes** — Did pricing change? New routes? Route cancellations? Booking flow updates?
4. **Consider broader context** — Economy, fuel prices, competitor launches, weather events.
5. **Audit your account** — Conversion tracking broken? Other campaign changes that shifted budget?
6. **Only then dig into PMax** — Search terms (since late 2025, PMax shows search term data), channel allocation, asset performance, landing page distribution.

**PMax-specific benchmarks (Optmyzr study, 24,702 campaigns):**
- Optimal PMax budget allocation: 10-25% of total budget (SLE: $1,500-$3,750/month at current spend)
- 91% of accounts have keyword overlap between Search and PMax. Search wins on conversion performance nearly 2x as often.
- Brand exclusions are mandatory. Without them, PMax inflates its metrics by capturing branded searches that would convert anyway.

**PMax brand cannibalization detection:** Compare total account conversions before and after PMax launch/scaling. If PMax shows great ROAS but total conversions are flat, PMax is stealing from Search, not adding incremental value.

### Auction Insights / Competition Analysis

Google Ads Auction Insights shows who else is bidding on your keywords and how you compare.

| Metric | What It Tells You |
|--------|-------------------|
| Impression Share | Your share vs. competitors |
| Overlap Rate | How often a competitor appears alongside you |
| Outranking Share | How often you rank above a competitor |
| Position Above Rate | How often a competitor's ad appears above yours |

**Use cases:**
- New competitor entering the market (sudden overlap rate increase)
- Competitor getting more aggressive (outranking share declining)
- Brand defense: who's bidding on "Salt Lake Express"?

**Data required:** GAQL resource `auction_insight` (campaign or ad group level).

### Seasonality / YoY Analysis

SLE is a regional transportation company. Seasonality is massive:
- Ski season (December-March): Higher demand on resort routes
- Summer travel (June-August): Higher demand on national park routes
- Holiday peaks: Thanksgiving, Christmas, Spring Break

**Implementation approach:** Always show YoY same-month comparison alongside MoM. A CPA increase from February to March might be seasonal, not a problem. A CPA increase vs. March last year is a real signal.

Per-route seasonality analysis requires campaign-level data mapped to route segments (SLE's campaign naming includes route info: `SLE`, `STGEO`, `NWS`).

### Brand Campaign Incrementality

At $10-15K/month total spend, brand campaigns should consume 10-15% ($1,000-$1,500). Key questions:

- **Are competitors bidding on "Salt Lake Express"?** Check Auction Insights on brand campaigns. If fewer than 2 competitors with <10% impression share, you likely don't need a brand campaign.
- **Testing incrementality:** Geographic holdout test. Pause brand ads in select regions for 3-4 weeks, compare to regions where ads remain active. Cost: ~$5K in potential lost revenue. Payoff: knowing whether brand spend is necessary.
- **Warning sign for overspending:** If branded clicks far exceed branded conversions, or if brand spend exceeds 20% of total budget without competitor pressure.

---

## Implementation Quick Reference

### SLE Google Ads Thresholds (reusable constant)

```typescript
export const GOOGLE_ADS_THRESHOLDS = {
  // Decision metrics (same as Meta - derived from SLE unit economics)
  cpa_on_target: 9,        // <$9 = green
  cpa_elevated: 14,        // $9-$14 = yellow, >$14 = red
  roas_floor: 3.0,         // >= 3.0x = healthy
  roas_watch: 2.0,         // 2.0-3.0x = watch, <2.0x = red
  over_attribution: 1.3,   // Google over-reports by ~30%
  gp_per_order: 35.23,     // Gross profit per booking
  gross_margin: 0.43,      // 43% regular route gross margin

  // Impression Share targets
  brand_is_target: 0.90,       // 90% for brand campaigns
  non_brand_is_target: 0.65,   // 65% for non-brand
  lost_is_budget_flag: 0.10,   // >10% lost to budget = flag

  // Campaign categorization (Vallaeys)
  star_min_conversions: 10,     // 10+ conversions/month = Star candidate
  zombie_max_conversions: 5,    // <5 conversions/month = Zombie
  bleeder_min_spend: 500,       // $500+/month spend with bad CPA = Bleeder

  // Conversion volume trends
  volume_decline_watch: 0.10,   // 10% MoM decline = yellow
  volume_decline_alert: 0.20,   // 20% MoM decline = red

  // Future (Phase 3)
  qs_target: 7,                 // Quality Score 7+ on converting keywords
  lr_ratio_low: 1.5,            // Below 1.5 = too conservative
  lr_ratio_high: 2.0,           // Above 2.0 = too aggressive
  search_term_waste_flag: 0.15, // >15% spend on irrelevant terms = flag
} as const;
```

### Existing Code Paths

| File | What It Does | Phase |
|------|-------------|-------|
| `src/lib/services/google-ads.ts` | `getMonthlySpend(period)` — fetches campaign data via GAQL | 1 |
| `src/lib/schemas/sources/google-ads.ts` | `GoogleAdsCampaignRow` type definition | 1 |
| `src/lib/schemas/transformers/google-ads.ts` | `normalizeGoogleAdsData()` — raw to normalized | 1 |
| `src/lib/workflows.ts` | Workflow definition (slug: `google-ads-analysis`, status: `coming-soon`) | 1 |
| `src/lib/workflows/evaluations/meta-ads-monthly.ts` | `SLE_THRESHOLDS` — pattern to replicate | 1 |
| `src/lib/workflows/executors/fetch-meta-ads.ts` | Executor pattern to follow | 1 |
| `src/lib/workflows/prompts/meta-ads.ts` | Prompt pattern to follow | 1 |
| `src/lib/services/bigquery-sales.ts` | `getSalesOrders()` — ground truth booking data | 1 |
| `src/lib/workflows/executors/index.ts` | Executor registry (add Google Ads) | 1 |
| `src/lib/workflows/prompts/index.ts` | Prompt registry (add Google Ads) | 1 |

### New Files Per Phase

**Phase 1:**
- `src/lib/workflows/executors/fetch-google-ads.ts`
- `src/lib/schemas/sources/google-ads-metrics.ts`
- `src/lib/workflows/prompts/google-ads.ts`

**Phase 2:**
- Extend `google-ads.ts` service with IS fields in GAQL query
- Extend `google-ads.ts` schema with IS and channel type fields
- Add categorization logic to executor

**Phase 3:**
- New GAQL queries: keyword-level QS, search term view
- New service functions: `getKeywordQualityScores()`, `getSearchTerms()`
- L/R Ratio calculator utility

**Phase 4:**
- New GAQL queries: auction insights
- PMax-specific service functions
- Seasonality comparison utilities (YoY by route segment)

### SLE Campaign Structure (for segmentation logic)

Active campaigns as of December 2025 (68 total). Key naming patterns:

| Pattern | Segment | Example |
|---------|---------|---------|
| `SLE \| Search \| Brand` | Brand | Brand defense |
| `SLE \| Search \| Non-Branded` | Non-Brand | Core acquisition |
| `STGEO \| Search \| Non-Branded` | Non-Brand | St. George routes |
| `NWS \| ...` | Non-Brand | Northwestern Stage Lines |
| `SLE \| Search \| Competitors` | Competitor | Competitor conquesting |
| `Charters - P-Max` | PMax | Charter services |
| `SLE Charters` | Non-Brand | Charter search |
| `GMA \| Video Remarketing` | Video | Remarketing |

Approximate monthly spend distribution (sample data):
- Non-Branded Search: ~$7,000-8,000 (50-60%)
- Competitor Search: ~$1,400 (10%)
- Brand Search: ~$500 (3-5%)
- PMax: ~$1,000 (7%)
- Charters: ~$2,600 (18%)
- Video: ~$300 (2%)

### Travel Industry Benchmarks (WordStream 2025)

For calibrating SLE performance against peers:

| Metric | Travel Industry Average | Cross-Industry Average |
|--------|------------------------|----------------------|
| CPC | $2.12 | $5.26 |
| CTR | 8.73% | 6.66% |
| CVR | 5.75% | 7.52% |
| CPA | $73.70 | $70.11 |

SLE's <$9 CPA target is 8x better than the travel industry average. This is achievable because SLE sells low-cost tickets ($82 median) with a simple online booking flow, driving higher conversion rates than the industry average for branded and high-intent route queries.
