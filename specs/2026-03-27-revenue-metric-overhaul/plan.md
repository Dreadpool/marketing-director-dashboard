# Revenue Metric Overhaul: Gross Bookings as Primary KPI

## Problem

The current revenue calculation mixes two incompatible frameworks: CardPointe net (actual CC money movement) for credit cards and cancel-adjusted gross for cash/other. This causes double-counting when customers cancel CC charges, receive account credit, and rebook using that credit.

## Decision

Use **Gross Bookings** as the primary revenue metric, consistent with travel industry standards (FlixBus, airlines, OTAs). A marketing director's job is to drive demand. Whether a customer pays with a credit card or account credit, the booking represents demand that marketing influenced.

CardPointe data remains for cross-validation of the CC settlement number, not for overriding the revenue calculation.

## New KPI Structure

| KPI | What it measures | Calculation |
|-----|-----------------|-------------|
| **Gross Bookings** (hero) | Total demand generated | Sum of payment_amount_1-4 across all Sale records (excluding voids), all payment types |
| **Net Bookings** (supporting) | Bookings that held | Gross Bookings minus cancellation amounts |
| **Net Booking Rate** (supporting) | Booking quality | Net Bookings / Gross Bookings as % |
| **New Cash** (detail) | Fresh money in the door | CC + cash + other payment amounts only (excludes account credits, corporate) |

## Key Changes

1. Remove CardPointe override of CC net revenue
2. Expand MasterMetricsRevenue with gross_bookings, net_bookings, net_booking_rate, new_cash, by_category breakdown
3. Update HeadlineMetrics UI: 3 hero financial cards + 3 operational cards
4. Update RevenueBreakdown table: show gross/cancels/net per category
5. Update AI prompts: "Gross Bookings" replaces "Revenue" terminology
6. Rename dashboard "Revenue" card to "Gross Bookings"
