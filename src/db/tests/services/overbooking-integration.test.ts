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
      const rt = await createTestRoomType(db)

      // hotel-wide 120%
      await createTestOverbookingPolicy(db, {
        roomTypeId: null,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 120,
      })

      // room-type-specific 105%
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 105,
      })

      const pct = await lookupOverbookingPercent(rt.id, '2026-03-15', db)
      expect(pct).toBe(105)
    })

    it('falls back to hotel-wide when no specific policy', async () => {
      const rt = await createTestRoomType(db)
      await createTestOverbookingPolicy(db, {
        roomTypeId: null,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 115,
      })

      const pct = await lookupOverbookingPercent(rt.id, '2026-03-15', db)
      expect(pct).toBe(115)
    })

    it('returns 100 when no policy covers the date', async () => {
      const rt = await createTestRoomType(db)
      const pct = await lookupOverbookingPercent(rt.id, '2026-06-01', db)
      expect(pct).toBe(100)
    })
  })

  describe('validateAvailability auto-lookup', () => {
    it('auto-allows overbooking when policy exists and percent is undefined', async () => {
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(10)
      const checkOut = dateHelpers.daysFromNow(11)

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0, // fully sold
      })

      // 120% policy → maxAllowed = 12, sold = 10, remaining = 2
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 120,
      })

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
      ).resolves.not.toThrow()
    })

    it('rejects when no policy and fully sold (default 100%)', async () => {
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(10)
      const checkOut = dateHelpers.daysFromNow(11)

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

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
      ).rejects.toThrow('Insufficient availability')
    })

    it('explicit override takes precedence over policy', async () => {
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(10)
      const checkOut = dateHelpers.daysFromNow(11)

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

      // Policy says 120% (would allow)
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 120,
      })

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
      ).rejects.toThrow('Insufficient availability')
    })
  })

  describe('reserveRoomInventory auto-lookup', () => {
    it('allows overbooking via policy when no explicit percent given', async () => {
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(20)
      const checkOut = dateHelpers.daysFromNow(21)

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

      // 110% policy → maxAllowed = 11, sold = 10
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 110,
      })

      // No overbookingPercent arg → auto-lookup → should succeed
      const result = await reserveRoomInventory(rt.id, checkIn, checkOut, 1, db)
      expect(result.ok).toBe(true)
    })
  })

  describe('createReservation auto-lookup', () => {
    it('uses policy-based overbooking when overbookingPercent not provided', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(30)
      const checkOut = dateHelpers.daysFromNow(31)

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

      // 120% hotel-wide policy
      await createTestOverbookingPolicy(db, {
        roomTypeId: null,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 120,
      })

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

      expect(result.id).toBeDefined()
    })
  })

  describe('createGroupReservation auto-lookup', () => {
    it('uses policy when no overbookingPercent provided', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(40)
      const checkOut = dateHelpers.daysFromNow(41)

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0,
      })

      // 110% policy on this room type
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: checkIn,
        endDate: checkOut,
        overbookingPercent: 110,
      })

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

      expect(result.rooms).toHaveLength(1)
    })
  })
})
