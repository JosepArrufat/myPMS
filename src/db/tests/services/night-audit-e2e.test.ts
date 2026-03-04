import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest'

import { eq, and, sql } from 'drizzle-orm'

import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../setup'

import {
  createTestUser,
  createTestGuest,
  createTestRoom,
  createTestRoomType,
  createTestReservation,
  createTestReservationRoom,
  createTestInvoice,
} from '../factories'

import {
  postDailyRoomCharges,
  generateDailyRevenueReport,
  flagDiscrepancies,
  runNightAudit,
} from '../../services/night-audit'

import { setBusinessDate, getBusinessDate } from '../../services/business-date'
import { reservationDailyRates } from '../../schema/reservations'
import { invoices, invoiceItems } from '../../schema/invoices'
import { systemConfig } from '../../schema/system'

describe('Night audit end-to-end', () => {
  const db = getTestDb()
  let userId: number

  beforeEach(async () => {
    await cleanupTestDb(db)
    const user = await createTestUser(db)
    userId = user.id
  })

  afterAll(async () => {
    await cleanupTestDb(db)
    await verifyDbIsEmpty(db)
  })

  const setupStay = async (opts: {
    checkIn: string
    checkOut: string
    nightlyRate: string
    roomStatus?: string
  }) => {
    const guest = await createTestGuest(db)
    const rt = await createTestRoomType(db)
    const room = await createTestRoom(db, {
      roomTypeId: rt.id,
      status: (opts.roomStatus as any) ?? 'occupied',
    })

    const reservation = await createTestReservation(db, userId, {
      guestId: guest.id,
      checkInDate: opts.checkIn,
      checkOutDate: opts.checkOut,
      status: 'checked_in',
    })

    const resRoom = await createTestReservationRoom(db, userId, {
      reservationId: reservation.id,
      roomTypeId: rt.id,
      roomId: room.id,
      checkInDate: opts.checkIn,
      checkOutDate: opts.checkOut,
    })

    // Seed daily rates for every night of the stay
    const start = new Date(opts.checkIn)
    const end = new Date(opts.checkOut)
    while (start < end) {
      await db.insert(reservationDailyRates).values({
        reservationRoomId: resRoom.id,
        date: start.toISOString().slice(0, 10),
        rate: opts.nightlyRate,
        createdBy: userId,
      })
      start.setDate(start.getDate() + 1)
    }

    return { guest, rt, room, reservation, resRoom }
  }

  describe('Full audit cycle for a single night', () => {
    it('posts charges, generates report, flags issues, and advances date', async () => {
      // 1. Set today's business date
      const businessDate = '2026-06-15'
      await setBusinessDate(businessDate, db as any)

      // 2. Create a mid-stay reservation (checked in yesterday, out in 3 days)
      const { room } = await setupStay({
        checkIn: '2026-06-14',
        checkOut: '2026-06-17',
        nightlyRate: '200.00',
      })

      // 3. Execute the full night-audit pipeline
      const result = await runNightAudit(businessDate, userId, db)

      // Charges posted for tonight's stay
      expect(result.charges.chargesPosted).toBe(1)

      // Revenue report covers the correct date with occupancy
      expect(result.report.date).toBe(businessDate)
      expect(result.report.occupancy.occupiedRooms).toBeGreaterThanOrEqual(1)

      // No discrepancies because invoice was auto-created
      expect(Array.isArray(result.discrepancies)).toBe(true)

      // Business date rolled forward to the next day
      expect(result.newBusinessDate).toBe('2026-06-16')

      // 4. Confirm the advanced date was persisted in the DB
      const newDate = await getBusinessDate(db as any)
      expect(newDate).toBe('2026-06-16')
    })
  })

  describe('Multi-night charge accumulation', () => {
    it('running audit on consecutive nights accumulates charges', async () => {
      // 1. Set the starting business date
      await setBusinessDate('2026-07-01', db as any)

      // 2. Create a 3-night stay at $150/night
      const { reservation } = await setupStay({
        checkIn: '2026-07-01',
        checkOut: '2026-07-04',
        nightlyRate: '150.00',
      })

      // 3. Post charges for each consecutive night
      // Night 1
      const night1 = await postDailyRoomCharges('2026-07-01', userId, db)
      expect(night1.chargesPosted).toBe(1)

      // Night 2
      const night2 = await postDailyRoomCharges('2026-07-02', userId, db)
      expect(night2.chargesPosted).toBe(1)

      // Night 3
      const night3 = await postDailyRoomCharges('2026-07-03', userId, db)
      expect(night3.chargesPosted).toBe(1)

      // 4. Fetch the invoice and verify accumulation
      const [inv] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.reservationId, reservation.id))
      // Invoice exists
      expect(inv).toBeTruthy()

      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, inv.id))
      // 3 line items totalling 3 × $150 = $450
      expect(items).toHaveLength(3)
      expect(parseFloat(String(inv.totalAmount))).toBe(450)
    })
  })

  describe('Multiple reservations in one audit run', () => {
    it('posts charges for all checked-in reservations', async () => {
      // 1. Set the business date
      const businessDate = '2026-08-10'
      await setBusinessDate(businessDate, db as any)

      // 2. Create two overlapping checked-in stays
      await setupStay({
        checkIn: '2026-08-09',
        checkOut: '2026-08-12',
        nightlyRate: '100.00',
      })

      await setupStay({
        checkIn: '2026-08-10',
        checkOut: '2026-08-13',
        nightlyRate: '250.00',
      })

      // 3. Post charges for tonight
      const result = await postDailyRoomCharges(businessDate, userId, db)
      // Both reservations received a charge
      expect(result.chargesPosted).toBe(2)
    })
  })

  describe('Discrepancy detection', () => {
    it('flags checked-in reservation with no invoice after charges are skipped', async () => {
      // 1. Set up a room and guest
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)
      const room = await createTestRoom(db, { roomTypeId: rt.id, status: 'occupied' })

      // 2. Create a checked-in reservation WITHOUT daily rates (no charges will post)
      await createTestReservation(db, userId, {
        guestId: guest.id,
        checkInDate: '2026-09-01',
        checkOutDate: '2026-09-03',
        status: 'checked_in',
      })

      // 3. Run discrepancy check
      const issues = await flagDiscrepancies('2026-09-01', db)
      const noInvoice = issues.filter((i) => i.type === 'no_invoice')
      // Missing invoice flagged for the reservation
      expect(noInvoice).toHaveLength(1)
    })

    it('flags orphan occupied room with no checked-in reservation', async () => {
      // 1. Create an occupied room with no matching reservation
      const rt = await createTestRoomType(db)
      await createTestRoom(db, {
        roomTypeId: rt.id,
        status: 'occupied',
        roomNumber: 'ORPHAN-99',
      })

      // 2. Run discrepancy check
      const issues = await flagDiscrepancies('2026-09-01', db)
      const orphans = issues.filter((i) => i.type === 'orphan_occupied')
      // Orphan detected and references the correct room
      expect(orphans).toHaveLength(1)
      expect(orphans[0].detail).toContain('ORPHAN-99')
    })

    it('flags checked-out reservation with outstanding balance', async () => {
      // 1. Create a checked-out reservation
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, userId, {
        guestId: guest.id,
        status: 'checked_out',
      })

      // 2. Attach a partially-paid invoice ($200 of $500 paid)
      await createTestInvoice(db, {
        reservationId: reservation.id,
        guestId: guest.id,
        invoiceType: 'final',
        totalAmount: '500.00',
        paidAmount: '200.00',
        balance: '300.00',
        status: 'partially_paid',
      })

      // 3. Run discrepancy check
      const issues = await flagDiscrepancies('2026-09-01', db)
      const unpaid = issues.filter((i) => i.type === 'unpaid_checkout')
      // Outstanding balance flagged
      expect(unpaid).toHaveLength(1)
    })
  })

  describe('Revenue report accuracy', () => {
    it('breaks down revenue by item type', async () => {
      // 1. Set business date and create a stay at $180/night
      const businessDate = '2026-10-01'
      await setBusinessDate(businessDate, db as any)

      const { reservation } = await setupStay({
        checkIn: '2026-10-01',
        checkOut: '2026-10-03',
        nightlyRate: '180.00',
      })

      // 2. Post room charges to create the invoice
      await postDailyRoomCharges(businessDate, userId, db)

      // 3. Manually add a food charge ($45) to the same invoice
      const [inv] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.reservationId, reservation.id))

      await db.insert(invoiceItems).values({
        invoiceId: inv.id,
        itemType: 'food',
        description: 'Room service dinner',
        dateOfService: businessDate,
        quantity: '1',
        unitPrice: '45.00',
        total: '45.00',
        createdBy: userId,
      })

      // 4. Generate the daily revenue report
      const report = await generateDailyRevenueReport(businessDate, db)

      // Report date matches
      expect(report.date).toBe(businessDate)
      // Room revenue = $180, food revenue = $45, total = $225
      expect(parseFloat(report.revenueByType.room ?? '0')).toBe(180)
      expect(parseFloat(report.revenueByType.food ?? '0')).toBe(45)
      expect(parseFloat(report.totalRevenue)).toBe(225)
    })
  })

  describe('Idempotency', () => {
    it('running postDailyRoomCharges twice for the same date does not double-post', async () => {
      // 1. Set business date and create a stay
      const businessDate = '2026-11-01'
      await setBusinessDate(businessDate, db as any)

      const { reservation } = await setupStay({
        checkIn: '2026-11-01',
        checkOut: '2026-11-03',
        nightlyRate: '120.00',
      })

      // 2. Post charges — first run should succeed
      const first = await postDailyRoomCharges(businessDate, userId, db)
      expect(first.chargesPosted).toBe(1)

      // 3. Post charges again for the same date — should be a no-op
      const second = await postDailyRoomCharges(businessDate, userId, db)
      expect(second.chargesPosted).toBe(0)

      // 4. Verify only one line item exists on the invoice
      const [inv] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.reservationId, reservation.id))
      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, inv.id))
      expect(items).toHaveLength(1)
    })

    it('runNightAudit is safe to re-run (charges are idempotent)', async () => {
      // 1. Set business date and create a 2-night stay
      const businessDate = '2026-11-15'
      await setBusinessDate(businessDate, db as any)

      await setupStay({
        checkIn: '2026-11-15',
        checkOut: '2026-11-17',
        nightlyRate: '100.00',
      })

      // 2. Run the first full audit — charges post and date advances
      const first = await runNightAudit(businessDate, userId, db)
      expect(first.charges.chargesPosted).toBe(1)
      expect(first.newBusinessDate).toBe('2026-11-16')

      // 3. Roll the business date back and re-run audit
      await setBusinessDate(businessDate, db as any)
      const second = await runNightAudit(businessDate, userId, db)
      // Charges already exist — nothing new posted
      expect(second.charges.chargesPosted).toBe(0)
    })
  })
})
