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
      // 1. Create a room type and two rooms of that type
      const rt = await createTestRoomType(db)
      await createTestRoom(db, { roomTypeId: rt.id, roomNumber: 'R-101' })
      await createTestRoom(db, { roomTypeId: rt.id, roomNumber: 'R-102' })

      // 2. Fetch the full status board
      const board = await getRoomStatusBoard(db)

      // both rooms appear on the board
      expect(board).toHaveLength(2)
      // room type name is populated
      expect(board[0].roomTypeName).toBeTruthy()
      // new rooms default to available
      expect(board[0].status).toBe('available')
    })
  })

  describe('getArrivals', () => {
    it('returns confirmed and checked-in arrivals for a date', async () => {
      // 1. Set up a user and reference today's date
      const user = await createTestUser(db)
      const today = dateHelpers.today()

      // 2. Create a confirmed reservation arriving today
      await createTestReservation(db, user.id, {
        checkInDate: today,
        checkOutDate: dateHelpers.daysFromNow(3),
        status: 'confirmed',
      })
      // 3. Create a cancelled reservation for the same date (should be excluded)
      await createTestReservation(db, user.id, {
        checkInDate: today,
        checkOutDate: dateHelpers.daysFromNow(3),
        status: 'cancelled',
      })

      // 4. Query arrivals for today
      const arrivals = await getArrivals(today, db)
      // only the confirmed reservation appears
      expect(arrivals).toHaveLength(1)
      expect(arrivals[0].status).toBe('confirmed')
    })
  })

  describe('getDepartures', () => {
    it('returns checked-in departures for a date', async () => {
      // 1. Set up a user and reference today's date
      const user = await createTestUser(db)
      const today = dateHelpers.today()

      // 2. Create a checked-in reservation departing today
      await createTestReservation(db, user.id, {
        checkInDate: dateHelpers.daysAgo(3),
        checkOutDate: today,
        status: 'checked_in',
      })
      // 3. Create a confirmed (not checked-in) reservation departing today
      await createTestReservation(db, user.id, {
        checkInDate: dateHelpers.daysAgo(3),
        checkOutDate: today,
        status: 'confirmed', // not checked-in yet
      })

      // 4. Query departures for today
      const departures = await getDepartures(today, db)
      // only the checked-in guest is listed as departing
      expect(departures).toHaveLength(1)
      expect(departures[0].status).toBe('checked_in')
    })
  })

  describe('getStayovers', () => {
    it('returns guests staying through a date', async () => {
      // 1. Set up a user and reference today's date
      const user = await createTestUser(db)
      const today = dateHelpers.today()

      // 2. Create a guest who checked in 2 days ago (true stayover)
      await createTestReservation(db, user.id, {
        checkInDate: dateHelpers.daysAgo(2),
        checkOutDate: dateHelpers.daysFromNow(2),
        status: 'checked_in',
      })
      // 3. Create a guest who checks in today (not a stayover)
      // this one checks in today, so not a stayover (checkIn is NOT < today)
      await createTestReservation(db, user.id, {
        checkInDate: today,
        checkOutDate: dateHelpers.daysFromNow(3),
        status: 'checked_in',
      })

      // 4. Query stayovers for today
      const stayovers = await getStayovers(today, db)
      // only the guest who checked in before today counts
      expect(stayovers).toHaveLength(1)
    })
  })

  describe('getRoomsNeedingInspection', () => {
    it('returns completed housekeeping tasks needing inspection', async () => {
      // 1. Create a user and a room
      const user = await createTestUser(db)
      const room = await createTestRoom(db)
      const today = dateHelpers.today()

      // 2. Insert a completed housekeeping task for today
      await db.insert(housekeepingTasks).values({
        roomId: room.id,
        taskDate: today,
        taskType: 'checkout_cleaning',
        status: 'completed',
        createdBy: user.id,
      })

      // 3. Query rooms that need inspection
      const needsInspection = await getRoomsNeedingInspection(today, db)
      // the completed task surfaces as needing inspection
      expect(needsInspection).toHaveLength(1)
      expect(needsInspection[0].roomNumber).toBe(room.roomNumber)
    })
  })

  describe('getOccupancySummary', () => {
    it('returns occupancy breakdown', async () => {
      // 1. Create a room type and four rooms with mixed statuses
      const rt = await createTestRoomType(db)
      await createTestRoom(db, { roomTypeId: rt.id, status: 'available', roomNumber: 'OCC-1' })
      await createTestRoom(db, { roomTypeId: rt.id, status: 'occupied', roomNumber: 'OCC-2' })
      await createTestRoom(db, { roomTypeId: rt.id, status: 'occupied', roomNumber: 'OCC-3' })
      await createTestRoom(db, { roomTypeId: rt.id, status: 'maintenance', roomNumber: 'OCC-4' })

      // 2. Fetch the occupancy summary
      const summary = await getOccupancySummary(dateHelpers.today(), db)

      // counts match: 4 total, 2 occupied, 1 available, 1 maintenance
      expect(summary.total).toBe(4)
      expect(summary.occupied).toBe(2)
      expect(summary.available).toBe(1)
      expect(summary.maintenance).toBe(1)
      // occupancy rate = 2/4 = 50%
      expect(summary.occupancyRate).toBe('50.00')
    })
  })
})
