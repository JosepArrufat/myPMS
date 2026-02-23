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
> 4. Server running: `npm run dev` → `http://localhost:3000`

---

### Environment Setup

Create a Postman **Environment** called `myPMS-local` with these variables:

| Variable | Initial Value | Notes |
|----------|---------------|-------|
| `base_url` | `http://localhost:3000/api` | All requests use this |
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

### 1.7 · Reservations

> **Important**: Before creating reservations make sure you have seeded inventory (`POST /api/inventory/seed-all`) and created at least one guest (`POST /api/guests`). Save the returned `guestId` and a `roomTypeId` from the seed data.

#### Create Reservation

| | |
|---|---|
| **POST** | `{{base_url}}/reservations` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | see below |
| Expected | `201` — `{ "reservation": { "id": "...", "reservationNumber": "...", ... } }` |

```json
{
  "reservation": {
    "guestId": "{{guestId}}",
    "guestNameSnapshot": "John Doe",
    "checkInDate": "2026-04-01",
    "checkOutDate": "2026-04-03",
    "adultsCount": 2,
    "childrenCount": 0,
    "status": "pending",
    "source": "direct",
    "reservationNumber": "RES-TEST-001"
  },
  "rooms": [
    {
      "roomTypeId": 1,
      "checkInDate": "2026-04-01",
      "checkOutDate": "2026-04-03",
      "ratePlanId": 1
    }
  ]
}
```

**Post-response script:**
```js
const res = pm.response.json();
if (res.reservation?.id) pm.environment.set("reservationId", res.reservation.id);
if (res.reservation?.reservationNumber) pm.environment.set("reservationNumber", res.reservation.reservationNumber);
```

#### Find Reservation by Number

| | |
|---|---|
| **GET** | `{{base_url}}/reservations/{{reservationNumber}}` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "reservation": { ... } }` |

#### Guest Reservations

| | |
|---|---|
| **GET** | `{{base_url}}/reservations/guest/{{guestId}}` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "reservations": [ ... ] }` |

#### Arrivals for Date

| | |
|---|---|
| **GET** | `{{base_url}}/reservations/arrivals/2026-04-01` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "arrivals": [ ... ] }` |

#### Departures for Date

| | |
|---|---|
| **GET** | `{{base_url}}/reservations/departures/2026-04-03` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "departures": [ ... ] }` |

#### Stay Window

| | |
|---|---|
| **GET** | `{{base_url}}/reservations/stay-window?from=2026-04-01&to=2026-04-30` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "reservations": [ ... ] }` |

#### Reservations by Agency

| | |
|---|---|
| **GET** | `{{base_url}}/reservations/agency/1?from=2026-01-01&to=2026-12-31` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "reservations": [ ... ] }` |

#### Confirm Reservation

| | |
|---|---|
| **POST** | `{{base_url}}/reservations/{{reservationId}}/confirm` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "reservation": { "status": "confirmed", ... } }` |

#### Check In

| | |
|---|---|
| **POST** | `{{base_url}}/reservations/{{reservationId}}/check-in` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomId": 1 }` |
| Expected | `200` — `{ "reservation": { "status": "checked_in", ... }, "room": { "status": "occupied", ... } }` |

> The room must be `available` and not `dirty`. Pick a room that belongs to the correct room type.

#### Check Out

| | |
|---|---|
| **POST** | `{{base_url}}/reservations/{{reservationId}}/check-out` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomId": 1 }` |
| Expected | `200` — `{ "reservation": { "status": "checked_out", ... }, "task": { "taskType": "checkout_cleaning", ... } }` |

> Checkout automatically creates a housekeeping task and marks the room as `dirty`.

#### Cancel Reservation (create a new one first)

| | |
|---|---|
| **POST** | `{{base_url}}/reservations/{{reservationId}}/cancel` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "reason": "Guest requested cancellation", "cancellationFee": "25.00" }` |
| Expected | `200` — `{ "reservation": { "status": "cancelled", ... } }` |

#### Mark No-Show

| | |
|---|---|
| **POST** | `{{base_url}}/reservations/{{reservationId}}/no-show` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "reservation": { "status": "no_show", ... } }` |

#### Get Reservation Status

| | |
|---|---|
| **GET** | `{{base_url}}/reservations/{{reservationId}}/status` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "id": "...", "status": "...", "allowedTransitions": [ ... ] }` |

#### Override Daily Rate

| | |
|---|---|
| **POST** | `{{base_url}}/reservations/{{reservationId}}/rate-override` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "reservationRoomId": 1, "startDate": "2026-04-01", "endDate": "2026-04-02", "newRate": "99.00" }` |
| Expected | `200` — `{ "dailyRates": [ ... ] }` |

#### Recalculate Total

| | |
|---|---|
| **POST** | `{{base_url}}/reservations/{{reservationId}}/recalculate` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "reservation": { "totalAmount": "...", ... } }` |

---

### 1.8 · Reservation Rooms & Assignments

#### List Rooms for Reservation

| | |
|---|---|
| **GET** | `{{base_url}}/reservations/{{reservationId}}/rooms` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "rooms": [ { "roomTypeId": ..., "roomId": ..., ... } ] }` |

#### Assign Room

| | |
|---|---|
| **POST** | `{{base_url}}/reservations/{{reservationId}}/assign-room` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomId": 1, "checkInDate": "2026-04-01", "checkOutDate": "2026-04-03" }` |
| Expected | `201` — `{ "assignments": [ ... ] }` |

#### Unassign Room

| | |
|---|---|
| **DELETE** | `{{base_url}}/reservations/{{reservationId}}/unassign-room` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomId": 1, "checkInDate": "2026-04-01", "checkOutDate": "2026-04-03" }` |
| Expected | `200` — `{ "ok": true }` |

#### Assignments for Date

| | |
|---|---|
| **GET** | `{{base_url}}/room-assignments/2026-04-01` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "assignments": [ ... ] }` |

#### Check Room Conflicts

| | |
|---|---|
| **GET** | `{{base_url}}/room-conflicts?roomId=1&from=2026-04-01&to=2026-04-05` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "conflicts": [ ... ] }` |

---

### 1.9 · Group Reservations & Blocks

#### Create Group Block (do this first)

| | |
|---|---|
| **POST** | `{{base_url}}/blocks` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomTypeId": 1, "startDate": "2026-05-01", "endDate": "2026-05-05", "quantity": 5, "reason": "Wedding group" }` |
| Expected | `201` — `{ "block": { "id": ..., "blockType": "group_hold", ... } }` |

**Post-response script:**
```js
const res = pm.response.json();
if (res.block?.id) pm.environment.set("blockId", res.block.id);
```

#### Create Group Reservation

| | |
|---|---|
| **POST** | `{{base_url}}/groups` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | see below |
| Expected | `201` — `{ "reservation": { ... }, "rooms": [ ... ] }` |

```json
{
  "contactGuestId": "{{guestId}}",
  "groupName": "Smith Wedding Party",
  "checkInDate": "2026-05-01",
  "checkOutDate": "2026-05-05",
  "rooms": [
    { "roomTypeId": 1, "blockId": {{blockId}}, "dailyRate": "120.00" },
    { "roomTypeId": 1, "blockId": {{blockId}}, "dailyRate": "120.00" },
    { "roomTypeId": 2, "dailyRate": "180.00" }
  ]
}
```

> Rooms referencing a `blockId` consume from the block's allocation instead of general inventory. The third room (no blockId) deducts from general inventory.

**Post-response script:**
```js
const res = pm.response.json();
if (res.reservation?.id) pm.environment.set("groupReservationId", res.reservation.id);
```

#### Rooming List

| | |
|---|---|
| **GET** | `{{base_url}}/groups/{{groupReservationId}}/rooming-list` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "rooms": [ { "roomTypeName": "Standard", "roomId": null, ... } ] }` |

#### Block Pickup

| | |
|---|---|
| **GET** | `{{base_url}}/blocks/{{blockId}}/pickup` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "block": { ... }, "pickedUp": 2, "total": 5, "remaining": 3 }` |

#### Active Blocks in Range

| | |
|---|---|
| **GET** | `{{base_url}}/blocks/active?from=2026-05-01&to=2026-05-31` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "blocks": [ ... ] }` |

#### Release Block

| | |
|---|---|
| **POST** | `{{base_url}}/blocks/{{blockId}}/release` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "id": ..., "releasedAt": "...", "releasedSlots": 3, "pickedUp": 2 }` |

> Releasing a block returns unused inventory back to the general pool.

---

### 1.10 · Billing & Invoices

> **Prerequisite**: Have a reservation that has been checked out. Use its `reservationId`.

#### Generate Invoice from Reservation

| | |
|---|---|
| **POST** | `{{base_url}}/invoices/generate` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "reservationId": "{{reservationId}}" }` |
| Expected | `201` — `{ "invoice": { "id": "...", "invoiceNumber": "INV-...", "status": "issued", ... } }` |

**Post-response script:**
```js
const res = pm.response.json();
if (res.invoice?.id) pm.environment.set("invoiceId", res.invoice.id);
if (res.invoice?.invoiceNumber) pm.environment.set("invoiceNumber", res.invoice.invoiceNumber);
```

#### Find Invoice by Number

| | |
|---|---|
| **GET** | `{{base_url}}/invoices/{{invoiceNumber}}` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "invoice": { ... }, "items": [ ... ], "payments": [ ... ] }` |

#### Guest Invoices

| | |
|---|---|
| **GET** | `{{base_url}}/invoices/guest/{{guestId}}?from=2026-01-01` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "invoices": [ ... ] }` |

#### Outstanding Invoices

| | |
|---|---|
| **GET** | `{{base_url}}/invoices/outstanding` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "invoices": [ ... ] }` |

#### Overdue Invoices

| | |
|---|---|
| **GET** | `{{base_url}}/invoices/overdue` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "invoices": [ ... ] }` |

#### Search Invoices

| | |
|---|---|
| **GET** | `{{base_url}}/invoices/search?q=INV` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "invoices": [ ... ] }` |

#### Add Charge to Invoice

| | |
|---|---|
| **POST** | `{{base_url}}/invoices/{{invoiceId}}/charge` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "itemType": "minibar", "description": "Minibar - 2 bottles water", "unitPrice": "8.00", "quantity": "2" }` |
| Expected | `201` — `{ "item": { ... } }` |

#### Remove Charge

| | |
|---|---|
| **DELETE** | `{{base_url}}/invoices/items/{itemId}` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "item": { ... } }` |

> Get the `itemId` from the invoice detail or add-charge response.

#### Record Payment

| | |
|---|---|
| **POST** | `{{base_url}}/invoices/{{invoiceId}}/payment` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "amount": "250.00", "paymentMethod": "credit_card", "transactionReference": "CC-TX-12345" }` |
| Expected | `201` — `{ "payment": { ... } }` |

**Post-response script:**
```js
const res = pm.response.json();
if (res.payment?.id) pm.environment.set("paymentId", res.payment.id);
```

#### Process Refund

| | |
|---|---|
| **POST** | `{{base_url}}/invoices/{{invoiceId}}/refund` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "originalPaymentId": {{paymentId}}, "amount": "50.00", "reason": "Overcharge correction" }` |
| Expected | `200` — `{ "refund": { "isRefund": true, ... } }` |

---

### 1.11 · Folio

#### Post Charge to Folio

| | |
|---|---|
| **POST** | `{{base_url}}/folios/{{invoiceId}}/charge` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "itemType": "room_service", "description": "Room service - dinner", "unitPrice": "45.00" }` |
| Expected | `201` — `{ "item": { ... } }` |

#### Get Folio Balance

| | |
|---|---|
| **GET** | `{{base_url}}/folios/{{invoiceId}}` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "invoice": { "balance": "...", ... }, "charges": [ ... ], "payments": [ ... ] }` |

#### Transfer Charge Between Folios

| | |
|---|---|
| **POST** | `{{base_url}}/folios/transfer` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "invoiceItemId": 1, "targetInvoiceId": "{{otherInvoiceId}}" }` |
| Expected | `200` — `{ "sourceInvoiceId": "...", "targetInvoiceId": "...", "item": { ... } }` |

> You need two invoices. Generate a second one from another reservation, or split first.

#### Split Folio

| | |
|---|---|
| **POST** | `{{base_url}}/folios/{{invoiceId}}/split` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "invoiceItemIds": [2, 3] }` |
| Expected | `200` — `{ "sourceInvoice": { ... }, "newInvoice": { "invoiceNumber": "INV-SPLIT-...", ... } }` |

> Pass the IDs of specific charges you want to move to a new invoice.

---

### 1.12 · Deposits

#### Collect Deposit

| | |
|---|---|
| **POST** | `{{base_url}}/deposits/collect` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "reservationId": "{{reservationId}}", "amount": "100.00", "paymentMethod": "credit_card", "transactionReference": "DEP-CC-001" }` |
| Expected | `201` — `{ "payment": { ... }, "depositInvoiceId": "...", "totalDeposit": "100.00" }` |

#### Deposit History

| | |
|---|---|
| **GET** | `{{base_url}}/deposits/{{reservationId}}` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "deposits": [ ... ], "refunds": [ ... ], "totalDeposited": "100.00", "totalRefunded": "0.00", "netDeposit": "100.00" }` |

#### Apply Deposit to Final Invoice

| | |
|---|---|
| **POST** | `{{base_url}}/deposits/apply` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "reservationId": "{{reservationId}}", "finalInvoiceId": "{{invoiceId}}" }` |
| Expected | `200` — `{ "appliedAmount": "100.00", "payment": { ... } }` |

#### Refund Deposit

| | |
|---|---|
| **POST** | `{{base_url}}/deposits/refund` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "reservationId": "{{reservationId}}", "reason": "Reservation cancelled" }` |
| Expected | `200` — `{ "refunds": [ ... ], "totalRefunded": "100.00" }` |

---

### 1.13 · Housekeeping

#### Create Task

| | |
|---|---|
| **POST** | `{{base_url}}/housekeeping/tasks` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomId": 1, "taskDate": "2026-04-01", "taskType": "checkout_cleaning", "priority": 1 }` |
| Expected | `201` — `{ "task": { "id": ..., "status": "pending", ... } }` |

**Post-response script:**
```js
const res = pm.response.json();
if (res.task?.id) pm.environment.set("taskId", res.task.id);
```

#### Assign Task

| | |
|---|---|
| **POST** | `{{base_url}}/housekeeping/tasks/{{taskId}}/assign` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "assigneeId": 5 }` |
| Expected | `200` — `{ "task": { "status": "assigned", "assignedTo": 5, ... } }` |

> Use a user ID with the `housekeeping` role from the seed data.

#### Start Task

| | |
|---|---|
| **POST** | `{{base_url}}/housekeeping/tasks/{{taskId}}/start` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "task": { "status": "in_progress", "startedAt": "...", ... } }` |

#### Complete Task

| | |
|---|---|
| **POST** | `{{base_url}}/housekeeping/tasks/{{taskId}}/complete` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "task": { "status": "completed", "completedAt": "...", ... } }` |

#### Inspect Room (after task completed)

| | |
|---|---|
| **POST** | `{{base_url}}/housekeeping/inspect/{{taskId}}` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "task": { "status": "inspected", "inspectedBy": ..., ... } }` |

> Inspection also marks the room's cleanliness status as `inspected`.

#### Generate Daily Task Board

| | |
|---|---|
| **POST** | `{{base_url}}/housekeeping/daily-board` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "taskDate": "2026-04-01" }` |
| Expected | `201` — `{ "tasks": [ ... ], "count": 5 }` |

> Automatically creates pending tasks for all rooms with `dirty` cleanliness status.

#### Tasks for Date

| | |
|---|---|
| **GET** | `{{base_url}}/housekeeping/tasks/date/2026-04-01` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "tasks": [ ... ] }` |

#### Tasks for Room

| | |
|---|---|
| **GET** | `{{base_url}}/housekeeping/tasks/room/1?from=2026-04-01&to=2026-04-30` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "tasks": [ ... ] }` |

#### Tasks for Assignee

| | |
|---|---|
| **GET** | `{{base_url}}/housekeeping/tasks/assignee/5?from=2026-04-01&to=2026-04-30` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "tasks": [ ... ] }` |

---

### 1.14 · Maintenance

#### Create Maintenance Request

| | |
|---|---|
| **POST** | `{{base_url}}/maintenance` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomId": 5, "category": "plumbing", "priority": "urgent", "description": "Leaking faucet in bathroom" }` |
| Expected | `201` — `{ "request": { "id": ..., "status": "open", ... } }` |

**Post-response script:**
```js
const res = pm.response.json();
if (res.request?.id) pm.environment.set("maintenanceId", res.request.id);
```

#### Assign Maintenance Request

| | |
|---|---|
| **POST** | `{{base_url}}/maintenance/{{maintenanceId}}/assign` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "assigneeId": 6 }` |
| Expected | `200` — `{ "request": { "status": "in_progress", "assignedTo": 6, ... } }` |

#### Complete Maintenance Request

| | |
|---|---|
| **POST** | `{{base_url}}/maintenance/{{maintenanceId}}/complete` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "resolutionNotes": "Replaced faucet cartridge", "cost": "85.00" }` |
| Expected | `200` — `{ "request": { "status": "completed", "completedAt": "...", ... } }` |

#### Put Room Out of Order

| | |
|---|---|
| **POST** | `{{base_url}}/maintenance/out-of-order` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomId": 10, "startDate": "2026-04-05", "endDate": "2026-04-10", "reason": "Full bathroom renovation" }` |
| Expected | `201` — `{ "block": { "blockType": "maintenance", ... } }` |

> This marks the room as `out_of_order` and creates a maintenance block.

#### Return Room to Service

| | |
|---|---|
| **POST** | `{{base_url}}/maintenance/return-to-service` |
| Auth | Bearer Token → `{{token}}` |
| Body (JSON) | `{ "roomId": 10 }` |
| Expected | `200` — `{ "ok": true, "roomId": 10 }` |

> Room status returns to `available` (with `dirty` cleanliness) and the maintenance block is released.

#### List Open Requests

| | |
|---|---|
| **GET** | `{{base_url}}/maintenance/open` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "requests": [ ... ] }` |

#### List Scheduled Requests

| | |
|---|---|
| **GET** | `{{base_url}}/maintenance/scheduled?from=2026-04-01` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "requests": [ ... ] }` |

#### List Urgent Open Requests

| | |
|---|---|
| **GET** | `{{base_url}}/maintenance/urgent` |
| Auth | Bearer Token → `{{token}}` |
| Expected | `200` — `{ "requests": [ ... ] }` |

---

### Recommended Test Flow (1.7 – 1.14)

Run these requests in order to test the full reservation-to-checkout-to-payment lifecycle:

| Step | Request | What it proves |
|------|---------|----------------|
| 1 | `POST /api/reservations` | Creates reservation, deducts inventory |
| 2 | `POST /api/reservations/:id/confirm` | Status → confirmed |
| 3 | `POST /api/reservations/:id/assign-room` | Room assignment created |
| 4 | `POST /api/deposits/collect` | Deposit recorded, linked to reservation |
| 5 | `POST /api/reservations/:id/check-in` | Status → checked_in, room → occupied |
| 6 | `POST /api/invoices/generate` | Invoice with room-night line items |
| 7 | `POST /api/invoices/:id/charge` | Extra charge added (minibar, etc.) |
| 8 | `POST /api/deposits/apply` | Deposit applied as payment on final invoice |
| 9 | `POST /api/invoices/:id/payment` | Remaining balance paid |
| 10 | `POST /api/reservations/:id/check-out` | Status → checked_out, room → dirty, housekeeping task created |
| 11 | `POST /api/housekeeping/tasks/:id/assign` | Housekeeping workflow begins |
| 12 | `POST /api/housekeeping/tasks/:id/start` → `complete` → `inspect` | Room → inspected |
| 13 | `GET /api/folios/:invoiceId` | Final folio balanced at $0 |

---

### Rate Propagation — Deep Dive

#### What is Rate Propagation?

Rate propagation is an automated pricing mechanism that lets you set a **single base rate** for one room type and have all related room types automatically receive calculated prices based on pre-defined adjustment rules.

When you call `POST /api/room-type-rates/propagate`, the system:

1. **Sets the base rate** for the specified room type + rate plan + date range
2. **Looks up all adjustment rules** where this room type is the `baseRoomTypeId`
3. **Calculates derived prices** for each linked room type using the adjustment formula
4. **Inserts rate records** for every derived room type in a single transaction

#### How it Works (Step by Step)

```
1. You call:
   POST /api/room-type-rates/propagate
   {
     "baseRoomTypeId": 1,      ← Standard room
     "ratePlanId": 1,           ← Rack rate
     "startDate": "2026-04-01",
     "endDate": "2026-04-30",
     "newPrice": "100.00"
   }

2. System inserts: room_type_rates(roomTypeId=1, price=100.00, ...)

3. System queries room_type_rate_adjustments WHERE baseRoomTypeId = 1
   Finds:
     - derivedRoomTypeId=2 (Superior), adjustmentType='percent', adjustmentValue='25'
     - derivedRoomTypeId=3 (Deluxe),   adjustmentType='percent', adjustmentValue='60'
     - derivedRoomTypeId=4 (Suite),     adjustmentType='amount',  adjustmentValue='150'

4. System calculates:
     Superior: 100.00 × (1 + 25/100) = 125.00
     Deluxe:   100.00 × (1 + 60/100) = 160.00
     Suite:    100.00 + 150.00        = 250.00

5. System inserts rate records for each derived type

6. Returns:
   {
     "baseRate": { "roomTypeId": 1, "price": "100.00", ... },
     "derivedRates": [
       { "roomTypeId": 2, "price": "125.00", "adjustmentType": "percent", "adjustmentValue": "25" },
       { "roomTypeId": 3, "price": "160.00", "adjustmentType": "percent", "adjustmentValue": "60" },
       { "roomTypeId": 4, "price": "250.00", "adjustmentType": "amount",  "adjustmentValue": "150" }
     ]
   }
```

#### Adjustment Types

| Type | Formula | Example |
|------|---------|---------|
| `percent` | `basePrice × (1 + value/100)` | Base $100, value 25 → $125 |
| `amount` | `basePrice + value` | Base $100, value 150 → $250 |

#### Real Business Use Cases

**1. Seasonal Rate Changes**

A revenue manager needs to update prices for high season (July–August). Instead of manually updating 6 room types × 1 rate plan = 6 records, they update the Standard room and everything propagates:

```
Before: Standard $120, Superior $150, Deluxe $192, Suite $270
Action: Propagate Standard = $150 for July 1–Aug 31
After:  Standard $150, Superior $187.50, Deluxe $240, Suite $300
```

**Time saved**: 1 API call instead of 6. No risk of forgetting a room type.

**2. Flash Sales / Promotions**

Marketing wants a 3-day flash sale with 20% off. The manager creates a new rate plan "FLASH" and propagates a discounted base rate. All room types get proportionally discounted prices while maintaining their relative positioning.

**3. Multi-Property Chains**

A hotel chain sets base rates at corporate level. Each property defines adjustments for their local room types relative to the chain's "Standard" baseline. Corporate pushes one rate change and all properties' derived rates update consistently.

**4. OTA (Online Travel Agency) Rate Parity**

Different rate plans (Rack, OTA, Corporate, Government) often have the same proportional structure across room types. Propagation ensures that when OTA rates change, all room type variants update together, maintaining parity.

**5. Weekend / Weekday Pricing**

Revenue manager defines weekday base rate, then uses propagation for weekend premium:
- Create adjustment rule: `baseRoomTypeId=Standard, derivedRoomTypeId=Standard-Weekend, type=percent, value=15`
- Propagate weekday rate → weekend automatically gets 15% more
- Works across all room types simultaneously

**6. Group/Conference Pricing**

Sales team negotiates a group rate that is 10% below rack. Rather than calculating each room type manually, they propagate a base group rate and the system calculates correct prices for every room type the group might book.

#### Setup Postman Flow

1. **Create adjustment rules** (one-time setup):
   ```
   POST /api/rate-adjustments { baseRoomTypeId: 1, derivedRoomTypeId: 2, adjustmentType: "percent", adjustmentValue: "25" }
   POST /api/rate-adjustments { baseRoomTypeId: 1, derivedRoomTypeId: 3, adjustmentType: "percent", adjustmentValue: "60" }
   POST /api/rate-adjustments { baseRoomTypeId: 1, derivedRoomTypeId: 4, adjustmentType: "amount",  adjustmentValue: "150" }
   ```

2. **Propagate a rate**:
   ```
   POST /api/room-type-rates/propagate { baseRoomTypeId: 1, ratePlanId: 1, startDate: "2026-04-01", endDate: "2026-04-30", newPrice: "100.00" }
   ```

3. **Verify derived rates**:
   ```
   GET /api/room-type-rates/effective?roomTypeId=2&ratePlanId=1&date=2026-04-15
   → { "price": "125.00", "source": "rate_plan" }

   GET /api/room-type-rates/derived?baseRoomTypeId=1&derivedRoomTypeId=3&ratePlanId=1&date=2026-04-15
   → { "price": "160.00", "source": "derived", "basePrice": "100.00", "adjustment": { "type": "percent", "value": "60" } }
   ```

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
| Duplicate room number | `409` — `{ "error": "room with room_number '501' already exists" }` |
| Cancel already checked-out reservation | `500` — `"reservation not found or cannot be cancelled"` |
| Check in dirty room | `500` — `"room not available or not clean"` |

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
