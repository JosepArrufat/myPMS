import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest'

import { and, eq } from 'drizzle-orm'

import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../setup'

import {
  createTestUser,
  createTestGuest,
  createTestRoom,
  createTestRoomType,
  createTestReservation,
  createTestReservationRoom,
} from '../factories'

import {
  assignRoom,
  unassignRoom,
} from '../../services/room-assignment'

import { roomAssignments, reservationRooms } from '../../schema/reservations'

describe('Room assignment services', () => {
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

  describe('assignRoom', () => {
    it('creates assignment rows for every date of the stay', async () => {
      const roomType = await createTestRoomType(db)
      const room = await createTestRoom(db, { roomTypeId: roomType.id })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-05-01',
        checkOutDate: '2026-05-04',
      })

      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-05-01',
        checkOutDate: '2026-05-04',
      })

      const assignments = await assignRoom(
        reservation.id,
        room.id,
        userId,
        db,
      )

      expect(assignments).toHaveLength(3)
      expect(assignments.map((a: any) => a.date).sort()).toEqual([
        '2026-05-01',
        '2026-05-02',
        '2026-05-03',
      ])
    })

    it('updates reservation_rooms with assigned room', async () => {
      const roomType = await createTestRoomType(db)
      const room = await createTestRoom(db, { roomTypeId: roomType.id })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-03',
      })

      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-03',
      })

      await assignRoom(
        reservation.id,
        room.id,
        userId,
        db,
      )

      const [rr] = await db
        .select()
        .from(reservationRooms)
        .where(eq(reservationRooms.reservationId, reservation.id))

      expect(rr.roomId).toBe(room.id)
      expect(rr.assignedAt).toBeTruthy()
      expect(rr.assignedBy).toBe(userId)
    })

    it('rejects double-assign on same room + date', async () => {
      const roomType = await createTestRoomType(db)
      const room = await createTestRoom(db, { roomTypeId: roomType.id })

      const res1 = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-03',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: res1.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-03',
      })

      await assignRoom(
        res1.id,
        room.id,
        userId,
        db,
      )

      const res2 = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-07-02',
        checkOutDate: '2026-07-04',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: res2.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-07-02',
        checkOutDate: '2026-07-04',
      })

      await expect(
        assignRoom(res2.id, room.id, userId, db),
      ).rejects.toThrow()
    })
  })

  describe('unassignRoom', () => {
    it('removes all assignment rows and clears reservation_rooms', async () => {
      const roomType = await createTestRoomType(db)
      const room = await createTestRoom(db, { roomTypeId: roomType.id })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-08-01',
        checkOutDate: '2026-08-03',
      })

      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-08-01',
        checkOutDate: '2026-08-03',
      })

      await assignRoom(
        reservation.id,
        room.id,
        userId,
        db,
      )

      await unassignRoom(
        reservation.id,
        room.id,
        db,
      )

      const remaining = await db
        .select()
        .from(roomAssignments)
        .where(eq(roomAssignments.reservationId, reservation.id))

      expect(remaining).toHaveLength(0)

      const [rr] = await db
        .select()
        .from(reservationRooms)
        .where(eq(reservationRooms.reservationId, reservation.id))

      expect(rr.roomId).toBeNull()
      expect(rr.assignedAt).toBeNull()
    })
  })
})
