import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTestDb, cleanupTestDb, type TestDb } from '../setup'
import {
  createTestRoomType,
  createTestRoomInventory,
  createTestUser,
  createTestGuest,
  createTestOverbookingPolicy,
} from '../factories'
import { dateHelpers } from '../utils'
import {
  lookupOverbookingPercent,
  validateAvailability,
} from '../../utils'
import { reserveRoomInventory } from '../../queries/catalog/rooms'
import { createReservation } from '../../queries/reservations/reservations'
import { createGroupReservation } from '../../services/group-reservation'

let db: TestDb

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => { await cleanupTestDb(db) })

describe('overbooking policy integration', () => {
  describe('lookupOverbookingPercent', () => {
    it('returns room-type-specific policy over hotel-wide', async () => {
      // 1. Create a room type
      const rt = await createTestRoomType(db)

      // 2. Create hotel-wide policy at 120%
      // hotel-wide 120%
      await createTestOverbookingPolicy(db, {
        roomTypeId: null,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 120,
      })

      // 3. Create room-type-specific policy at 105%
      // room-type-specific 105%
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 105,
      })

      // 4. Look up overbooking percent for the room type
      const pct = await lookupOverbookingPercent(rt.id, '2026-03-15', db)
      // Room-type-specific (105%) wins over hotel-wide (120%)
      expect(pct).toBe(105)
    })

    it('falls back to hotel-wide when no specific policy', async () => {
      // 1. Create a room type (no room-type-specific policy)
      const rt = await createTestRoomType(db)
      // 2. Create hotel-wide policy at 115%
      await createTestOverbookingPolicy(db, {
        roomTypeId: null,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 115,
      })

      // 3. Look up overbooking percent
      const pct = await lookupOverbookingPercent(rt.id, '2026-03-15', db)
      // Falls back to hotel-wide → 115%
      expect(pct).toBe(115)
    })

    it('returns 100 when no policy covers the date', async () => {
      // 1. Create a room type with no policies
      const rt = await createTestRoomType(db)
      // 2. Look up percent for a date outside any policy range
      const pct = await lookupOverbookingPercent(rt.id, '2026-06-01', db)
      // No policy → defaults to 100%
      expect(pct).toBe(100)
    })
  })

  describe('validateAvailability auto-lookup', () => {
    it('auto-allows overbooking when policy exists and percent is undefined', async () => {
      // 1. Create room type and date range
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(10)
      const checkOut = dateHelpers.daysFromNow(11)

      // 2. Sell out inventory (capacity = 10, available = 0)
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0, // fully sold
      })

      // 3. Create 120% policy (maxAllowed = 12, sold = 10, remaining = 2)
      // 120% policy → maxAllowed = 12, sold = 10, remaining = 2
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 120,
      })

      // 4. Validate with undefined percent → triggers auto-lookup
      // Pass undefined for overbookingPercent → auto-lookup
      await expect(
        db.transaction(async (tx) => {
          await validateAvailability(
            [{ roomTypeId: rt.id, quantity: 1 }],
            checkIn,
            checkOut,
            undefined, // auto-lookup
            tx,
          )
        })
      // Policy allows overbooking → no error
      ).resolves.not.toThrow()
    })

    it('rejects when no policy and fully sold (default 100%)', async () => {
      // 1. Create room type and date range
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(10)
      const checkOut = dateHelpers.daysFromNow(11)

      // 2. Sell out inventory
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

      // 3. Validate with undefined percent, no policy exists
      await expect(
        db.transaction(async (tx) => {
          await validateAvailability(
            [{ roomTypeId: rt.id, quantity: 1 }],
            checkIn,
            checkOut,
            undefined, // no policy → 100%, no overbooking
            tx,
          )
        })
      // Defaults to 100% → no headroom → rejects
      ).rejects.toThrow('Insufficient availability')
    })

    it('explicit override takes precedence over policy', async () => {
      // 1. Create room type and date range
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(10)
      const checkOut = dateHelpers.daysFromNow(11)

      // 2. Sell out inventory
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

      // 3. Create 120% policy (would normally allow overbooking)
      // Policy says 120% (would allow)
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 120,
      })

      // 4. Validate with explicit 100% override
      // But caller explicitly passes 100% → no overbooking
      await expect(
        db.transaction(async (tx) => {
          await validateAvailability(
            [{ roomTypeId: rt.id, quantity: 1 }],
            checkIn,
            checkOut,
            100, // explicit override
            tx,
          )
        })
      // Explicit 100% wins over policy 120% → rejects
      ).rejects.toThrow('Insufficient availability')
    })
  })

  describe('reserveRoomInventory auto-lookup', () => {
    it('allows overbooking via policy when no explicit percent given', async () => {
      // 1. Create room type and date range
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(20)
      const checkOut = dateHelpers.daysFromNow(21)

      // 2. Sell out inventory (capacity = 10, available = 0)
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

      // 3. Create 110% policy (maxAllowed = 11)
      // 110% policy → maxAllowed = 11, sold = 10
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 110,
      })

      // 4. Reserve 1 room with no explicit percent → auto-lookup
      // No overbookingPercent arg → auto-lookup → should succeed
      const result = await reserveRoomInventory(rt.id, checkIn, checkOut, 1, db)
      // Policy allows → reservation succeeds
      expect(result.ok).toBe(true)
    })
  })

  describe('createReservation auto-lookup', () => {
    it('uses policy-based overbooking when overbookingPercent not provided', async () => {
      // 1. Create user, guest, room type, and date range
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(30)
      const checkOut = dateHelpers.daysFromNow(31)

      // 2. Sell out inventory
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

      // 3. Create 120% hotel-wide policy
      // 120% hotel-wide policy
      await createTestOverbookingPolicy(db, {
        roomTypeId: null,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 120,
      })

      // 4. Create reservation without overbookingPercent → auto-lookup
      const result = await createReservation({
        reservation: {
          reservationNumber: 'OVRB001',
          guestId: guest.id,
          guestNameSnapshot: 'Test Guest',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adultsCount: 1,
          status: 'confirmed',
          source: 'direct',
          createdBy: user.id,
        },
        rooms: [{
          roomTypeId: rt.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          dailyRates: [{ date: checkIn, rate: '100.00' }],
        }],
        // no overbookingPercent → auto-lookup from policy
      }, db)

      // Policy allows → reservation created
      expect(result.id).toBeDefined()
    })
  })

  describe('createGroupReservation auto-lookup', () => {
    it('uses policy when no overbookingPercent provided', async () => {
      // 1. Create user, guest, room type, and date range
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(40)
      const checkOut = dateHelpers.daysFromNow(41)

      // 2. Sell out inventory
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

      // 3. Create 110% room-type policy
      // 110% policy on this room type
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 110,
      })

      // 4. Create group reservation without overbookingPercent → auto-lookup
      const result = await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Policy Test Group',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          // no overbookingPercent → auto-lookup
          rooms: [{ roomTypeId: rt.id, dailyRate: '100.00' }],
        },
        user.id,
        db,
      )

      // Policy allows → group created with 1 room
      expect(result.rooms).toHaveLength(1)
    })
  })
})
