import {
  and,
  eq,
  gte,
  lt,
  sql,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import { reservations } from '../schema/reservations.js'

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const cancelReservation = async (
  reservationId: string,
  userId: number,
  reason: string,
  cancellationFee: string = '0',
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .update(reservations)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: reason,
        cancellationFee,
        modifiedBy: userId,
      })
      .where(
        and(
          eq(reservations.id, reservationId),
          sql`${reservations.status} IN ('pending', 'confirmed')`,
        ),
      )
      .returning()

    if (!reservation) {
      throw new Error('reservation not found or cannot be cancelled')
    }

    await tx.execute(sql`
      UPDATE room_inventory
      SET available = available + 1
      WHERE room_type_id IN (
        SELECT room_type_id FROM reservation_rooms
        WHERE reservation_id = ${reservationId}
      )
      AND date >= ${reservation.checkInDate}
      AND date < ${reservation.checkOutDate}
    `)

    return reservation
  })
}

export const markNoShow = async (
  reservationId: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .update(reservations)
      .set({
        status: 'no_show',
        modifiedBy: userId,
      })
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

    await tx.execute(sql`
      UPDATE room_inventory
      SET available = available + 1
      WHERE room_type_id IN (
        SELECT room_type_id FROM reservation_rooms
        WHERE reservation_id = ${reservationId}
      )
      AND date >= ${reservation.checkInDate}
      AND date < ${reservation.checkOutDate}
    `)

    return reservation
  })
}
