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
  createTestGuest,
  createTestRoomType,
  createTestReservation,
  createTestReservationRoom,
  createTestRoomInventory,
} from '../factories'

import {
  cancelReservation,
  markNoShow,
} from '../../services/reservation'

import { roomInventory } from '../../schema/roomInventory'
import { reservations } from '../../schema/reservations'

describe('Reservation services', () => {
  const db = getTestDb()
  let userId: number
  let guestId: string
  let roomTypeId: number

  beforeEach(async () => {
    await cleanupTestDb(db)
    const user = await createTestUser(db)
    userId = user.id
    const guest = await createTestGuest(db)
    guestId = guest.id
    const roomType = await createTestRoomType(db)
    roomTypeId = roomType.id
  })

  afterAll(async () => {
    await cleanupTestDb(db)
    await verifyDbIsEmpty(db)
  })

  describe('cancelReservation', () => {
    it('sets status to cancelled and restores inventory', async () => {
      await createTestRoomInventory(db, {
        roomTypeId,
        date: '2026-03-01',
        capacity: 10,
        available: 9,
      })
      await createTestRoomInventory(db, {
        roomTypeId,
        date: '2026-03-02',
        capacity: 10,
        available: 9,
      })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-03',
      })

      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-03',
      })

      const result = await cancelReservation(
        reservation.id,
        userId,
        'guest request',
        '50.00',
        db,
      )

      expect(result.status).toBe('cancelled')
      expect(result.cancellationReason).toBe('guest request')
      expect(result.cancellationFee).toBe('50.00')
      expect(result.cancelledAt).toBeTruthy()

      const inv = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomTypeId, roomTypeId))

      for (const row of inv) {
        expect(row.available).toBe(10)
      }
    })

    it('rejects if reservation is already cancelled', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'cancelled',
      })

      await expect(
        cancelReservation(reservation.id, userId, 'double cancel', '0', db),
      ).rejects.toThrow()
    })

    it('rejects if reservation is checked in', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'checked_in',
      })

      await expect(
        cancelReservation(reservation.id, userId, 'too late', '0', db),
      ).rejects.toThrow()
    })
  })

  describe('markNoShow', () => {
    it('sets status to no_show and restores inventory', async () => {
      await createTestRoomInventory(db, {
        roomTypeId,
        date: '2026-04-01',
        capacity: 5,
        available: 4,
      })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-02',
      })

      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId,
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-02',
      })

      const result = await markNoShow(reservation.id, userId, db)

      expect(result.status).toBe('no_show')

      const [inv] = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomTypeId, roomTypeId))

      expect(inv.available).toBe(5)
    })

    it('rejects if reservation is not confirmed', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'pending',
      })

      await expect(
        markNoShow(reservation.id, userId, db),
      ).rejects.toThrow()
    })
  })
})
