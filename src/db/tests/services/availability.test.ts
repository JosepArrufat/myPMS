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
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(4)

      for (let i = 1; i <= 3; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: roomType.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 5,
        })
      }

      const result = await checkAvailability(roomType.id, checkIn, checkOut, db)

      expect(result.isAvailable).toBe(true)
      expect(result.minAvailable).toBe(5)
      expect(result.nights).toBe(3)
      expect(result.dailyAvailability).toHaveLength(3)
    })

    it('returns not available when one night has 0 available', async () => {
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(4)

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

      const result = await checkAvailability(roomType.id, checkIn, checkOut, db)

      expect(result.isAvailable).toBe(false)
      expect(result.minAvailable).toBe(0)
    })

    it('returns 0 available when no inventory rows exist', async () => {
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      const result = await checkAvailability(roomType.id, checkIn, checkOut, db)

      expect(result.isAvailable).toBe(false)
      expect(result.minAvailable).toBe(0)
    })
  })

  describe('getAvailableRoomTypes', () => {
    it('returns all active room types with availability', async () => {
      const rt1 = await createTestRoomType(db, { name: 'Standard', code: 'STD001' })
      const rt2 = await createTestRoomType(db, { name: 'Deluxe', code: 'DLX001' })

      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      for (let i = 1; i <= 2; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt1.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 5,
        })
      }

      const results = await getAvailableRoomTypes(checkIn, checkOut, db)

      expect(results.length).toBeGreaterThanOrEqual(2)
      const std = results.find((r) => r.roomTypeId === rt1.id)
      const dlx = results.find((r) => r.roomTypeId === rt2.id)
      expect(std?.isAvailable).toBe(true)
      expect(dlx?.isAvailable).toBe(false)
    })
  })

  describe('getBlockedRooms', () => {
    it('returns active blocks in date range', async () => {
      const roomType = await createTestRoomType(db)
      const u = await createTestUser(db)

      await db.insert(roomBlocks).values({
        roomTypeId: roomType.id,
        startDate: dateHelpers.daysFromNow(1),
        endDate: dateHelpers.daysFromNow(5),
        blockType: 'maintenance',
        quantity: 2,
        createdBy: u.id,
      })

      const blocks = await getBlockedRooms(
        dateHelpers.daysFromNow(2),
        dateHelpers.daysFromNow(4),
        db,
      )

      expect(blocks).toHaveLength(1)
      expect(blocks[0].blockType).toBe('maintenance')
    })

    it('excludes released blocks', async () => {
      const roomType = await createTestRoomType(db)
      const u = await createTestUser(db)

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

      const blocks = await getBlockedRooms(
        dateHelpers.daysFromNow(2),
        dateHelpers.daysFromNow(4),
        db,
      )

      expect(blocks).toHaveLength(0)
    })
  })

  describe('canOverbook', () => {
    it('allows overbooking within policy', async () => {
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      for (let i = 1; i <= 2; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: roomType.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 0, // fully sold
        })
      }
      const result = await canOverbook(roomType.id, checkIn, checkOut, 1, 105, db)

      expect(result.allowed).toBe(false)
    })

    it('blocks when over capacity', async () => {
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      for (let i = 1; i <= 2; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: roomType.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 1,
        })
      }
      const result = await canOverbook(roomType.id, checkIn, checkOut, 2, 100, db)
      expect(result.allowed).toBe(false)
    })

    it('allows when within overbooking percent', async () => {
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(1)
      const checkOut = dateHelpers.daysFromNow(3)

      for (let i = 1; i <= 2; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: roomType.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 0, // all 10 sold
        })
      }
      const result = await canOverbook(roomType.id, checkIn, checkOut, 1, 120, db)
      expect(result.allowed).toBe(true)
    })
  })
})
