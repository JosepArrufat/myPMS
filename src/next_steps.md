# Next Steps — myPMS API & Frontend Plan

> Last updated: 2026-02-19

---

## Phase 1 · HTTP API Routes

Every route below maps to an existing query or service function.
Group the routes in `src/routes/<domain>.ts` files and wire them into `app.ts`.

### 1.1 Identity & Auth

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/auth/login` | authenticate user, return JWT | `queries/identity/users.findUserByEmail` + bcrypt |
| GET | `/api/auth/me` | current user profile | JWT middleware |
| GET | `/api/users` | list active users (admin) | `queries/identity/users.listActiveUsersByRole` |
| GET | `/api/users/search?q=` | search users | `queries/identity/users.searchUsers` |
| GET | `/api/permissions` | list permissions | `queries/identity/permissions.listPermissions` |
| GET | `/api/roles/:role/permissions` | role permissions | `queries/identity/role-permissions.listPermissionsForRole` |

### 1.2 Catalog — Room Types & Rooms

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| GET | `/api/room-types` | list all room types | `queries/catalog/room-types.listActiveRoomTypes` |
| GET | `/api/room-types/:id` | room type detail | `queries/catalog/rooms.findRoomTypeById` |
| POST | `/api/room-types` | create room type | `queries/catalog/rooms.createRoomType` |
| PATCH | `/api/room-types/:id` | update room type | `queries/catalog/rooms.updateRoomType` |
| GET | `/api/rooms` | list rooms (filter by type) | `queries/catalog/rooms.listRoomsByType` |
| GET | `/api/rooms/available` | available rooms | `queries/catalog/rooms.listAvailableRooms` |
| GET | `/api/rooms/:number` | room by number | `queries/catalog/rooms.findRoomByNumber` |
| POST | `/api/rooms` | create room | `queries/catalog/rooms.createRoom` |
| PATCH | `/api/rooms/:id` | update room | `queries/catalog/rooms.updateRoom` |

### 1.3 Rate Plans & Pricing

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| GET | `/api/rate-plans` | list active rate plans | `queries/catalog/rate-plans.listActiveRatePlans` |
| GET | `/api/rate-plans/:code` | find by code | `queries/catalog/rate-plans.findRatePlanByCode` |
| POST | `/api/rate-plans` | create rate plan | `queries/catalog/rate-plans.createRatePlan` |
| PATCH | `/api/rate-plans/:id` | update rate plan | `queries/catalog/rate-plans.updateRatePlan` |
| GET | `/api/rate-plans/stay?checkIn=&checkOut=` | plans for stay | `queries/catalog/rate-plans.listRatePlansForStay` |
| POST | `/api/room-type-rates` | set room type rate | `services/rate-management.setRoomTypeRate` |
| GET | `/api/room-type-rates/effective` | get effective rate | `services/rate-management.getEffectiveRate` |
| GET | `/api/room-type-rates/derived` | get derived rate | `services/rate-management.getDerivedRate` |
| POST | `/api/room-type-rates/propagate` | **update base + propagate** | `services/rate-management.updateBaseRateAndPropagate` |
| POST | `/api/rate-adjustments` | create adjustment rule | `services/rate-management.createRateAdjustment` |
| GET | `/api/rate-adjustments/base/:id` | list for base type | `queries/catalog/room-type-rate-adjustments.listAdjustmentsForBaseType` |

### 1.4 Availability & Inventory

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| GET | `/api/availability/check` | check room type availability | `services/availability.checkAvailability` |
| GET | `/api/availability/room-types` | all types with availability | `services/availability.getAvailableRoomTypes` |
| GET | `/api/availability/blocks` | blocked rooms in range | `services/availability.getBlockedRooms` |
| GET | `/api/availability/overbook` | can overbook? | `services/availability.canOverbook` |
| POST | `/api/inventory/seed` | seed inventory for room type | `services/inventory.seedInventory` |
| POST | `/api/inventory/seed-all` | seed all room types | `services/inventory.seedAllRoomTypeInventory` |
| GET | `/api/rooms/:id/available-now` | single room available now | `queries/catalog/rooms-availability.isRoomAvailableNow` |
| GET | `/api/availability/day/:date` | by-day breakdown | `queries/catalog/rooms.getAvailabilityByDay` |

### 1.5 Guests

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| GET | `/api/guests` | search guests | `queries/catalog/guests.searchGuests` |
| GET | `/api/guests/:id` | find by id | `queries/catalog/guests.findGuestById` |
| GET | `/api/guests/email/:email` | find by email | `queries/catalog/guests.findGuestByEmail` |
| POST | `/api/guests` | create guest | `queries/catalog/guests.createGuest` |
| PATCH | `/api/guests/:id` | update guest | `queries/catalog/guests.updateGuest` |
| GET | `/api/guests/vip` | list VIP guests | `services/guest.listVipGuests` |
| PATCH | `/api/guests/:id/vip` | set VIP status | `services/guest.setVipStatus` |
| PATCH | `/api/guests/:id/loyalty` | set loyalty number | `services/guest.setLoyaltyNumber` |
| GET | `/api/guests/:id/history` | guest stay history | `services/guest.getGuestHistory` |
| GET | `/api/guests/duplicates` | find duplicates | `services/guest.findDuplicates` |
| POST | `/api/guests/merge` | merge two guests | `services/guest.mergeGuests` |
| GET | `/api/guests/search/document` | search by document | `services/guest.searchGuestsByDocument` |
| GET | `/api/guests/search/phone` | search by phone | `services/guest.searchGuestsByPhone` |
| GET | `/api/guests/search/fuzzy` | fuzzy name search | `services/guest.searchGuestsFuzzy` |

### 1.6 Agencies

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| GET | `/api/agencies` | search agencies | `queries/catalog/agencies.searchAgencies` |
| GET | `/api/agencies/:code` | find by code | `queries/catalog/agencies.findAgencyByCode` |
| POST | `/api/agencies` | create agency | `queries/catalog/agencies.createAgency` |
| PATCH | `/api/agencies/:id` | update agency | `queries/catalog/agencies.updateAgency` |
| GET | `/api/agencies/:id/reservations` | agency reservations | `queries/catalog/agencies.listAgencyReservations` |

### 1.7 Reservations

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/reservations` | create reservation | `queries/reservations/reservations.createReservation` |
| GET | `/api/reservations/:number` | find by number | `queries/reservations/reservations.findReservationByNumber` |
| GET | `/api/reservations/guest/:id` | guest reservations | `queries/reservations/reservations.listGuestReservations` |
| GET | `/api/reservations/arrivals/:date` | arrivals for date | `queries/reservations/reservations.listArrivalsForDate` |
| GET | `/api/reservations/departures/:date` | departures for date | `queries/reservations/reservations.listDeparturesForDate` |
| GET | `/api/reservations/stay-window` | reservations in window | `queries/reservations/reservations.listReservationsForStayWindow` |
| GET | `/api/reservations/agency/:id` | by agency | `queries/reservations/reservations.listReservationsForAgency` |
| POST | `/api/reservations/:id/confirm` | confirm | `services/reservation-lifecycle.confirmReservation` |
| POST | `/api/reservations/:id/check-in` | check in | `services/checkin.checkInReservation` |
| POST | `/api/reservations/:id/check-out` | check out | `services/checkout.checkoutReservation` |
| POST | `/api/reservations/:id/cancel` | cancel | `services/reservation-lifecycle.cancelReservation` |
| POST | `/api/reservations/:id/no-show` | mark no-show | `services/reservation-lifecycle.markNoShow` |
| GET | `/api/reservations/:id/status` | status info | `services/reservation-lifecycle.getReservationStatus` |
| POST | `/api/reservations/:id/rate-override` | override daily rate | `services/rate-management.overrideReservationRate` |
| POST | `/api/reservations/:id/recalculate` | recalc total | `services/rate-management.recalculateReservationTotal` |

### 1.8 Reservation Rooms & Assignments

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| GET | `/api/reservations/:id/rooms` | rooms for reservation | `queries/reservations/reservation-rooms.listRoomsForReservation` |
| POST | `/api/reservations/:id/assign-room` | assign room | `services/room-assignment.assignRoom` |
| DELETE | `/api/reservations/:id/unassign-room` | unassign room | `services/room-assignment.unassignRoom` |
| GET | `/api/room-assignments/:date` | assignments for date | `queries/reservations/room-assignments.listAssignmentsForDate` |
| GET | `/api/room-conflicts` | check conflicts | `queries/reservations/reservation-rooms.findRoomConflicts` |

### 1.9 Group Reservations & Blocks

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/groups` | create group reservation | `services/group-reservation.createGroupReservation` |
| GET | `/api/groups/:id/rooming-list` | rooming list | `services/group-reservation.getGroupRoomingList` |
| POST | `/api/blocks` | create group block | `services/group-reservation.createGroupBlock` |
| GET | `/api/blocks/:id/pickup` | block pickup | `services/group-reservation.getBlockPickup` |
| POST | `/api/blocks/:id/release` | release block | `services/group-reservation.releaseGroupBlock` |
| GET | `/api/blocks/active` | active blocks in range | `queries/reservations/room-blocks.listActiveBlocksForRange` |

### 1.10 Billing & Invoices

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/invoices/generate` | generate from reservation | `services/billing.generateInvoice` |
| GET | `/api/invoices/:number` | find by number | `queries/finance/invoices.findInvoiceByNumber` |
| GET | `/api/invoices/guest/:id` | guest invoices | `queries/finance/invoices.listGuestInvoices` |
| GET | `/api/invoices/outstanding` | outstanding invoices | `queries/finance/invoices.listOutstandingInvoices` |
| GET | `/api/invoices/overdue` | overdue invoices | `queries/finance/invoices.listOverdueInvoices` |
| GET | `/api/invoices/search` | search invoices | `queries/finance/invoices.searchInvoices` |
| POST | `/api/invoices/:id/charge` | add charge | `services/billing.addCharge` |
| DELETE | `/api/invoices/items/:id` | remove charge | `services/billing.removeCharge` |
| POST | `/api/invoices/:id/payment` | record payment | `services/billing.recordPayment` |
| POST | `/api/invoices/:id/refund` | process refund | `services/billing.processRefund` |

### 1.11 Folio

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/folios/:invoiceId/charge` | post charge | `services/folio.postCharge` |
| GET | `/api/folios/:invoiceId` | get folio balance | `services/folio.getFolioBalance` |
| POST | `/api/folios/transfer` | transfer charge | `services/folio.transferCharge` |
| POST | `/api/folios/:invoiceId/split` | split folio | `services/folio.splitFolio` |

### 1.12 Deposits

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/deposits/collect` | collect deposit | `services/deposits.collectDeposit` |
| POST | `/api/deposits/apply` | apply to invoice | `services/deposits.applyDepositToInvoice` |
| POST | `/api/deposits/refund` | refund deposit | `services/deposits.refundDeposit` |
| GET | `/api/deposits/:reservationId` | deposit history | `services/deposits.getDepositHistory` |

### 1.13 Housekeeping

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/housekeeping/tasks` | create task | `services/housekeeping.createTask` |
| POST | `/api/housekeeping/tasks/:id/assign` | assign task | `services/housekeeping.assignTask` |
| POST | `/api/housekeeping/tasks/:id/start` | start task | `services/housekeeping.startTask` |
| POST | `/api/housekeeping/tasks/:id/complete` | complete task | `services/housekeeping.completeTask` |
| POST | `/api/housekeeping/daily-board` | generate daily board | `services/housekeeping.generateDailyTaskBoard` |
| GET | `/api/housekeeping/tasks/date/:date` | tasks for date | `queries/housekeeping/housekeeping-tasks.listTasksForDate` |
| GET | `/api/housekeeping/tasks/room/:id` | tasks for room | `queries/housekeeping/housekeeping-tasks.listTasksForRoom` |
| GET | `/api/housekeeping/tasks/assignee/:id` | tasks for assignee | `queries/housekeeping/housekeeping-tasks.listTasksForAssignee` |
| POST | `/api/housekeeping/inspect/:roomId` | inspect room | `services/inspection.inspectRoom` |

### 1.14 Maintenance

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/maintenance` | create request | `services/maintenance.createRequest` |
| POST | `/api/maintenance/:id/assign` | assign | `services/maintenance.assignRequest` |
| POST | `/api/maintenance/:id/complete` | complete | `services/maintenance.completeRequest` |
| POST | `/api/maintenance/out-of-order` | put room OOO | `services/maintenance.putRoomOutOfOrder` |
| POST | `/api/maintenance/return-to-service` | return room | `services/maintenance.returnRoomToService` |
| GET | `/api/maintenance/open` | open requests | `queries/maintenance/maintenance-requests.listOpenRequests` |
| GET | `/api/maintenance/scheduled` | scheduled | `queries/maintenance/maintenance-requests.listScheduledRequests` |
| GET | `/api/maintenance/urgent` | urgent open | `queries/maintenance/maintenance-requests.listUrgentOpenRequests` |

### 1.15 Promotions

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/promotions` | create promotion | `queries/catalog/promotions.createPromotion` |
| PATCH | `/api/promotions/:id` | update promotion | `queries/catalog/promotions.updatePromotion` |
| GET | `/api/promotions/:code` | find by code | `queries/catalog/promotions.findPromotionByCode` |
| GET | `/api/promotions/active` | list active | `queries/catalog/promotions.listActivePromotions` |
| GET | `/api/promotions/period` | list for period | `queries/catalog/promotions.listPromotionsForPeriod` |

### 1.16 Overbooking Policies

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/overbooking-policies` | create policy | `queries/catalog/overbooking-policies.createOverbookingPolicy` |
| PATCH | `/api/overbooking-policies/:id` | update policy | `queries/catalog/overbooking-policies.updateOverbookingPolicy` |
| DELETE | `/api/overbooking-policies/:id` | delete policy | `queries/catalog/overbooking-policies.deleteOverbookingPolicy` |
| GET | `/api/overbooking-policies` | list all | `queries/catalog/overbooking-policies.listOverbookingPolicies` |
| GET | `/api/overbooking-policies/effective` | effective % | `queries/catalog/overbooking-policies.getEffectiveOverbookingPercent` |

### 1.17 Dashboard

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| GET | `/api/dashboard/room-board` | room status board | `queries/dashboard/room-status-board.getRoomStatusBoard` |
| GET | `/api/dashboard/arrivals` | today's arrivals | `queries/dashboard/room-status-board.getArrivals` |
| GET | `/api/dashboard/departures` | today's departures | `queries/dashboard/room-status-board.getDepartures` |
| GET | `/api/dashboard/stayovers` | stayovers | `queries/dashboard/room-status-board.getStayovers` |
| GET | `/api/dashboard/needs-inspection` | rooms needing inspect | `queries/dashboard/room-status-board.getRoomsNeedingInspection` |
| GET | `/api/dashboard/occupancy` | occupancy summary | `queries/dashboard/room-status-board.getOccupancySummary` |

### 1.18 Night Audit

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| POST | `/api/night-audit/run` | run full night audit | `services/night-audit.runNightAudit` |
| POST | `/api/night-audit/room-charges` | post daily room charges | `services/night-audit.postDailyRoomCharges` |
| POST | `/api/night-audit/revenue-report` | generate revenue report | `services/night-audit.generateDailyRevenueReport` |
| POST | `/api/night-audit/discrepancies` | flag discrepancies | `services/night-audit.flagDiscrepancies` |

### 1.19 Reporting

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| GET | `/api/reports/daily/:date` | daily revenue | `queries/reporting/daily-revenue.getDailyRevenue` |
| GET | `/api/reports/daily/range` | daily range | `queries/reporting/daily-revenue.listDailyRevenueRange` |
| GET | `/api/reports/monthly/:month` | monthly revenue | `queries/reporting/monthly-revenue.getMonthlyRevenue` |
| GET | `/api/reports/monthly/range` | monthly range | `queries/reporting/monthly-revenue.listMonthlyRevenueRange` |
| GET | `/api/reports/yearly/:year` | yearly revenue | `queries/reporting/yearly-revenue.getYearlyRevenue` |
| GET | `/api/reports/yearly/range` | yearly range | `queries/reporting/yearly-revenue.listYearlyRevenueRange` |
| GET | `/api/reports/room-type-revenue` | by room type | `queries/reporting/daily-room-type-revenue.listRoomTypeRevenueRange` |
| GET | `/api/reports/rate-plan-revenue` | by rate plan | `queries/reporting/daily-rate-revenue.listRatePlanRevenueRange` |

### 1.20 Audit Log

| Method | Route | Handler | Source |
|--------|-------|---------|--------|
| GET | `/api/audit/:table/:recordId` | audit trail for record | `queries/audit/audit-log.getAuditTrailForRecord` |
| GET | `/api/audit/user/:userId` | audit events for user | `queries/audit/audit-log.getAuditEventsForUser` |

---

## Phase 2 · Postman Testing

### 2.1 Collection Structure

```
myPMS API/
├── Auth/
│   ├── Login (POST)
│   └── Get Me (GET)
├── Catalog/
│   ├── Room Types (CRUD)
│   ├── Rooms (CRUD)
│   └── Agencies (CRUD)
├── Rate Management/
│   ├── Rate Plans (CRUD)
│   ├── Set Rate
│   ├── Propagate Rate  ← key workflow
│   └── Rate Adjustments
├── Availability/
│   ├── Check Availability
│   ├── Available Room Types
│   └── Can Overbook
├── Guests (CRUD + search + VIP + merge)
├── Reservations/
│   ├── Create
│   ├── Confirm → Check-In → Check-Out flow
│   ├── Cancel / No-Show
│   ├── Room Assignment
│   └── Group Reservations
├── Billing/
│   ├── Generate Invoice
│   ├── Add/Remove Charges
│   ├── Record Payment / Refund
│   ├── Folio (balance, transfer, split)
│   └── Deposits (collect, apply, refund)
├── Operations/
│   ├── Housekeeping (tasks + inspection)
│   ├── Maintenance (CRUD + OOO)
│   └── Night Audit
├── Dashboard (6 endpoints)
├── Reports (daily, monthly, yearly, by type/plan)
└── Audit Log
```

### 2.2 Testing Strategy

1. **Environment variables**: `{{baseUrl}}`, `{{token}}`, `{{guestId}}`, `{{reservationId}}`, `{{invoiceId}}`
2. **Pre-request scripts**: login → store token; create guest → store guestId
3. **Test scripts**: assert status codes, response shapes, business rules
4. **Workflow runners**: chain create → confirm → check-in → charge → checkout → pay

### 2.3 Priority Test Flows

| # | Flow | Key Assertions |
|---|------|----------------|
| 1 | **Full reservation lifecycle** | create → confirm → assign room → check-in → post charges → checkout → generate invoice → pay | all statuses correct, totals match |
| 2 | **Rate propagation** | set base rate → propagate → verify all derived types updated |
| 3 | **Group block pickup** | create block → create group res with blockId → verify pickup count → release unused |
| 4 | **Deposit lifecycle** | collect → apply to invoice → refund remainder |
| 5 | **Folio split** | post charges → split folio → verify both invoices balanced |
| 6 | **Night audit** | run audit → verify revenue report, room charges posted, discrepancies flagged |
| 7 | **Overbooking** | sell out inventory → attempt overbook within/beyond policy |

---

## Phase 3 · Implementation Order

### 3.1 Route Files (create in `src/routes/`)

| Priority | File | Routes | Est. effort |
|----------|------|--------|-------------|
| 1 | `auth.ts` | login, me | 1h |
| 2 | `room-types.ts` | CRUD + list | 1h |
| 3 | `rooms.ts` | CRUD + availability | 1h |
| 4 | `rate-plans.ts` | CRUD + pricing + propagation | 2h |
| 5 | `guests.ts` | CRUD + search + VIP | 2h |
| 6 | `reservations.ts` | CRUD + lifecycle + assignments | 3h |
| 7 | `groups.ts` | group res + blocks | 1.5h |
| 8 | `invoices.ts` | billing + folio + deposits | 3h |
| 9 | `housekeeping.ts` | tasks + inspection | 1.5h |
| 10 | `maintenance.ts` | CRUD + OOO | 1h |
| 11 | `dashboard.ts` | 6 dashboard endpoints | 1h |
| 12 | `night-audit.ts` | audit operations | 1h |
| 13 | `reports.ts` | all reporting endpoints | 1h |
| 14 | `promotions.ts` | CRUD | 0.5h |
| 15 | `overbooking.ts` | policies CRUD | 0.5h |
| 16 | `audit.ts` | audit log queries | 0.5h |

**Total estimate: ~21 hours**

### 3.2 Middleware Needed

| Middleware | Purpose |
|-----------|---------|
| `auth.ts` | JWT verification, attach `req.user` |
| `roles.ts` | Role-based access (`requireRole('admin', 'manager')`) |
| `validate.ts` | Zod request validation (`validateBody(schema)`, `validateQuery(schema)`) |
| `error-handler.ts` | Centralized error → JSON response |
| `audit.ts` | Auto-log mutations to audit_log |

### 3.3 Validation Schemas (Zod)

Create `src/validators/<domain>.ts` for each route file with Zod schemas for request bodies and query params.

---

## Phase 4 · Frontend / CLI

### Option A: CLI (quick, for ops/testing)

- Use `commander` or `citty` for a CLI tool
- Commands mirror the API: `pms reservations list`, `pms checkin RES-123`, `pms night-audit run`
- Good for night auditors, housekeeping supervisors, quick admin tasks
- Can be built in `scripts/cli.ts`

### Option B: Web Frontend (full UI)

| Tech | Recommendation |
|------|----------------|
| Framework | **Next.js** (App Router) or **Vite + React** |
| UI library | **shadcn/ui** (Tailwind + Radix) |
| State | **TanStack Query** for server state |
| Forms | **React Hook Form** + Zod |
| Auth | JWT stored in httpOnly cookie |
| Charts | **Recharts** for reporting dashboards |

#### Suggested Pages

| Page | Description |
|------|-------------|
| `/login` | Staff login |
| `/dashboard` | Room board, arrivals, departures, occupancy chart |
| `/reservations` | List, search, create, lifecycle actions |
| `/reservations/:id` | Detail: rooms, folio, payments, timeline |
| `/guests` | Search, profile, stay history, VIP management |
| `/rooms` | Room grid by floor/type, status, housekeeping |
| `/housekeeping` | Daily task board, assignment, inspection |
| `/maintenance` | Open requests, scheduling |
| `/rates` | Rate plan management, propagation tool, calendar view |
| `/invoices` | Outstanding, overdue, search |
| `/reports` | Daily/monthly/yearly revenue, charts |
| `/settings` | Users, permissions, agencies, promotions, overbooking |
| `/night-audit` | Run audit, review discrepancies |

### Recommendation

Start with **Option A (CLI)** for immediate testing alongside Postman, then build **Option B (Web Frontend)** for production use.

---

## Testing Implemented Routes with Postman (1.1 – 1.6)

> **Prerequisites**
> 1. Database running: `npm run docker:up:db`
> 2. Migrations applied: `npm run db:push`
> 3. Seed data loaded: `npm run db:seed`
> 4. Server running: `npm run dev` → `http://localhost:8080`

---

### Environment Setup

Create a Postman **Environment** called `myPMS-local` with these variables:

| Variable | Initial Value | Notes |
|----------|---------------|-------|
| `base_url` | `http://localhost:8080/api` | All requests use this |
| `token` | *(empty)* | Auto-filled by login script |

---

### 0 · Health Check

| | |
|---|---|
| **GET** | `{{base_url}}/health` |
| Auth | None |
| Expected | `200` — `{ "status": "ok", "timestamp": "..." }` |

---

### 1.1 · Identity & Auth

#### Login (start here — you need the token for everything else)

| | |
|---|---|
| **POST** | `{{base_url}}/auth/login` |
| Body (JSON) | `{ "email": "admin@hotel.com", "password": "admin123" }` |
| Expected | `200` — `{ "token": "...", "user": { ... } }` |

**Post-response script** (Postman → Tests tab):
```js
const res = pm.response.json();
if (res.token) {
  pm.environment.set("token", res.token);
}
```

> After this, every subsequent request uses `Bearer {{token}}` automatically.

#### Current User

| | |
|---|---|
| **GET** | `{{base_url}}/auth/me` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "user": { "id", "email", "role", ... } }` |

#### List Users (admin only)

| | |
|---|---|
| **GET** | `{{base_url}}/users?role=front_desk` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "users": [ ... ] }` |

#### Search Users

| | |
|---|---|
| **GET** | `{{base_url}}/users/search?q=admin` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "users": [ ... ] }` |

#### List Permissions

| | |
|---|---|
| **GET** | `{{base_url}}/permissions` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "permissions": [ ... ] }` |

#### Role Permissions

| | |
|---|---|
| **GET** | `{{base_url}}/roles/admin/permissions` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "permissions": [ ... ] }` |

---

### 1.2 · Room Types & Rooms

#### List Room Types

| | |
|---|---|
| **GET** | `{{base_url}}/room-types` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "roomTypes": [ ... ] }` |

#### Get Room Type by ID

| | |
|---|---|
| **GET** | `{{base_url}}/room-types/1` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "roomType": { ... } }` |

#### Create Room Type

| | |
|---|---|
| **POST** | `{{base_url}}/room-types` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "name": "Penthouse", "code": "PH", "basePrice": "500.00", "maxOccupancy": 4, "totalRooms": 2, "sortOrder": 10 }` |
| Expected | `201` — `{ "roomType": { ... } }` |

#### Update Room Type

| | |
|---|---|
| **PATCH** | `{{base_url}}/room-types/1` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "basePrice": "160.00" }` |
| Expected | `200` — `{ "roomType": { ... } }` |

#### List Rooms (filter by type)

| | |
|---|---|
| **GET** | `{{base_url}}/rooms?roomTypeId=1` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "rooms": [ ... ] }` |

#### List Available Rooms

| | |
|---|---|
| **GET** | `{{base_url}}/rooms/available` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "rooms": [ ... ] }` |

#### Find Room by Number

| | |
|---|---|
| **GET** | `{{base_url}}/rooms/101` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "room": { ... } }` |

#### Create Room

| | |
|---|---|
| **POST** | `{{base_url}}/rooms` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomNumber": "501", "roomTypeId": 1, "floor": 5, "status": "available" }` |
| Expected | `201` — `{ "room": { ... } }` |

#### Update Room

| | |
|---|---|
| **PATCH** | `{{base_url}}/rooms/1` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "status": "maintenance" }` |
| Expected | `200` — `{ "room": { ... } }` |

---

### 1.3 · Rate Plans & Pricing

#### List Active Rate Plans

| | |
|---|---|
| **GET** | `{{base_url}}/rate-plans` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "ratePlans": [ ... ] }` |

#### Find Rate Plan by Code

| | |
|---|---|
| **GET** | `{{base_url}}/rate-plans/RACK` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "ratePlan": { ... } }` |

#### Rate Plans for Stay

| | |
|---|---|
| **GET** | `{{base_url}}/rate-plans/stay?checkIn=2026-03-01&checkOut=2026-03-05` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "ratePlans": [ ... ] }` |

#### Create Rate Plan

| | |
|---|---|
| **POST** | `{{base_url}}/rate-plans` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "name": "Weekend Special", "code": "WKND", "validFrom": "2026-03-01", "validTo": "2026-06-30", "isActive": true }` |
| Expected | `201` — `{ "ratePlan": { ... } }` |

#### Set Room Type Rate

| | |
|---|---|
| **POST** | `{{base_url}}/room-type-rates` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomTypeId": 1, "ratePlanId": 1, "startDate": "2026-03-01", "endDate": "2026-03-31", "price": "120.00" }` |
| Expected | `201` — `{ "rate": { ... } }` |

#### Get Effective Rate

| | |
|---|---|
| **GET** | `{{base_url}}/room-type-rates/effective?roomTypeId=1&ratePlanId=1&date=2026-03-15` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "rate": { "price": "...", "source": "rate_plan" } }` |

#### Get Derived Rate

| | |
|---|---|
| **GET** | `{{base_url}}/room-type-rates/derived?baseRoomTypeId=1&derivedRoomTypeId=2&ratePlanId=1&date=2026-03-15` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "rate": { "price": "...", "source": "derived", ... } }` |

#### Propagate Base Rate

| | |
|---|---|
| **POST** | `{{base_url}}/room-type-rates/propagate` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "baseRoomTypeId": 1, "ratePlanId": 1, "startDate": "2026-04-01", "endDate": "2026-04-30", "newPrice": "130.00" }` |
| Expected | `200` — `{ "baseRate": { ... }, "derivedRates": [ ... ] }` |

#### Create Rate Adjustment

| | |
|---|---|
| **POST** | `{{base_url}}/rate-adjustments` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "baseRoomTypeId": 1, "derivedRoomTypeId": 2, "adjustmentType": "percent", "adjustmentValue": "25" }` |
| Expected | `201` — `{ "adjustment": { ... } }` |

#### List Adjustments for Base Type

| | |
|---|---|
| **GET** | `{{base_url}}/rate-adjustments/base/1` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "adjustments": [ ... ] }` |

---

### 1.4 · Availability & Inventory

#### Seed Inventory (do this first!)

| | |
|---|---|
| **POST** | `{{base_url}}/inventory/seed-all` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "startDate": "2026-03-01", "endDate": "2026-04-01" }` |
| Expected | `201` — `{ "results": [ { "roomTypeId": 1, "count": 31 }, ... ] }` |

#### Seed Single Room Type

| | |
|---|---|
| **POST** | `{{base_url}}/inventory/seed` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomTypeId": 1, "startDate": "2026-04-01", "endDate": "2026-05-01", "capacity": 10 }` |
| Expected | `201` — `{ "count": 30, "rows": [ ... ] }` |

#### Check Availability

| | |
|---|---|
| **GET** | `{{base_url}}/availability/check?roomTypeId=1&checkIn=2026-03-10&checkOut=2026-03-15` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "roomTypeId": 1, "isAvailable": true, "minAvailable": 10, ... }` |

#### Available Room Types

| | |
|---|---|
| **GET** | `{{base_url}}/availability/room-types?checkIn=2026-03-10&checkOut=2026-03-15` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "roomTypes": [ { "name": "...", "isAvailable": true, ... } ] }` |

#### Blocked Rooms

| | |
|---|---|
| **GET** | `{{base_url}}/availability/blocks?checkIn=2026-03-01&checkOut=2026-03-31` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "blocks": [ ... ] }` |

#### Can Overbook?

| | |
|---|---|
| **GET** | `{{base_url}}/availability/overbook?roomTypeId=1&checkIn=2026-03-10&checkOut=2026-03-15&requestedRooms=2` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "allowed": true/false, ... }` |

#### Single Room Available Now

| | |
|---|---|
| **GET** | `{{base_url}}/rooms/1/available-now?date=2026-03-10` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "roomId": 1, "date": "2026-03-10", "available": true }` |

#### Day Breakdown

| | |
|---|---|
| **GET** | `{{base_url}}/availability/day/2026-03-15?roomTypeId=1` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "availability": [ { "date": "2026-03-15", "available": 10 } ] }` |

---

### 1.5 · Guests

#### Create Guest

| | |
|---|---|
| **POST** | `{{base_url}}/guests` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "firstName": "John", "lastName": "Doe", "email": "john@example.com", "phone": "+1234567890" }` |
| Expected | `201` — `{ "guest": { "id": "...", ... } }` |

> Save the returned `id` — you'll need it for the next requests.

#### Search Guests

| | |
|---|---|
| **GET** | `{{base_url}}/guests?q=john` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "guests": [ ... ] }` |

#### Find Guest by ID

| | |
|---|---|
| **GET** | `{{base_url}}/guests/{guestId}` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "guest": { ... } }` |

#### Find Guest by Email

| | |
|---|---|
| **GET** | `{{base_url}}/guests/email/john@example.com` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "guest": { ... } }` |

#### Update Guest

| | |
|---|---|
| **PATCH** | `{{base_url}}/guests/{guestId}` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "phone": "+9876543210" }` |
| Expected | `200` — `{ "guest": { ... } }` |

#### Set VIP Status

| | |
|---|---|
| **PATCH** | `{{base_url}}/guests/{guestId}/vip` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "vipStatus": true }` |
| Expected | `200` — `{ "guest": { ... } }` |

#### Set Loyalty Number

| | |
|---|---|
| **PATCH** | `{{base_url}}/guests/{guestId}/loyalty` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "loyaltyNumber": "VIP-0001" }` |
| Expected | `200` — `{ "guest": { ... } }` |

#### List VIP Guests

| | |
|---|---|
| **GET** | `{{base_url}}/guests/vip` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "guests": [ ... ] }` |

#### Guest Stay History

| | |
|---|---|
| **GET** | `{{base_url}}/guests/{guestId}/history` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "stays": [ ... ], "stats": { "totalStays": 0, ... } }` |

#### Find Duplicates

| | |
|---|---|
| **GET** | `{{base_url}}/guests/duplicates?guestId={guestId}` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "duplicates": [ ... ] }` |

#### Merge Guests

| | |
|---|---|
| **POST** | `{{base_url}}/guests/merge` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "primaryGuestId": "{id1}", "secondaryGuestId": "{id2}" }` |
| Expected | `200` — `{ "guest": { ... } }` |

#### Search by Document

| | |
|---|---|
| **GET** | `{{base_url}}/guests/search/document?q=AB123456` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "guests": [ ... ] }` |

#### Search by Phone

| | |
|---|---|
| **GET** | `{{base_url}}/guests/search/phone?q=+1234567890` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "guests": [ ... ] }` |

#### Fuzzy Search

| | |
|---|---|
| **GET** | `{{base_url}}/guests/search/fuzzy?q=john` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "guests": [ ... ] }` |

---

### 1.6 · Agencies

#### Create Agency

| | |
|---|---|
| **POST** | `{{base_url}}/agencies` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "name": "Sunshine Travel", "code": "SUNTR", "commissionPercent": "12.50", "isActive": true }` |
| Expected | `201` — `{ "agency": { ... } }` |

#### Search Agencies

| | |
|---|---|
| **GET** | `{{base_url}}/agencies?q=sunshine` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "agencies": [ ... ] }` |

#### Find Agency by Code

| | |
|---|---|
| **GET** | `{{base_url}}/agencies/SUNTR` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "agency": { ... } }` |

#### Update Agency

| | |
|---|---|
| **PATCH** | `{{base_url}}/agencies/1` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "commissionPercent": "15.00" }` |
| Expected | `200` — `{ "agency": { ... } }` |

#### Agency Reservations

| | |
|---|---|
| **GET** | `{{base_url}}/agencies/1/reservations?from=2026-01-01&to=2026-12-31` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "reservations": [ ... ] }` |

---

### Error Responses to Verify

Test these scenarios to confirm error handling works:

| Scenario | Expected |
|----------|----------|
| No `Authorization` header | `401` — `{ "error": "Authorization header missing" }` |
| Expired / invalid JWT | `401` — `{ "error": "Token has expired" }` or `"Unauthorized"` |
| Non-admin calls `GET /api/users` | `403` — `{ "error": "Insufficient permissions" }` |
| `GET /api/room-types/99999` | `404` — `{ "error": "Room type not found" }` |
| `POST /api/auth/login` with wrong password | `401` — `{ "error": "Invalid credentials" }` |
| `POST /api/room-types` with no body | `400` — DB constraint error |

---

### Postman Tips

1. **Collection variables** — Set `Authorization` header to `Bearer {{token}}` at the **collection level** so every request inherits it automatically.
2. **Request ordering** — Run Login first, then seed inventory, then test everything else.
3. **Use Postman Runner** — Arrange requests in order and run the full collection to verify the entire flow.
4. **Save IDs** — Use post-response scripts to capture IDs into variables:
   ```js
   const res = pm.response.json();
   if (res.guest?.id) pm.environment.set("guestId", res.guest.id);
   if (res.agency?.id) pm.environment.set("agencyId", res.agency.id);
   ```

---

## Phase 5 · Polish & Production

- [ ] Add request rate limiting
- [ ] Add API versioning (`/api/v1/...`)
- [ ] Add OpenAPI/Swagger docs (use `@asteasolutions/zod-to-openapi`)
- [ ] Add integration tests for route handlers
- [ ] Add CI/CD pipeline (GitHub Actions)
- [ ] Add Docker production build
- [ ] Add logging (pino/winston)
- [ ] Add health check endpoint
- [ ] Add CORS configuration for frontend origin
- [ ] Add WebSocket for real-time dashboard updates
