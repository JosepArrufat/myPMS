import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTestDb, cleanupTestDb, type TestDb } from '../setup'
import {
  createTestUser,
  createTestGuest,
  createTestRoom,
  createTestRoomType,
  createTestReservation,
} from '../factories'
import { dateHelpers } from '../utils'
import { housekeepingTasks } from '../../schema/housekeeping'
import {
  getRoomStatusBoard,
  getArrivals,
  getDepartures,
  getStayovers,
  getRoomsNeedingInspection,
  getOccupancySummary,
} from '../../queries/dashboard/room-status-board'

let db: TestDb

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => { await cleanupTestDb(db) })

describe('room status board query', () => {
  describe('getRoomStatusBoard', () => {
    it('returns all rooms with type details', async () => {
      const rt = await createTestRoomType(db)
      await createTestRoom(db, { roomTypeId: rt.id, roomNumber: 'R-101' })
      await createTestRoom(db, { roomTypeId: rt.id, roomNumber: 'R-102' })

      const board = await getRoomStatusBoard(db)

      expect(board).toHaveLength(2)
      expect(board[0].roomTypeName).toBeTruthy()
      expect(board[0].status).toBe('available')
    })
  })

  describe('getArrivals', () => {
    it('returns confirmed and checked-in arrivals for a date', async () => {
      const user = await createTestUser(db)
      const today = dateHelpers.today()

      await createTestReservation(db, user.id, {
        checkInDate: today,
        checkOutDate: dateHelpers.daysFromNow(3),
        status: 'confirmed',
      })
      await createTestReservation(db, user.id, {
        checkInDate: today,
        checkOutDate: dateHelpers.daysFromNow(3),
        status: 'cancelled',
      })

      const arrivals = await getArrivals(today, db)
      expect(arrivals).toHaveLength(1)
      expect(arrivals[0].status).toBe('confirmed')
    })
  })

  describe('getDepartures', () => {
    it('returns checked-in departures for a date', async () => {
      const user = await createTestUser(db)
      const today = dateHelpers.today()

      await createTestReservation(db, user.id, {
        checkInDate: dateHelpers.daysAgo(3),
        checkOutDate: today,
        status: 'checked_in',
      })
      await createTestReservation(db, user.id, {
        checkInDate: dateHelpers.daysAgo(3),
        checkOutDate: today,
        status: 'confirmed', // not checked-in yet
      })

      const departures = await getDepartures(today, db)
      expect(departures).toHaveLength(1)
      expect(departures[0].status).toBe('checked_in')
    })
  })

  describe('getStayovers', () => {
    it('returns guests staying through a date', async () => {
      const user = await createTestUser(db)
      const today = dateHelpers.today()

      await createTestReservation(db, user.id, {
        checkInDate: dateHelpers.daysAgo(2),
        checkOutDate: dateHelpers.daysFromNow(2),
        status: 'checked_in',
      })
      // this one checks in today, so not a stayover (checkIn is NOT < today)
      await createTestReservation(db, user.id, {
        checkInDate: today,
        checkOutDate: dateHelpers.daysFromNow(3),
        status: 'checked_in',
      })

      const stayovers = await getStayovers(today, db)
      expect(stayovers).toHaveLength(1)
    })
  })

  describe('getRoomsNeedingInspection', () => {
    it('returns completed housekeeping tasks needing inspection', async () => {
      const user = await createTestUser(db)
      const room = await createTestRoom(db)
      const today = dateHelpers.today()

      await db.insert(housekeepingTasks).values({
        roomId: room.id,
        taskDate: today,
        taskType: 'checkout_cleaning',
        status: 'completed',
        createdBy: user.id,
      })

      const needsInspection = await getRoomsNeedingInspection(today, db)
      expect(needsInspection).toHaveLength(1)
      expect(needsInspection[0].roomNumber).toBe(room.roomNumber)
    })
  })

  describe('getOccupancySummary', () => {
    it('returns occupancy breakdown', async () => {
      const rt = await createTestRoomType(db)
      await createTestRoom(db, { roomTypeId: rt.id, status: 'available', roomNumber: 'OCC-1' })
      await createTestRoom(db, { roomTypeId: rt.id, status: 'occupied', roomNumber: 'OCC-2' })
      await createTestRoom(db, { roomTypeId: rt.id, status: 'occupied', roomNumber: 'OCC-3' })
      await createTestRoom(db, { roomTypeId: rt.id, status: 'maintenance', roomNumber: 'OCC-4' })

      const summary = await getOccupancySummary(dateHelpers.today(), db)

      expect(summary.total).toBe(4)
      expect(summary.occupied).toBe(2)
      expect(summary.available).toBe(1)
      expect(summary.maintenance).toBe(1)
      expect(summary.occupancyRate).toBe('50.00')
    })
  })
})
