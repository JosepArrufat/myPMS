import {
  and,
  eq,
} from 'drizzle-orm'

import { db as defaultDb } from '../index.js'
import {
  roomAssignments,
  reservationRooms,
} from '../schema/reservations.js'
import { type TxOrDb, dateRange } from '../utils.js'

export const assignRoom = async (
  reservationId: string,
  roomId: number,
  checkInDate: string,
  checkOutDate: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const dates = dateRange(checkInDate, checkOutDate)

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

    await tx
      .update(reservationRooms)
      .set({
        roomId,
        assignedAt: new Date(),
        assignedBy: userId,
      })
      .where(
        and(
          eq(reservationRooms.reservationId, reservationId),
          eq(reservationRooms.checkInDate, checkInDate),
          eq(reservationRooms.checkOutDate, checkOutDate),
        ),
      )

    return assignments
  })
}

export const unassignRoom = async (
  reservationId: string,
  roomId: number,
  checkInDate: string,
  checkOutDate: string,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const dates = dateRange(checkInDate, checkOutDate)

    for (const d of dates) {
      await tx
        .delete(roomAssignments)
        .where(
          and(
            eq(roomAssignments.reservationId, reservationId),
            eq(roomAssignments.roomId, roomId),
            eq(roomAssignments.date, d),
          ),
        )
    }

    await tx
      .update(reservationRooms)
      .set({
        roomId: null,
        assignedAt: null,
        assignedBy: null,
      })
      .where(
        and(
          eq(reservationRooms.reservationId, reservationId),
          eq(reservationRooms.roomId, roomId),
          eq(reservationRooms.checkInDate, checkInDate),
          eq(reservationRooms.checkOutDate, checkOutDate),
        ),
      )

    return { ok: true }
  })
}
