# Schema Overview

## Identity and Access
- **users** – Staff accounts with role metadata, login timestamps, and self-referential audit of who created records; indexed for email lookups and active user filters.
- **permissions** – Describes granular capabilities (resource/action) used to gate features in the app.
- **role_permissions** – Junction table mapping default role bundles to permissions for quick authorization checks.

## Guest and Partner Catalog
- **guests** – Traveler profiles with contact data, identification details, and preference blobs; optimized for name/email searches and VIP targeting.
- **agencies** – Travel agent and channel manager entities with commission rules and activation flags; supports filtering by code and active status.

## Rooms and Inventory
- **room_types** – Product definitions (code, occupancy, amenities) that drive pricing and availability displays.
- **rooms** – Physical inventory linked to room types, including status, accessibility, and maintenance metadata.

## Pricing and Promotions
- **rate_plans** – Configurable pricing products with booking restrictions and cancellation policies.
- **room_type_rates** – Calendar-based BAR tables tying room types to rate plans with day-of-week applicability.
- **room_type_rate_adjustments** – Differential pricing rules to derive related room type rates from a base.
- **promotions** – Discount programs with validity windows, usage caps, and optional room type targeting.

## Reservations and Stay Management
- **reservations** – Core booking records with guest snapshots, stay dates, source, financial totals, and status transitions.
- **reservation_rooms** – Allocations of inventory to reservations, capturing rate, room type, and stay window overlaps.
- **room_assignments** – Daily assignment ledger guaranteeing a single occupied room per night.
- **room_blocks** – Holds on rooms or room types for maintenance, VIP, or overbooking buffers with release tracking.

## Housekeeping and Maintenance
- **housekeeping_tasks** – Task queue for room servicing, assignments, and inspection workflows with SLA-related indexes.
- **maintenance_requests** – Work orders detailing issue priority, schedule, cost, and technician assignments.

## Finance and Billing
- **invoices** – Guest-facing billing documents with status lifecycle, balances, and tax breakdowns.
- **invoice_items** – Line-item detail supporting departmental revenue analysis and posting reconciliation.
- **payments** – Cashflow ledger capturing payment method, settlement data, refunds, and exchange rates.

## Reporting and Analytics
- **daily_revenue** – Aggregated operating metrics per calendar day for arrivals, occupancy, and departmental revenue.
- **monthly_revenue** – Month-level KPIs segmented by channel and amenity categories.
- **yearly_revenue** – Annual rollups for leadership dashboards and budgeting cycles.
- **daily_room_type_revenue** – Daily production by room type to monitor mix and yield.
- **daily_rate_revenue** – Daily production by rate plan to validate pricing strategy.

## Compliance and Audit
- **audit_log** – Append-only change history with before/after payloads, user attribution, and timestamp indexing for tracing.
