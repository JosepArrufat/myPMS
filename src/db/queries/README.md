# Query Helper Overview

The helpers wrap Drizzle ORM to keep feature code focused on intent while honoring index-friendly predicates.

## catalog/
- agencies.ts – Code lookups, fuzzy search with optional active filter, channel manager roster, and agency reservation listings (built for idx_agencies_name and idx_reservations_agency).
- guests.ts – Email lookup, broad name/email search, and VIP roster drill-down aligned with idx_guests_email and idx_guests_vip.
- promotions.ts – Fetches by code, active promotions for today, and overlap checks for stay windows using promotions_active_valid and promotions_dates indexes.
- rate-plans.ts – Retrieves plans by code, active products, and stay-range eligibility filters relying on rate plan validity attributes.
- room-type-rate-adjustments.ts – Lists derived pricing rules for a base or derived room type.
- room-type-rates.ts – Resolves rates overlapping a stay window and enumerates plan pricing windows leveraging idx_room_type_rates_lookup.
- room-types.ts – Provides active catalog ordering and direct lookups by code.
- rooms.ts – Room number lookup plus filters for a room type or availability state.

## finance/
- invoices.ts – Invoice number lookup, guest statement history, outstanding/overdue billing queues, and number search against invoice indexes.
- invoice-items.ts – Lists line items for an invoice or aggregates in a service date range.
- payments.ts – Invoice payment history, time-based cashflow pulls, and refund isolation via payment method indexes.

## housekeeping/
- housekeeping-tasks.ts – Day sheets, room history, and workload views for assignees, tuned for housekeeping workload indexes.

## identity/
- users.ts – Email lookup, role-filtered staff rosters, and directory search against idx_users_email and sort fields.
- permissions.ts – Lists all permission tuples or resolves a single resource/action pair.
- role-permissions.ts – Quickly enumerates bundled permissions per role and the roles attached to a permission.

## maintenance/
- maintenance-requests.ts – Surfaces open work orders, scheduled jobs after a given date, and urgent open issues using maintenance status/priority indexes.

## reporting/
- daily-revenue.ts – Retrieves a specific day or a date range of revenue KPIs.
- daily-rate-revenue.ts – Rate-plan performance over a window.
- daily-room-type-revenue.ts – Room-type production trend for a range.
- monthly-revenue.ts – Month rollup fetches and range pulls.
- yearly-revenue.ts – Yearly summaries across a span.

## reservations/
- reservations.ts – Booking number lookup, guest history, active stay window search, daily arrivals/departures, and agency stay reporting aligned with reservations_* indexes.
- reservation-rooms.ts – Room allocation listing and conflict detection for rooms or room types utilizing availability indexes.
- room-assignments.ts – Assignment views by date or by reservation number, honoring unique room/date constraints.
- room-blocks.ts – Active block overlap queries and room-focused block history.

## audit/
- audit-log.ts – Change history fetches for a record and user-centric audit trails with timestamp filtering.
