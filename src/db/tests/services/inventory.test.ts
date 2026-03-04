import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest'

import { eq } from 'drizzle-orm'

import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../setup'

import {
  createTestUser,
  createTestRoomType,
} from '../factories'

import {
  seedInventory,
  seedAllRoomTypeInventory,
} from '../../services/inventory'

import { roomInventory } from '../../schema/roomInventory'
import { systemConfig } from '../../schema/system'

// Business date '2026-05-01' is before all test dates (2026-06-xx, 2026-07-xx, 2026-08-xx).
// Unhappy paths use dates before BD.
const BUSINESS_DATE = '2026-05-01'

describe('Inventory services', () => {
  const db = getTestDb()
  let userId: number

  beforeEach(async () => {
    await cleanupTestDb(db)
    await db.insert(systemConfig)
      .values({ key: 'business_date', value: BUSINESS_DATE })
      .onConflictDoUpdate({ target: systemConfig.key, set: { value: BUSINESS_DATE } })
    const user = await createTestUser(db)
    userId = user.id
  })

  afterAll(async () => {
    await cleanupTestDb(db)
    await verifyDbIsEmpty(db)
  })

  describe('seedInventory', () => {
    it('creates inventory rows for each date in range', async () => {
      // 1. Create a room type with 20 rooms
      const roomType = await createTestRoomType(db, { totalRooms: 20 })

      // 2. Seed inventory for a 3-night range (Jun 1–4 exclusive)
      const inserted = await seedInventory(
        roomType.id,
        '2026-06-01',
        '2026-06-04',
        20,
        db,
      )

      // Should return one row per date
      expect(inserted).toHaveLength(3)
      // Each row should mirror the room type capacity
      inserted.forEach((row: any) => {
        expect(row.capacity).toBe(20)
        expect(row.available).toBe(20)
      })
    })

    it('skips already-seeded dates with onConflictDoNothing', async () => {
      // 1. Create a room type with 10 rooms
      const roomType = await createTestRoomType(db, { totalRooms: 10 })

      // 2. Seed inventory for Jul 1–3 (2 dates)
      await seedInventory(roomType.id, '2026-07-01', '2026-07-03', 10, db)
      // 3. Re-seed overlapping range Jul 1–4 (extends by 1 new date)
      const second = await seedInventory(roomType.id, '2026-07-01', '2026-07-04', 10, db)

      // Only the new date (Jul 3) should be returned
      expect(second).toHaveLength(1)

      // 4. Query all inventory rows for this room type
      const all = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomTypeId, roomType.id))

      // Total should be 3 (original 2 + 1 new)
      expect(all).toHaveLength(3)
    })
  })

  describe('seedAllRoomTypeInventory', () => {
    it('seeds inventory for all active room types', async () => {
      // 1. Create two active and one inactive room type
      await createTestRoomType(db, { totalRooms: 10, isActive: true })
      await createTestRoomType(db, { totalRooms: 5, isActive: true })
      await createTestRoomType(db, { totalRooms: 3, isActive: false })

      // 2. Seed inventory for all room types over Aug 1–3
      const results = await seedAllRoomTypeInventory(
        '2026-08-01',
        '2026-08-03',
        db,
      )

      // Should return results for the 2 active types only
      expect(results).toHaveLength(2)
      // Each active type gets 2 inventory rows (Aug 1 & Aug 2)
      expect(results[0].count).toBe(2)
      expect(results[1].count).toBe(2)
    })
  })

  describe('guard – rejects past startDate in seedInventory', () => {
    const PAST_DATE = '2026-04-01' // before BUSINESS_DATE '2026-05-01'

    it('rejects seedInventory with a past startDate (unhappy path)', async () => {
      // 1. Create a room type
      const roomType = await createTestRoomType(db, { totalRooms: 10 })

      // 2. Attempt to seed inventory starting before the business date
      // Should throw an error about a past start date
      await expect(
        seedInventory(roomType.id, PAST_DATE, '2026-04-05', 10, db),
      ).rejects.toThrow('Inventory start date')
    })

    it('allows seedInventory with a future startDate (happy path)', async () => {
      // 1. Create a room type
      const roomType = await createTestRoomType(db, { totalRooms: 10 })

      // 2. Seed inventory starting after the business date
      const inserted = await seedInventory(roomType.id, '2026-06-01', '2026-06-04', 10, db)
      // Should succeed and return 3 rows
      expect(inserted).toHaveLength(3)
    })
  })
})
