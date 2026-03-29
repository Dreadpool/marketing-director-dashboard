# Revenue Metric Overhaul: Shaping Notes

## Analysis Context

Compared sales order data to CardPointe authorization data across March-December 2025. Found the double-counting pattern: when a customer cancels a CC charge, CardPointe doesn't issue a refund (money stays with the company), so CC revenue stays high. When the customer later rebooks using account credit, that revenue is also counted. Same dollars counted twice across two months.

## Why Gross Bookings

- Travel industry standard (FlixBus, airlines, OTAs use gross bookings as primary KPI)
- Marketing director's job is demand generation, not cash collection
- Account credit bookings represent real demand that marketing influenced
- Eliminates the incompatible framework mixing problem entirely

## Net Booking Rate Caveat

~45% of cancellations are reschedules (cancel + rebook), not lost revenue. The net booking rate will appear lower than true retention until reschedules are reliably identified in the data.

## CardPointe Cross-Validation

CardPointe settlement data provides an independent verification of CC revenue. If TDS CC net diverges from CardPointe settlement by >$1000, it flags a data quality issue worth investigating. This replaces the previous approach of using CardPointe as the source of truth for CC revenue.
