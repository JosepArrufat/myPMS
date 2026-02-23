import {
  and,
  eq,
  isNull,
} from 'drizzle-orm'

import { db as defaultDb } from '../index.js'
import {
  roomAssignments,
  reservationRooms,
  reservations,
} from '../schema/reservations.js'
import { rooms } from '../schema/rooms.js'
import { type TxOrDb, dateRange } from '../utils.js'

// Assigns a physical room to a reservation for its entire stay.
// The room's type is used to find the first unassigned slot in reservation_rooms
// that matches — this handles multi-room reservations correctly: if a reservation
// holds 2 Standard slots and you assign room 101 (Standard), only one slot is
// filled; calling again with room 102 fills the second.
export const assignRoom = async (
  reservationId: string,
  roomId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    // Resolve stay dates from the reservation itself
    const [res] = await tx
      .select({ checkInDate: reservations.checkInDate, checkOutDate: reservations.checkOutDate })
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1)
    if (!res) throw new Error('reservation not found')

    // Find the room's type
    const [room] = await tx
      .select({ roomTypeId: rooms.roomTypeId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1)
    if (!room) throw new Error('room not found')

    // Insert one row per night
    const dates = dateRange(res.checkInDate, res.checkOutDate)
    const rows = dates.map((d) => ({
      reservationId,
      roomId,
      date: d,
      assignedBy: userId,
    }))

    const assignments = await tx
      .insert(roomAssignments)
      .values(rows)
      .returning()

    // Fill the first unassigned slot of the matching room type
    const [targetSlot] = await tx
      .select({ id: reservationRooms.id })
      .from(reservationRooms)
      .where(
        and(
          eq(reservationRooms.reservationId, reservationId),
          eq(reservationRooms.roomTypeId, room.roomTypeId),
          isNull(reservationRooms.roomId),
        ),
      )
      .limit(1)

    if (targetSlot) {
      await tx
        .update(reservationRooms)
        .set({ roomId, assignedAt: new Date(), assignedBy: userId })
        .where(eq(reservationRooms.id, targetSlot.id))
    }

    return assignments
  })
}

export const unassignRoom = async (
  reservationId: string,
  roomId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    // Remove all nightly assignment rows for this room
    await tx
      .delete(roomAssignments)
      .where(
        and(
          eq(roomAssignments.reservationId, reservationId),
          eq(roomAssignments.roomId, roomId),
        ),
      )

    // Clear the room reference from reservation_rooms
    await tx
      .update(reservationRooms)
      .set({ roomId: null, assignedAt: null, assignedBy: null })
      .where(
        and(
          eq(reservationRooms.reservationId, reservationId),
          eq(reservationRooms.roomId, roomId),
        ),
      )

    return { ok: true }
  })
}
