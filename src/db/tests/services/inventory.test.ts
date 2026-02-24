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
      const roomType = await createTestRoomType(db, { totalRooms: 20 })

      const inserted = await seedInventory(
        roomType.id,
        '2026-06-01',
        '2026-06-04',
        20,
        db,
      )

      expect(inserted).toHaveLength(3)
      inserted.forEach((row: any) => {
        expect(row.capacity).toBe(20)
        expect(row.available).toBe(20)
      })
    })

    it('skips already-seeded dates with onConflictDoNothing', async () => {
      const roomType = await createTestRoomType(db, { totalRooms: 10 })

      await seedInventory(roomType.id, '2026-07-01', '2026-07-03', 10, db)
      const second = await seedInventory(roomType.id, '2026-07-01', '2026-07-04', 10, db)

      expect(second).toHaveLength(1)

      const all = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomTypeId, roomType.id))

      expect(all).toHaveLength(3)
    })
  })

  describe('seedAllRoomTypeInventory', () => {
    it('seeds inventory for all active room types', async () => {
      await createTestRoomType(db, { totalRooms: 10, isActive: true })
      await createTestRoomType(db, { totalRooms: 5, isActive: true })
      await createTestRoomType(db, { totalRooms: 3, isActive: false })

      const results = await seedAllRoomTypeInventory(
        '2026-08-01',
        '2026-08-03',
        db,
      )

      expect(results).toHaveLength(2)
      expect(results[0].count).toBe(2)
      expect(results[1].count).toBe(2)
    })
  })

  describe('guard – rejects past startDate in seedInventory', () => {
    const PAST_DATE = '2026-04-01' // before BUSINESS_DATE '2026-05-01'

    it('rejects seedInventory with a past startDate (unhappy path)', async () => {
      const roomType = await createTestRoomType(db, { totalRooms: 10 })

      await expect(
        seedInventory(roomType.id, PAST_DATE, '2026-04-05', 10, db),
      ).rejects.toThrow('Inventory start date')
    })

    it('allows seedInventory with a future startDate (happy path)', async () => {
      const roomType = await createTestRoomType(db, { totalRooms: 10 })

      const inserted = await seedInventory(roomType.id, '2026-06-01', '2026-06-04', 10, db)
      expect(inserted).toHaveLength(3)
    })
  })
})
