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
      const { user } = await setupCheckedInReservation()
      const today = dateHelpers.today()

      const result = await postDailyRoomCharges(today, user.id, db)

      expect(result.chargesPosted).toBe(1)
      expect(result.businessDate).toBe(today)
    })

    it('does not double-post charges for the same date', async () => {
      const { user } = await setupCheckedInReservation()
      const today = dateHelpers.today()

      await postDailyRoomCharges(today, user.id, db)
      const result2 = await postDailyRoomCharges(today, user.id, db)

      expect(result2.chargesPosted).toBe(0)
    })
  })

  describe('generateDailyRevenueReport', () => {
    it('generates a report for the business date', async () => {
      const { user } = await setupCheckedInReservation()
      const today = dateHelpers.today()

      await postDailyRoomCharges(today, user.id, db)

      const report = await generateDailyRevenueReport(today, db)

      expect(report.date).toBe(today)
      expect(report.occupancy).toBeTruthy()
      expect(report.occupancy.totalRooms).toBeGreaterThanOrEqual(1)
    })
  })

  describe('flagDiscrepancies', () => {
    it('flags checked-in reservations with no invoice', async () => {
      await setupCheckedInReservation()
      const today = dateHelpers.today()

      const issues = await flagDiscrepancies(today, db)

      const noInvoice = issues.filter((i) => i.type === 'no_invoice')
      expect(noInvoice).toHaveLength(1)
    })

    it('flags occupied rooms with no checked-in reservation', async () => {
      const rt = await createTestRoomType(db)
      await createTestRoom(db, { roomTypeId: rt.id, status: 'occupied', roomNumber: 'ORPHAN-1' })

      const issues = await flagDiscrepancies(dateHelpers.today(), db)

      const orphans = issues.filter((i) => i.type === 'orphan_occupied')
      expect(orphans).toHaveLength(1)
      expect(orphans[0].detail).toContain('ORPHAN-1')
    })
  })

  describe('runNightAudit', () => {
    it('runs full audit: charges + report + discrepancies', async () => {
      const { user } = await setupCheckedInReservation()
      const today = dateHelpers.today()

      const result = await runNightAudit(today, user.id, db)

      expect(result.businessDate).toBe(today)
      expect(result.charges.chargesPosted).toBe(1)
      expect(result.report.date).toBe(today)
      expect(Array.isArray(result.discrepancies)).toBe(true)
    })
  })
})
