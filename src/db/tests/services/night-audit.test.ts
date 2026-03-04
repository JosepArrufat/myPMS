import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTestDb, cleanupTestDb, type TestDb } from '../setup'
import {
  createTestUser,
  createTestGuest,
  createTestRoom,
  createTestRoomType,
  createTestReservation,
  createTestReservationRoom,
} from '../factories'
import { dateHelpers } from '../utils'
import {reservationDailyRates } from '../../schema/reservations'
import {
  postDailyRoomCharges,
  generateDailyRevenueReport,
  flagDiscrepancies,
  runNightAudit,
} from '../../services/night-audit'

let db: TestDb

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => { await cleanupTestDb(db) })

describe('night audit service', () => {
  const setupCheckedInReservation = async () => {
    const user = await createTestUser(db)
    const guest = await createTestGuest(db)
    const rt = await createTestRoomType(db)
    const room = await createTestRoom(db, { roomTypeId: rt.id, status: 'occupied' })
    const today = dateHelpers.today()
    const checkout = dateHelpers.daysFromNow(3)

    const reservation = await createTestReservation(db, user.id, {
      guestId: guest.id,
      checkInDate: today,
      checkOutDate: checkout,
      status: 'checked_in',
    })

    const resRoom = await createTestReservationRoom(db, user.id, {
      reservationId: reservation.id,
      roomTypeId: rt.id,
      roomId: room.id,
      checkInDate: today,
      checkOutDate: checkout,
    })

    for (let i = 0; i < 3; i++) {
      await db.insert(reservationDailyRates).values({
        reservationRoomId: resRoom.id,
        date: dateHelpers.daysFromNow(i),
        rate: '150.00',
        createdBy: user.id,
      })
    }

    return { user, guest, rt, room, reservation, resRoom }
  }

  describe('postDailyRoomCharges', () => {
    it('posts room charges for checked-in reservations', async () => {
      // 1. Create a checked-in reservation with daily rates
      const { user } = await setupCheckedInReservation()
      const today = dateHelpers.today()

      // 2. Post room charges for today's business date
      const result = await postDailyRoomCharges(today, user.id, db)

      // Exactly 1 charge should be posted
      expect(result.chargesPosted).toBe(1)
      // Business date matches today
      expect(result.businessDate).toBe(today)
    })

    it('does not double-post charges for the same date', async () => {
      // 1. Create a checked-in reservation with daily rates
      const { user } = await setupCheckedInReservation()
      const today = dateHelpers.today()

      // 2. Post charges once (succeeds)
      await postDailyRoomCharges(today, user.id, db)
      // 3. Attempt to post charges again for the same date
      const result2 = await postDailyRoomCharges(today, user.id, db)

      // Second run should post 0 (idempotent)
      expect(result2.chargesPosted).toBe(0)
    })
  })

  describe('generateDailyRevenueReport', () => {
    it('generates a report for the business date', async () => {
      // 1. Create a checked-in reservation with daily rates
      const { user } = await setupCheckedInReservation()
      const today = dateHelpers.today()

      // 2. Post charges so revenue data exists
      await postDailyRoomCharges(today, user.id, db)

      // 3. Generate the daily revenue report
      const report = await generateDailyRevenueReport(today, db)

      // Report date matches the business date
      expect(report.date).toBe(today)
      // Occupancy section is present
      expect(report.occupancy).toBeTruthy()
      // At least 1 room counted in total
      expect(report.occupancy.totalRooms).toBeGreaterThanOrEqual(1)
    })
  })

  describe('flagDiscrepancies', () => {
    it('flags checked-in reservations with no invoice', async () => {
      // 1. Create a checked-in reservation (no charges posted)
      await setupCheckedInReservation()
      const today = dateHelpers.today()

      // 2. Run discrepancy check
      const issues = await flagDiscrepancies(today, db)

      // Should flag exactly 1 no_invoice issue
      const noInvoice = issues.filter((i) => i.type === 'no_invoice')
      expect(noInvoice).toHaveLength(1)
    })

    it('flags occupied rooms with no checked-in reservation', async () => {
      // 1. Create an occupied room with no matching reservation
      const rt = await createTestRoomType(db)
      await createTestRoom(db, { roomTypeId: rt.id, status: 'occupied', roomNumber: 'ORPHAN-1' })

      // 2. Run discrepancy check
      const issues = await flagDiscrepancies(dateHelpers.today(), db)

      // Should flag exactly 1 orphan_occupied issue
      const orphans = issues.filter((i) => i.type === 'orphan_occupied')
      expect(orphans).toHaveLength(1)
      // Detail references the orphan room number
      expect(orphans[0].detail).toContain('ORPHAN-1')
    })
  })

  describe('runNightAudit', () => {
    it('runs full audit: charges + report + discrepancies', async () => {
      // 1. Create a checked-in reservation with daily rates
      const { user } = await setupCheckedInReservation()
      const today = dateHelpers.today()

      // 2. Run the full night audit pipeline
      const result = await runNightAudit(today, user.id, db)

      // Business date matches
      expect(result.businessDate).toBe(today)
      // 1 charge posted for the checked-in reservation
      expect(result.charges.chargesPosted).toBe(1)
      // Report date matches
      expect(result.report.date).toBe(today)
      // Discrepancies is an array (may or may not have items)
      expect(Array.isArray(result.discrepancies)).toBe(true)
    })
  })
})
