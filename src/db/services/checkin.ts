import {
  and,
  eq,
  ne,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import { reservations } from '../schema/reservations.js'
import { rooms } from '../schema/rooms.js'
import { assertCheckInDate } from '../guards.js'

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const canCheckIn = async (
  roomId: number,
  db: DbConnection = defaultDb,
) => {
  const [room] = await db
    .select({
      status: rooms.status,
      cleanlinessStatus: rooms.cleanlinessStatus,
    })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1)

  if (!room) {
    return { allowed: false, reason: 'room not found' }
  }

  if (room.status !== 'available') {
    return { allowed: false, reason: 'room not available' }
  }

  if (room.cleanlinessStatus === 'dirty') {
    return { allowed: false, reason: 'room not clean' }
  }

  return { allowed: true, reason: null }
}

export const checkInReservation = async (
  reservationId: string,
  roomId: number,
  guestId: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ guestId: reservations.guestId, checkInDate: reservations.checkInDate })
      .from(reservations)
      .where(eq(reservations.id, reservationId))
      .limit(1)

    if (!existing) throw new Error('reservation not found')

    // Guard: check-in is only allowed on the reservation's check-in date
    await assertCheckInDate(existing.checkInDate, tx)

    if (!existing.guestId && !guestId) {
      throw new Error('guestId is required at check-in')
    }

    const [room] = await tx
      .update(rooms)
      .set({ status: 'occupied' })
      .where(
        and(
          eq(rooms.id, roomId),
          eq(rooms.status, 'available'),
          ne(rooms.cleanlinessStatus, 'dirty'),
        ),
      )
      .returning()

    if (!room) {
      throw new Error('room not available or not clean')
    }

    const updateSet: Record<string, any> = {
      status: 'checked_in',
      actualCheckInTime: new Date(),
      modifiedBy: userId,
    }

    if (guestId && guestId !== existing.guestId) {
      updateSet.guestId = guestId
    }

    const [reservation] = await tx
      .update(reservations)
      .set(updateSet)
      .where(
        and(
          eq(reservations.id, reservationId),
          eq(reservations.status, 'confirmed'),
        ),
      )
      .returning()

    if (!reservation) {
      throw new Error('reservation not found or not confirmed')
    }

    return { reservation, room }
  })
}
