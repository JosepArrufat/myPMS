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
      // 1. Seed room inventory with 1 room already booked (9 of 10 available)
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

      // 2. Create a confirmed reservation spanning two nights
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-03',
      })

      // 3. Attach a room allocation to the reservation
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-03',
      })

      // 4. Cancel the reservation with a fee
      const result = await cancelReservation(
        reservation.id,
        userId,
        'guest request',
        '50.00',
        db,
      )

      // status, reason, fee, and timestamp are set
      expect(result.status).toBe('cancelled')
      expect(result.cancellationReason).toBe('guest request')
      expect(result.cancellationFee).toBe('50.00')
      expect(result.cancelledAt).toBeTruthy()

      // 5. Verify inventory was restored to full capacity
      const inv = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomTypeId, roomTypeId))

      for (const row of inv) {
        expect(row.available).toBe(10)
      }
    })

    it('rejects if reservation is already cancelled', async () => {
      // 1. Create a reservation that is already cancelled
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'cancelled',
      })

      // 2. Attempt to cancel again
      // should throw — double cancellation is not allowed
      await expect(
        cancelReservation(reservation.id, userId, 'double cancel', '0', db),
      ).rejects.toThrow()
    })

    it('rejects if reservation is checked in', async () => {
      // 1. Create a reservation that is already checked in
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'checked_in',
      })

      // 2. Attempt to cancel a checked-in reservation
      // should throw — can't cancel after check-in
      await expect(
        cancelReservation(reservation.id, userId, 'too late', '0', db),
      ).rejects.toThrow()
    })
  })

  describe('markNoShow', () => {
    it('sets status to no_show and restores inventory', async () => {
      // 1. Seed inventory with 1 room booked (4 of 5 available)
      await createTestRoomInventory(db, {
        roomTypeId,
        date: '2026-04-01',
        capacity: 5,
        available: 4,
      })

      // 2. Create a confirmed one-night reservation
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-02',
      })

      // 3. Attach a room allocation
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId,
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-02',
      })

      // 4. Mark the reservation as a no-show
      const result = await markNoShow(reservation.id, userId, db)

      // status updated
      expect(result.status).toBe('no_show')

      // 5. Verify inventory was restored to full capacity
      const [inv] = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.roomTypeId, roomTypeId))

      expect(inv.available).toBe(5)
    })

    it('rejects if reservation is not confirmed', async () => {
      // 1. Create a reservation in pending status
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'pending',
      })

      // 2. Attempt to mark as no-show
      // should throw — only confirmed reservations can be no-showed
      await expect(
        markNoShow(reservation.id, userId, db),
      ).rejects.toThrow()
    })
  })
})
