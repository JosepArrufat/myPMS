# Hotel PMS — Database Tables

A visual walkthrough of every table in the system with sample data.
FK references are noted with → arrows.

---

## 🔑 Identity & Access

### users

Staff accounts. Every action in the system tracks a `created_by` / `modified_by` back to this table.

| id | email | first_name | last_name | role | is_active |
|---:|:------|:-----------|:----------|:-----|:---------:|
| 1 | ana@hotel.com | Ana | Martins | admin | ✓ |
| 2 | carlos@hotel.com | Carlos | Silva | front_desk | ✓ |
| 3 | maria@hotel.com | Maria | López | housekeeping | ✓ |

> **role** enum: `admin`, `manager`, `front_desk`, `housekeeping`, `accountant`, `sales`, `guest_services`

### permissions

Fine-grained resource + action pairs (e.g. "can update reservations").

| id | resource | action | description |
|---:|:---------|:-------|:------------|
| 1 | reservations | create | Create new reservations |
| 2 | reservations | cancel | Cancel existing reservations |
| 3 | invoices | view | View invoice details |

### role_permissions

Maps roles → permissions (composite PK). → `users.role`, → `permissions.id`

| role | permission_id |
|:-----|:-------------:|
| admin | 1 |
| admin | 2 |
| front_desk | 1 |

---

## 👤 Guests

### guests

Guest profiles with contact info, ID documents, and preferences (jsonb).

| id | first_name | last_name | email | nationality | vip_status | preferences |
|:---|:-----------|:----------|:------|:------------|:----------:|:------------|
| g-0001 | John | Smith | john@email.com | US | ✗ | `{"floor":"high","bedType":"king"}` |
| g-0002 | Sophie | Müller | sophie@email.de | DE | ✓ | `{"pillowType":"soft"}` |
| g-0003 | Yuki | Tanaka | yuki@email.jp | JP | ✗ | `null` |

> **id_document_type** enum: `passport`, `national_id`, `drivers_license`, `residence_permit`, `other`

---

## 🏨 Rooms & Room Types

### room_types

Categories of rooms. Each has a base price, occupancy limits, and amenities.

| id | name | code | base_price | total_rooms | max_occupancy | amenities |
|---:|:-----|:-----|:-----------|:------------|:-------------|:----------|
| 1 | Standard | STD | 89.00 | 20 | 2 | `["wifi","tv"]` |
| 2 | Deluxe | DLX | 149.00 | 10 | 3 | `["wifi","tv","minibar"]` |
| 3 | Suite | STE | 259.00 | 5 | 4 | `["wifi","tv","minibar","jacuzzi"]` |

### rooms

Physical rooms. Each belongs to a room_type. → `room_types.id`

| id | room_number | room_type_id | floor | status | cleanliness_status |
|---:|:------------|:-------------|------:|:-------|:-------------------|
| 1 | 101 | 1 (STD) | 1 | available | clean |
| 2 | 102 | 1 (STD) | 1 | occupied | dirty |
| 3 | 201 | 2 (DLX) | 2 | available | inspected |
| 4 | 301 | 3 (STE) | 3 | out_of_order | dirty |

> **room_status** enum: `available`, `occupied`, `maintenance`, `out_of_order`, `blocked`
> **cleanliness_status** enum: `clean`, `dirty`, `inspected`

---

## 🗓️ Reservations

### reservations

The core booking record. → `guests.id`, → `agencies.id`, → `rate_plans.id`

| id | reservation_number | guest_id | check_in_date | check_out_date | status | total_amount | source |
|:---|:-------------------|:---------|:--------------|:---------------|:-------|:-------------|:-------|
| r-0001 | RES-20260301-001 | g-0001 | 2026-03-01 | 2026-03-04 | confirmed | 447.00 | website |
| r-0002 | RES-20260305-002 | g-0002 | 2026-03-05 | 2026-03-07 | checked_in | 518.00 | agency |
| r-0003 | RES-20260310-003 | g-0003 | 2026-03-10 | 2026-03-11 | cancelled | 89.00 | phone |

> **reservation_status** enum: `pending`, `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show`

### reservation_rooms

Which room types (and optionally physical rooms) a reservation includes. One reservation can have multiple rooms. → `reservations.id`, → `rooms.id`, → `room_types.id`

| id | reservation_id | room_type_id | room_id | check_in_date | check_out_date | assigned_at |
|---:|:---------------|:-------------|:--------|:--------------|:---------------|:------------|
| 1 | r-0001 | 1 (STD) | 1 | 2026-03-01 | 2026-03-04 | 2026-02-28 |
| 2 | r-0002 | 2 (DLX) | 3 | 2026-03-05 | 2026-03-07 | 2026-03-04 |

### reservation_daily_rates

Per-night rate breakdown for each reservation room. → `reservation_rooms.id`, → `rate_plans.id`

| id | reservation_room_id | date | rate | rate_plan_id |
|---:|:---------------------|:-----|:-----|:-------------|
| 1 | 1 | 2026-03-01 | 149.00 | 1 |
| 2 | 1 | 2026-03-02 | 149.00 | 1 |
| 3 | 1 | 2026-03-03 | 149.00 | 1 |

### room_assignments

Physical room → date assignments. Prevents double-booking a room on the same night. → `reservations.id`, → `rooms.id`

| id | reservation_id | room_id | date | assigned_by |
|---:|:---------------|:--------|:-----|:------------|
| 1 | r-0001 | 1 | 2026-03-01 | 2 |
| 2 | r-0001 | 1 | 2026-03-02 | 2 |
| 3 | r-0001 | 1 | 2026-03-03 | 2 |

### room_blocks

Blocks a room or room type for a date range (maintenance, VIP hold, etc.). → `rooms.id`, → `room_types.id`

| id | room_id | start_date | end_date | block_type | reason | released_at |
|---:|:--------|:-----------|:---------|:-----------|:-------|:------------|
| 1 | 4 | 2026-03-01 | 2026-03-10 | maintenance | Plumbing repair | `null` |
| 2 | `null` | 2026-04-01 | 2026-04-03 | group_hold | Conference block | `null` |

> **room_block_type** enum: `maintenance`, `renovation`, `group_hold`, `overbooking_buffer`, `vip_hold`

---

## 📦 Inventory

### room_inventory

Per-day availability counter for each room type. Decremented on booking, incremented on cancellation. → `room_types.id`

| id | room_type_id | date | capacity | available |
|---:|:-------------|:-----|:---------|:----------|
| 1 | 1 (STD) | 2026-03-01 | 20 | 19 |
| 2 | 1 (STD) | 2026-03-02 | 20 | 20 |
| 3 | 2 (DLX) | 2026-03-01 | 10 | 9 |

---

## 💰 Pricing

### rate_plans

Pricing strategies (e.g. "Flexible", "Non-refundable", "Corporate"). Linked to reservations and daily rates.

| id | name | code | includes_breakfast | cancellation_deadline_hours | is_active |
|---:|:-----|:-----|:------------------:|:--------------------------:|:---------:|
| 1 | Flexible | FLEX | ✓ | 24 | ✓ |
| 2 | Non-Refundable | NREF | ✗ | `null` | ✓ |
| 3 | Corporate | CORP | ✓ | 48 | ✓ |

### room_type_rates

Price per room type per rate plan per date range. → `room_types.id`, → `rate_plans.id`

| id | room_type_id | rate_plan_id | start_date | end_date | price |
|---:|:-------------|:-------------|:-----------|:---------|:------|
| 1 | 1 (STD) | 1 (FLEX) | 2026-03-01 | 2026-03-31 | 99.00 |
| 2 | 2 (DLX) | 1 (FLEX) | 2026-03-01 | 2026-03-31 | 159.00 |
| 3 | 1 (STD) | 2 (NREF) | 2026-03-01 | 2026-03-31 | 79.00 |

### room_type_rate_adjustments

Derive one room type's price from another (e.g. Suite = Deluxe + €100). → `room_types.id` (base & derived), → `rate_plans.id`

| id | base_room_type_id | derived_room_type_id | adjustment_type | adjustment_value |
|---:|:------------------|:---------------------|:----------------|:-----------------|
| 1 | 2 (DLX) | 3 (STE) | amount | 100.00 |

> **rate_adjustment_type** enum: `amount`, `percent`

---

## 🏢 Agencies

### agencies

Travel agencies and corporate accounts that send reservations. → linked from `reservations.agency_id`

| id | name | code | type | commission_percent | is_active |
|---:|:-----|:-----|:-----|:-------------------|:---------:|
| 1 | Booking.com | BKG | agency | 15.00 | ✓ |
| 2 | Acme Corp | ACME | company | 10.00 | ✓ |

> **agency_type** enum: `agency`, `company`

---

## 🎁 Promotions

### promotions

Discount codes with validity rules and usage limits.

| id | code | name | discount_type | discount_value | valid_from | valid_to | uses_count | max_uses |
|---:|:-----|:-----|:--------------|:---------------|:-----------|:---------|:-----------|:---------|
| 1 | SUMMER10 | Summer 10% Off | percent | 10.00 | 2026-06-01 | 2026-08-31 | 5 | 100 |
| 2 | WELCOME | Welcome €20 Off | amount | 20.00 | 2026-01-01 | 2026-12-31 | 12 | `null` |

---

## 🧾 Billing

### invoices

Financial document tied to a reservation. Tracks amounts, tax, balance. → `reservations.id`, → `guests.id`

| id | invoice_number | reservation_id | guest_id | status | subtotal | tax_amount | total_amount | paid_amount | balance |
|:---|:---------------|:---------------|:---------|:-------|:---------|:-----------|:-------------|:------------|:--------|
| inv-0001 | INV-1001 | r-0001 | g-0001 | paid | 447.00 | 0.00 | 447.00 | 447.00 | 0.00 |
| inv-0002 | INV-1002 | r-0002 | g-0002 | partially_paid | 518.00 | 0.00 | 518.00 | 200.00 | 318.00 |

> **invoice_status** enum: `draft`, `issued`, `paid`, `partially_paid`, `overdue`, `void`, `refunded`
> **invoice_type** enum: `final`, `deposit`, `adjustment`, `cancellation`

### invoice_items

Line items on an invoice (room nights, minibar, spa, etc.). → `invoices.id`, → `rooms.id`

| id | invoice_id | item_type | description | quantity | unit_price | total |
|---:|:-----------|:----------|:------------|:---------|:-----------|:------|
| 1 | inv-0001 | room | Room night - 2026-03-01 | 1 | 149.00 | 149.00 |
| 2 | inv-0001 | room | Room night - 2026-03-02 | 1 | 149.00 | 149.00 |
| 3 | inv-0001 | minibar | Minibar charges | 1 | 25.00 | 25.00 |

> **invoice_item_type** enum: `room`, `food`, `beverage`, `minibar`, `laundry`, `spa`, `parking`, `telephone`, `internet`, `other`

### payments

Money in (or out for refunds). Each payment is linked to an invoice. → `invoices.id`

| id | invoice_id | amount | payment_method | is_refund | payment_date |
|---:|:-----------|:-------|:---------------|:---------:|:-------------|
| 1 | inv-0001 | 447.00 | credit_card | ✗ | 2026-03-04 |
| 2 | inv-0002 | 200.00 | cash | ✗ | 2026-03-05 |
| 3 | inv-0001 | 25.00 | credit_card | ✓ | 2026-03-06 |

> **payment_method** enum: `cash`, `credit_card`, `debit_card`, `bank_transfer`, `cheque`, `online_payment`, `corporate_account`

---

## 🧹 Housekeeping

### housekeeping_tasks

Cleaning and preparation tasks assigned to rooms. Created on checkout or manually. → `rooms.id`, → `users.id` (assigned_to, inspected_by)

| id | room_id | task_date | task_type | status | assigned_to | priority |
|---:|:--------|:----------|:----------|:-------|:------------|:---------|
| 1 | 2 | 2026-03-04 | checkout_cleaning | assigned | 3 (Maria) | 0 |
| 2 | 3 | 2026-03-04 | inspection | completed | 3 (Maria) | 0 |
| 3 | 1 | 2026-03-05 | vip_setup | pending | `null` | 1 |

> **housekeeping_task_type** enum: `client_service`, `checkout_cleaning`, `maintenance_prep`, `carpet_cleaning`, `deep_cleaning`, `vip_setup`, `turndown_service`, `linen_change`, `inspection`, `special_request`
> **housekeeping_task_status** enum: `pending`, `assigned`, `in_progress`, `completed`, `cancelled`, `inspected`

---

## 🔧 Maintenance

### maintenance_requests

Repair and maintenance work orders for rooms. → `rooms.id`, → `users.id` (assigned_to)

| id | room_id | category | priority | description | status | cost |
|---:|:--------|:---------|:---------|:------------|:-------|:-----|
| 1 | 4 | plumbing | urgent | Leaking pipe in bathroom | in_progress | `null` |
| 2 | 2 | electrical | low | Flickering bedside lamp | completed | 15.00 |

> **maintenance_priority** enum: `low`, `normal`, `high`, `urgent`
> **maintenance_status** enum: `open`, `in_progress`, `completed`, `cancelled`

---

## 📝 Audit

### audit_log

Immutable log of all data changes across the system. → `users.id`

| id | table_name | record_id | action | changed_fields | user_id | timestamp |
|---:|:-----------|:----------|:-------|:---------------|:--------|:----------|
| 1 | reservations | r-0001 | update | `["status"]` | 2 | 2026-03-01 09:15 |
| 2 | rooms | 4 | update | `["status"]` | 1 | 2026-03-01 10:30 |
| 3 | invoices | inv-0001 | insert | `null` | 2 | 2026-03-04 14:00 |

> **audit_action** enum: `insert`, `update`, `delete`

---

## 📊 Reporting (Materialized / Aggregated)

Pre-calculated summaries used for dashboards and reports. Not edited directly — populated by scheduled jobs or triggers.

### daily_revenue

One row per day. Aggregated booking counts, revenue by category, and KPIs.

| date | total_reservations | room_revenue | food_revenue | occupancy_rate | average_daily_rate |
|:-----|:-------------------|:-------------|:-------------|:---------------|:-------------------|
| 2026-03-01 | 12 | 1580.00 | 230.00 | 0.8500 | 131.67 |
| 2026-03-02 | 10 | 1320.00 | 180.00 | 0.7500 | 132.00 |

### monthly_revenue

One row per month. Same structure as daily but aggregated monthly.

| month | total_reservations | total_revenue | avg_occupancy_rate | avg_daily_rate |
|:------|:-------------------|:--------------|:-------------------|:---------------|
| 2026-03-01 | 285 | 42350.00 | 0.7800 | 128.50 |

### yearly_revenue

One row per year. Annual totals and averages.

| year | total_reservations | total_revenue | avg_occupancy_rate | avg_daily_rate |
|:-----|:-------------------|:--------------|:-------------------|:---------------|
| 2025 | 3420 | 498000.00 | 0.7200 | 118.30 |
| 2026 | 285 | 42350.00 | 0.7800 | 128.50 |

### daily_room_type_revenue

Revenue breakdown per room type per day. → `room_types.id`

| date | room_type_id | rooms_sold | revenue | average_rate |
|:-----|:-------------|:-----------|:--------|:-------------|
| 2026-03-01 | 1 (STD) | 15 | 1335.00 | 89.00 |
| 2026-03-01 | 2 (DLX) | 8 | 1192.00 | 149.00 |

### daily_rate_revenue

Revenue breakdown per rate plan per day.

| date | rate_plan_id | rooms_sold | room_revenue | average_rate |
|:-----|:-------------|:-----------|:-------------|:-------------|
| 2026-03-01 | 1 (FLEX) | 10 | 1190.00 | 119.00 |
| 2026-03-01 | 2 (NREF) | 8 | 632.00 | 79.00 |

---

## Quick FK Map

```
guests ←── reservations ──→ agencies
                │             rate_plans ──→ room_type_rates ──→ room_types
                │                              room_type_rate_adjustments ↗
                ├── reservation_rooms ──→ rooms ──→ room_types
                │       └── reservation_daily_rates
                ├── room_assignments ──→ rooms
                └── invoices ──→ invoice_items
                        └── payments

rooms ──→ housekeeping_tasks ──→ users
      ──→ maintenance_requests ──→ users
      ──→ room_blocks

room_types ──→ room_inventory
           ──→ daily_room_type_revenue

audit_log ──→ users
```
