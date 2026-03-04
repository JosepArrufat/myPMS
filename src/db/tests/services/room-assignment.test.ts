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
      // 1. Create a room type and a room
      const roomType = await createTestRoomType(db)
      const room = await createTestRoom(db, { roomTypeId: roomType.id })

      // 2. Create a reservation for a 3-night stay (May 1–4)
      const reservation = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-05-01',
        checkOutDate: '2026-05-04',
      })

      // 3. Link the reservation to the room type
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-05-01',
        checkOutDate: '2026-05-04',
      })

      // 4. Assign the room to the reservation
      const assignments = await assignRoom(
        reservation.id,
        room.id,
        userId,
        db,
      )

      // Should produce one assignment row per night
      expect(assignments).toHaveLength(3)
      // Dates should cover May 1, 2, 3 (checkout date excluded)
      expect(assignments.map((a: any) => a.date).sort()).toEqual([
        '2026-05-01',
        '2026-05-02',
        '2026-05-03',
      ])
    })

    it('updates reservation_rooms with assigned room', async () => {
      // 1. Create a room type and a room
      const roomType = await createTestRoomType(db)
      const room = await createTestRoom(db, { roomTypeId: roomType.id })

      // 2. Create a reservation for Jun 1–3
      const reservation = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-03',
      })

      // 3. Link the reservation to the room type
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-03',
      })

      // 4. Assign the room
      await assignRoom(
        reservation.id,
        room.id,
        userId,
        db,
      )

      // 5. Query reservation_rooms to verify the link
      const [rr] = await db
        .select()
        .from(reservationRooms)
        .where(eq(reservationRooms.reservationId, reservation.id))

      // Should set roomId, assignedAt, and assignedBy
      expect(rr.roomId).toBe(room.id)
      expect(rr.assignedAt).toBeTruthy()
      expect(rr.assignedBy).toBe(userId)
    })

    it('rejects double-assign on same room + date', async () => {
      // 1. Create a room type and a room
      const roomType = await createTestRoomType(db)
      const room = await createTestRoom(db, { roomTypeId: roomType.id })

      // 2. Create first reservation (Jul 1–3) with room link
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

      // 3. Assign room to first reservation
      await assignRoom(
        res1.id,
        room.id,
        userId,
        db,
      )

      // 4. Create second reservation overlapping Jul 2–4
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

      // 5. Attempt to assign same room — should reject (conflict on Jul 2)
      await expect(
        assignRoom(res2.id, room.id, userId, db),
      ).rejects.toThrow()
    })
  })

  describe('unassignRoom', () => {
    it('removes all assignment rows and clears reservation_rooms', async () => {
      // 1. Create a room type and a room
      const roomType = await createTestRoomType(db)
      const room = await createTestRoom(db, { roomTypeId: roomType.id })

      // 2. Create a reservation (Aug 1–3) with room link
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

      // 3. Assign the room to the reservation
      await assignRoom(
        reservation.id,
        room.id,
        userId,
        db,
      )

      // 4. Unassign the room
      await unassignRoom(
        reservation.id,
        room.id,
        db,
      )

      // 5. Verify all assignment rows are deleted
      const remaining = await db
        .select()
        .from(roomAssignments)
        .where(eq(roomAssignments.reservationId, reservation.id))

      expect(remaining).toHaveLength(0)

      // Verify reservation_rooms link is cleared
      const [rr] = await db
        .select()
        .from(reservationRooms)
        .where(eq(reservationRooms.reservationId, reservation.id))

      // roomId and assignedAt should be reset to null
      expect(rr.roomId).toBeNull()
      expect(rr.assignedAt).toBeNull()
    })
  })
})
