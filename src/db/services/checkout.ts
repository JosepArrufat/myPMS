import {
  and,
  eq,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import { reservations } from '../schema/reservations.js'
import { rooms } from '../schema/rooms.js'
import { housekeepingTasks } from '../schema/housekeeping.js'
import { writeAudit } from '../utils.js'

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const checkoutReservation = async (
  reservationId: string,
  roomId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .update(reservations)
      .set({
        status: 'checked_out',
        actualCheckOutTime: new Date(),
        modifiedBy: userId,
      })
      .where(
        and(
          eq(reservations.id, reservationId),
          eq(reservations.status, 'checked_in'),
        ),
      )
      .returning()

    if (!reservation) {
      throw new Error('reservation not found or not checked in')
    }

    await writeAudit('reservations', reservation.id, 'update', {
      userId,
      oldValues: { status: 'checked_in' },
      newValues: { status: 'checked_out' },
    }, tx)

    await tx
      .update(rooms)
      .set({
        status: 'available',
        cleanlinessStatus: 'dirty',
      })
      .where(eq(rooms.id, roomId))

    const [task] = await tx
      .insert(housekeepingTasks)
      .values({
        roomId,
        taskDate: reservation.checkOutDate,
        taskType: 'checkout_cleaning',
        status: 'pending',
        createdBy: userId,
      })
      .returning()

    return { reservation, task }
  })
}
