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

import {
  setRoomTypeRate,
  getEffectiveRate,
  overrideReservationRate,
  recalculateReservationTotal,
  createRateAdjustment,
  getDerivedRate,
} from '../../services/rate-management'

describe('Rate management service', () => {
  const db = getTestDb()
  let userId: number
  let guestId: string

  beforeEach(async () => {
    await cleanupTestDb(db)
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
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      const rate = await setRoomTypeRate(
        roomType.id,
        ratePlan.id,
        '2026-03-01',
        '2026-03-31',
        '120.00',
        db,
      )

      expect(rate.price).toBe('120.00')
      expect(rate.roomTypeId).toBe(roomType.id)
    })
  })

  describe('getEffectiveRate', () => {
    it('returns rate plan price when rate exists', async () => {
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      await setRoomTypeRate(
        roomType.id,
        ratePlan.id,
        '2026-03-01',
        '2026-03-31',
        '120.00',
        db,
      )

      const result = await getEffectiveRate(
        roomType.id,
        ratePlan.id,
        '2026-03-15',
        db,
      )

      expect(result).toBeTruthy()
      expect(result!.price).toBe('120.00')
      expect(result!.source).toBe('rate_plan')
    })

    it('falls back to base price when no rate plan rate', async () => {
      const roomType = await createTestRoomType(db, { basePrice: '89.00' })
      const ratePlan = await createTestRatePlan(db)

      const result = await getEffectiveRate(
        roomType.id,
        ratePlan.id,
        '2026-06-01',
        db,
      )

      expect(result).toBeTruthy()
      expect(result!.price).toBe('89.00')
      expect(result!.source).toBe('base_price')
    })
  })

  describe('overrideReservationRate', () => {
    it('overrides daily rates for a reservation room', async () => {
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

      const updated = await overrideReservationRate(
        reservation.id,
        '2026-03-01',
        '2026-03-02',
        '80.00',
        userId,
        undefined,
        db,
      )

      expect(updated.dailyRates.length).toBe(2)
      expect(updated.dailyRates[0].rate).toBe('80.00')
      expect(updated.dailyRates[1].rate).toBe('80.00')
    })

    it('throws when no rooms found for reservation', async () => {
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
      ).rejects.toThrow('no rooms found')
    })
  })

  describe('recalculateReservationTotal', () => {
    it('sums daily rates and updates reservation total', async () => {
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

      await db.insert(reservationDailyRates).values([
        { reservationRoomId: resRoom.id, date: '2026-03-01', rate: '100.00', createdBy: userId },
        { reservationRoomId: resRoom.id, date: '2026-03-02', rate: '120.00', createdBy: userId },
        { reservationRoomId: resRoom.id, date: '2026-03-03', rate: '110.00', createdBy: userId },
      ])

      const updated = await recalculateReservationTotal(reservation.id, userId, db)

      expect(parseFloat(String(updated.totalAmount))).toBe(330)
    })
  })

  describe('createRateAdjustment + getDerivedRate', () => {
    it('derives rate using amount adjustment', async () => {
      const baseType = await createTestRoomType(db, { basePrice: '100.00' })
      const derivedType = await createTestRoomType(db, { basePrice: '200.00' })
      const ratePlan = await createTestRatePlan(db)

      await setRoomTypeRate(baseType.id, ratePlan.id, '2026-03-01', '2026-03-31', '100.00', db)
      await createRateAdjustment(baseType.id, derivedType.id, 'amount', '50.00', undefined, db)

      const result = await getDerivedRate(baseType.id, derivedType.id, ratePlan.id, '2026-03-15', db)

      expect(result).toBeTruthy()
      expect(result!.price).toBe('150.00')
      expect(result!.source).toBe('derived')
    })

    it('derives rate using percent adjustment', async () => {
      const baseType = await createTestRoomType(db, { basePrice: '100.00' })
      const derivedType = await createTestRoomType(db, { basePrice: '200.00' })
      const ratePlan = await createTestRatePlan(db)

      await setRoomTypeRate(baseType.id, ratePlan.id, '2026-03-01', '2026-03-31', '200.00', db)
      await createRateAdjustment(baseType.id, derivedType.id, 'percent', '25.00', undefined, db)

      const result = await getDerivedRate(baseType.id, derivedType.id, ratePlan.id, '2026-03-15', db)

      expect(result).toBeTruthy()
      expect(result!.price).toBe('250.00')
    })
  })
})
