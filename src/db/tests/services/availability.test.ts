import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTestDb, cleanupTestDb, type TestDb } from '../setup'
import {
  createTestRoomType,
  createTestRoomInventory,
  createTestUser
} from '../factories'
import { dateHelpers } from '../utils'
import {
  checkAvailability,
  getAvailableRoomTypes,
  getBlockedRooms,
  canOverbook,
} from '../../services/availability'
import { roomBlocks } from '../../schema/reservations'

let db: TestDb

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => { await cleanupTestDb(db) })

describe('availability service', () => {
  describe('checkAvailability', () => {
    it('returns available when all nights have inventory', async () => {
      // 1. Create a room type and define a 3-night stay window
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(4)

      // 2. Insert inventory for each of the 3 nights (5 available per night)
      for (let i = 1; i <= 3; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: roomType.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 5,
        })
      }

      // 3. Check availability for the date range
      const result = await checkAvailability(roomType.id, checkIn, checkOut, db)

      // should be available with min=5 across all 3 nights
      expect(result.isAvailable).toBe(true)
      expect(result.minAvailable).toBe(5)
      expect(result.nights).toBe(3)
      expect(result.dailyAvailability).toHaveLength(3)
    })

    it('returns not available when one night has 0 available', async () => {
      // 1. Create a room type and define a 3-night stay window
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(4)

      // 2. Insert inventory: night 1 & 3 have 5 available, night 2 has 0
      await createTestRoomInventory(db, {
        roomTypeId: roomType.id,
        date: dateHelpers.daysFromNow(1),
        capacity: 10,
        available: 5,
      })
      await createTestRoomInventory(db, {
        roomTypeId: roomType.id,
        date: dateHelpers.daysFromNow(2),
        capacity: 10,
        available: 0,
      })
      await createTestRoomInventory(db, {
        roomTypeId: roomType.id,
        date: dateHelpers.daysFromNow(3),
        capacity: 10,
        available: 5,
      })

      // 3. Check availability for the date range
      const result = await checkAvailability(roomType.id, checkIn, checkOut, db)

      // should be unavailable because night 2 is sold out (min=0)
      expect(result.isAvailable).toBe(false)
      expect(result.minAvailable).toBe(0)
    })

    it('returns 0 available when no inventory rows exist', async () => {
      // 1. Create a room type but do NOT insert any inventory rows
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      // 2. Check availability with no inventory data
      const result = await checkAvailability(roomType.id, checkIn, checkOut, db)

      // should be unavailable with min=0
      expect(result.isAvailable).toBe(false)
      expect(result.minAvailable).toBe(0)
    })
  })

  describe('getAvailableRoomTypes', () => {
    it('returns all active room types with availability', async () => {
      // 1. Create two room types: Standard and Deluxe
      const rt1 = await createTestRoomType(db, { name: 'Standard', code: 'STD001' })
      const rt2 = await createTestRoomType(db, { name: 'Deluxe', code: 'DLX001' })

      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      // 2. Insert inventory only for Standard (Deluxe has none)
      for (let i = 1; i <= 2; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt1.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 5,
        })
      }

      // 3. Query available room types for the date range
      const results = await getAvailableRoomTypes(checkIn, checkOut, db)

      // both types appear in results
      expect(results.length).toBeGreaterThanOrEqual(2)
      const std = results.find((r) => r.roomTypeId === rt1.id)
      const dlx = results.find((r) => r.roomTypeId === rt2.id)
      // Standard has inventory → available; Deluxe has none → not available
      expect(std?.isAvailable).toBe(true)
      expect(dlx?.isAvailable).toBe(false)
    })
  })

  describe('getBlockedRooms', () => {
    it('returns active blocks in date range', async () => {
      // 1. Create a room type and a user for the block record
      const roomType = await createTestRoomType(db)
      const u = await createTestUser(db)

      // 2. Insert an active maintenance block spanning days 1–5
      await db.insert(roomBlocks).values({
        roomTypeId: roomType.id,
        startDate: dateHelpers.daysFromNow(1),
        endDate: dateHelpers.daysFromNow(5),
        blockType: 'maintenance',
        quantity: 2,
        createdBy: u.id,
      })

      // 3. Query blocks overlapping days 2–4
      const blocks = await getBlockedRooms(
        dateHelpers.daysFromNow(2),
        dateHelpers.daysFromNow(4),
        db,
      )

      // should find the overlapping maintenance block
      expect(blocks).toHaveLength(1)
      expect(blocks[0].blockType).toBe('maintenance')
    })

    it('excludes released blocks', async () => {
      // 1. Create a room type and a user
      const roomType = await createTestRoomType(db)
      const u = await createTestUser(db)

      // 2. Insert a block that has already been released
      await db.insert(roomBlocks).values({
        roomTypeId: roomType.id,
        startDate: dateHelpers.daysFromNow(1),
        endDate: dateHelpers.daysFromNow(5),
        blockType: 'maintenance',
        quantity: 2,
        releasedAt: new Date(),
        releasedBy: u.id,
        createdBy: u.id,
      })

      // 3. Query blocks overlapping the same range
      const blocks = await getBlockedRooms(
        dateHelpers.daysFromNow(2),
        dateHelpers.daysFromNow(4),
        db,
      )

      // released blocks should be excluded
      expect(blocks).toHaveLength(0)
    })
  })

  describe('canOverbook', () => {
    it('allows overbooking within policy', async () => {
      // 1. Create a room type and define a 2-night stay
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      // 2. Insert inventory: fully sold (0 available, capacity 10)
      for (let i = 1; i <= 2; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: roomType.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 0, // fully sold
        })
      }
      // 3. Attempt to overbook 1 room with 105% policy (max 10.5 → 10 sold + 1 = 11 > 10.5)
      const result = await canOverbook(roomType.id, checkIn, checkOut, 1, 105, db)

      // not allowed — exceeds the 105% overbooking cap
      expect(result.allowed).toBe(false)
    })

    it('blocks when over capacity', async () => {
      // 1. Create a room type and define a 2-night stay
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      // 2. Insert inventory: 1 available per night, capacity 10
      for (let i = 1; i <= 2; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: roomType.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 1,
        })
      }
      // 3. Attempt to overbook 2 rooms with 100% policy (no overbooking allowed)
      const result = await canOverbook(roomType.id, checkIn, checkOut, 2, 100, db)
      // not allowed — requesting 2 but only 1 available, and 100% means no overbook
      expect(result.allowed).toBe(false)
    })

    it('allows when within overbooking percent', async () => {
      // 1. Create a room type and define a 2-night stay
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      // 2. Insert inventory: fully sold (0 available, capacity 10)
      for (let i = 1; i <= 2; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: roomType.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 0, // all 10 sold
        })
      }
      // 3. Attempt to overbook 1 room with 120% policy (max 12 → 10 sold + 1 = 11 ≤ 12)
      const result = await canOverbook(roomType.id, checkIn, checkOut, 1, 120, db)
      // allowed — 11 total is within the 120% overbooking cap
      expect(result.allowed).toBe(true)
    })
  })
})
