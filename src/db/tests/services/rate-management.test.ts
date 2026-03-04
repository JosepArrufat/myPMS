import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest'

import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../setup'

import {
  createTestUser,
  createTestGuest,
  createTestRoomType,
  createTestReservation,
  createTestReservationRoom,
  createTestRatePlan,
} from '../factories'

import { reservationDailyRates } from '../../schema/reservations'
import { systemConfig } from '../../schema/system'

import {
  setRoomTypeRate,
  getEffectiveRate,
  overrideReservationRate,
  recalculateReservationTotal,
  createRateAdjustment,
  getDerivedRate,
} from '../../services/rate-management'

// Business date '2026-02-01' is before all test dates ('2026-03-xx') so happy paths pass.
// Unhappy paths use a date before BD to confirm the guard fires.
const BUSINESS_DATE = '2026-02-01'

describe('Rate management service', () => {
  const db = getTestDb()
  let userId: number
  let guestId: string

  beforeEach(async () => {
    await cleanupTestDb(db)
    await db.insert(systemConfig)
      .values({ key: 'business_date', value: BUSINESS_DATE })
      .onConflictDoUpdate({ target: systemConfig.key, set: { value: BUSINESS_DATE } })
    const user = await createTestUser(db)
    userId = user.id
    const guest = await createTestGuest(db)
    guestId = guest.id
  })

  afterAll(async () => {
    await cleanupTestDb(db)
    await verifyDbIsEmpty(db)
  })

  describe('setRoomTypeRate', () => {
    it('creates a rate for a room type + rate plan', async () => {
      // 1. Create a room type and a rate plan
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      // 2. Set a $120 rate for that room type + rate plan combo
      const rate = await setRoomTypeRate(
        roomType.id,
        ratePlan.id,
        '2026-03-01',
        '2026-03-31',
        '120.00',
        db,
      )

      // price matches the value we set
      expect(rate.price).toBe('120.00')
      // rate is linked to the correct room type
      expect(rate.roomTypeId).toBe(roomType.id)
    })
  })

  describe('getEffectiveRate', () => {
    it('returns rate plan price when rate exists', async () => {
      // 1. Create room type and rate plan
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      // 2. Set a $120 rate plan rate for March
      await setRoomTypeRate(
        roomType.id,
        ratePlan.id,
        '2026-03-01',
        '2026-03-31',
        '120.00',
        db,
      )

      // 3. Query the effective rate for a mid-March date
      const result = await getEffectiveRate(
        roomType.id,
        ratePlan.id,
        '2026-03-15',
        db,
      )

      // result exists
      expect(result).toBeTruthy()
      // returns the rate plan price
      expect(result!.price).toBe('120.00')
      // source is 'rate_plan', not a fallback
      expect(result!.source).toBe('rate_plan')
    })

    it('falls back to base price when no rate plan rate', async () => {
      // 1. Create a room type with $89 base price (no rate plan rate set)
      const roomType = await createTestRoomType(db, { basePrice: '89.00' })
      const ratePlan = await createTestRatePlan(db)

      // 2. Query effective rate for a date with no rate plan coverage
      const result = await getEffectiveRate(
        roomType.id,
        ratePlan.id,
        '2026-06-01',
        db,
      )

      // result exists
      expect(result).toBeTruthy()
      // falls back to the room type's base price
      expect(result!.price).toBe('89.00')
      // source confirms it came from base_price fallback
      expect(result!.source).toBe('base_price')
    })
  })

  describe('overrideReservationRate', () => {
    it('overrides daily rates for a reservation room', async () => {
      // 1. Create reservation with a room (2-night stay)
      const roomType = await createTestRoomType(db)
      const reservation = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-03',
      })
      const resRoom = await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-03',
      })

      // 2. Insert 2 daily rates at $100 each
      await db.insert(reservationDailyRates).values([
        {
          reservationRoomId: resRoom.id,
          date: '2026-03-01',
          rate: '100.00',
          createdBy: userId,
        },
        {
          reservationRoomId: resRoom.id,
          date: '2026-03-02',
          rate: '100.00',
          createdBy: userId,
        },
      ])

      // 3. Override both nights to $80
      const updated = await overrideReservationRate(
        reservation.id,
        '2026-03-01',
        '2026-03-02',
        '80.00',
        userId,
        undefined,
        db,
      )

      // both daily rates were updated
      expect(updated.dailyRates.length).toBe(2)
      // each night is now $80
      expect(updated.dailyRates[0].rate).toBe('80.00')
      expect(updated.dailyRates[1].rate).toBe('80.00')
    })

    it('throws when no rooms found for reservation', async () => {
      // 1. Attempt to override rates using a non-existent reservation ID
      await expect(
        overrideReservationRate(
          '00000000-0000-0000-0000-000000000000',
          '2026-01-01',
          '2026-01-02',
          '80.00',
          userId,
          undefined,
          db,
        ),
      // rejects with a descriptive error
      ).rejects.toThrow('no rooms found')
    })
  })

  describe('recalculateReservationTotal', () => {
    it('sums daily rates and updates reservation total', async () => {
      // 1. Create reservation with a room (3-night stay, total starts at $0)
      const roomType = await createTestRoomType(db)
      const reservation = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-04',
        totalAmount: '0',
      })
      const resRoom = await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-04',
      })

      // 2. Insert 3 daily rates: $100 + $120 + $110 = $330
      await db.insert(reservationDailyRates).values([
        { reservationRoomId: resRoom.id, date: '2026-03-01', rate: '100.00', createdBy: userId },
        { reservationRoomId: resRoom.id, date: '2026-03-02', rate: '120.00', createdBy: userId },
        { reservationRoomId: resRoom.id, date: '2026-03-03', rate: '110.00', createdBy: userId },
      ])

      // 3. Recalculate the reservation total from its daily rates
      const updated = await recalculateReservationTotal(reservation.id, userId, db)

      // total equals the sum of all daily rates
      expect(parseFloat(String(updated.totalAmount))).toBe(330)
    })
  })

  describe('createRateAdjustment + getDerivedRate', () => {
    it('derives rate using amount adjustment', async () => {
      // 1. Create base room type and derived room type
      const baseType = await createTestRoomType(db, { basePrice: '100.00' })
      const derivedType = await createTestRoomType(db, { basePrice: '200.00' })
      const ratePlan = await createTestRatePlan(db)

      // 2. Set base rate to $100 and create a +$50 amount adjustment
      await setRoomTypeRate(baseType.id, ratePlan.id, '2026-03-01', '2026-03-31', '100.00', db)
      await createRateAdjustment(baseType.id, derivedType.id, 'amount', '50.00', undefined, db)

      // 3. Query the derived rate
      const result = await getDerivedRate(baseType.id, derivedType.id, ratePlan.id, '2026-03-15', db)

      // result exists
      expect(result).toBeTruthy()
      // derived price = $100 base + $50 adjustment = $150
      expect(result!.price).toBe('150.00')
      // source confirms it was derived
      expect(result!.source).toBe('derived')
    })

    it('derives rate using percent adjustment', async () => {
      // 1. Create base and derived room types
      const baseType = await createTestRoomType(db, { basePrice: '100.00' })
      const derivedType = await createTestRoomType(db, { basePrice: '200.00' })
      const ratePlan = await createTestRatePlan(db)

      // 2. Set base rate to $200 and create a +25% adjustment
      await setRoomTypeRate(baseType.id, ratePlan.id, '2026-03-01', '2026-03-31', '200.00', db)
      await createRateAdjustment(baseType.id, derivedType.id, 'percent', '25.00', undefined, db)

      // 3. Query the derived rate
      const result = await getDerivedRate(baseType.id, derivedType.id, ratePlan.id, '2026-03-15', db)

      // result exists
      expect(result).toBeTruthy()
      // derived price = $200 base + 25% = $250
      expect(result!.price).toBe('250.00')
    })
  })

  describe('guard – rejects past startDate in setRoomTypeRate', () => {
    const PAST_DATE = '2026-01-01' // before BUSINESS_DATE '2026-02-01'

    it('rejects setRoomTypeRate with a past startDate (unhappy path)', async () => {
      // 1. Create room type and rate plan
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      // 2. Attempt to set a rate with a start date before the business date
      await expect(
        setRoomTypeRate(roomType.id, ratePlan.id, PAST_DATE, '2026-01-31', '110.00', db),
      // guard rejects with an error about the start date
      ).rejects.toThrow('Rate start date')
    })

    it('allows setRoomTypeRate with a future startDate (happy path)', async () => {
      // 1. Create room type and rate plan
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      // 2. Set a rate with a future start date (after the business date)
      const rate = await setRoomTypeRate(roomType.id, ratePlan.id, '2026-03-01', '2026-03-31', '130.00', db)
      // guard allows it; rate is created successfully
      expect(rate.price).toBe('130.00')
    })
  })
})
