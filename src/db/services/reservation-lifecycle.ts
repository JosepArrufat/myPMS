import {
  and,
  eq,
  ne,
  sql,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import {
  reservationStatusEnum,
  reservations,
  reservationRooms,
} from '../schema/reservations.js'
import { ratePlans } from '../schema/rates.js'
import { rooms } from '../schema/rooms.js'
import { housekeepingTasks } from '../schema/housekeeping.js'
import {
  invoices,
  payments,
} from '../schema/invoices.js'

type ReservationStatus = (typeof reservationStatusEnum.enumValues)[number]
type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>


interface CancellationPolicy {
  isNonRefundable: boolean
  deadlineHours: number | null
  feePercent: number
}


const resolvePolicy = async (
  reservationId: string,
  tx: TxOrDb,
): Promise<CancellationPolicy> => {
  const rows = await tx
    .select({
      isNonRefundable: ratePlans.isNonRefundable,
      deadlineHours: ratePlans.cancellationDeadlineHours,
      feePercent: ratePlans.cancellationFeePercent,
    })
    .from(reservations)
    .innerJoin(ratePlans, eq(reservations.ratePlanId, ratePlans.id))
    .where(eq(reservations.id, reservationId))
    .limit(1)

  if (rows.length) {
    return {
      isNonRefundable: rows[0].isNonRefundable ?? false,
      deadlineHours: rows[0].deadlineHours,
      feePercent: parseFloat(String(rows[0].feePercent ?? '0')),
    }
  }

  const rrRows = await tx
    .select({
      isNonRefundable: ratePlans.isNonRefundable,
      deadlineHours: ratePlans.cancellationDeadlineHours,
      feePercent: ratePlans.cancellationFeePercent,
    })
    .from(reservationRooms)
    .innerJoin(ratePlans, eq(reservationRooms.ratePlanId, ratePlans.id))
    .where(eq(reservationRooms.reservationId, reservationId))
    .limit(1)

  if (rrRows.length) {
    return {
      isNonRefundable: rrRows[0].isNonRefundable ?? false,
      deadlineHours: rrRows[0].deadlineHours,
      feePercent: parseFloat(String(rrRows[0].feePercent ?? '0')),
    }
  }
  return { isNonRefundable: false, deadlineHours: null, feePercent: 0 }
}


const isPastDeadline = (
  policy: CancellationPolicy,
  checkInDate: string,
): boolean => {
  if (policy.isNonRefundable && policy.deadlineHours === null) return true
  if (policy.deadlineHours === null) return false 
  if (policy.deadlineHours === 0) return true 

  const deadlineMs = new Date(checkInDate).getTime() - policy.deadlineHours * 3600_000
  return Date.now() >= deadlineMs
}

const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  pending:     ['confirmed', 'cancelled'],
  confirmed:   ['checked_in', 'cancelled', 'no_show'],
  checked_in:  ['checked_out'],
  checked_out: [],
  cancelled:   [],
  no_show:     [],
}

export const canTransition = (
  from: ReservationStatus,
  to: ReservationStatus,
): boolean => {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export const confirmReservation = async (
  reservationId: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const [reservation] = await db
    .update(reservations)
    .set({
      status: 'confirmed',
      modifiedBy: userId,
    })
    .where(
      and(
        eq(reservations.id, reservationId),
        eq(reservations.status, 'pending'),
      ),
    )
    .returning()

  if (!reservation) {
    throw new Error('reservation not found or cannot be confirmed')
  }

  return reservation
}

export const checkIn = async (
  reservationId: string,
  roomId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
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

    const [reservation] = await tx
      .update(reservations)
      .set({
        status: 'checked_in',
        actualCheckInTime: new Date(),
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

    return { reservation, room }
  })
}

export const checkOut = async (
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

export const cancelReservation = async (
  reservationId: string,
  userId: number,
  reason: string,
  cancellationFee: string = '0',
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const policy = await resolvePolicy(reservationId, tx)

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

    const pastDeadline = isPastDeadline(policy, reservation.checkInDate)
    const releaseInventory = !policy.isNonRefundable && !pastDeadline

    if (releaseInventory) {
      await tx.execute(sql`
        UPDATE room_inventory ri
        SET available = ri.available + sub.cnt
        FROM (
          SELECT room_type_id, COUNT(*)::int AS cnt
          FROM reservation_rooms
          WHERE reservation_id = ${reservationId}
          GROUP BY room_type_id
        ) AS sub
        WHERE ri.room_type_id = sub.room_type_id
          AND ri.date >= ${reservation.checkInDate}
          AND ri.date < ${reservation.checkOutDate}
      `)
    }

    const linkedInvoices = await tx
      .select({ id: invoices.id, paidAmount: invoices.paidAmount })
      .from(invoices)
      .where(eq(invoices.reservationId, reservationId))

    for (const inv of linkedInvoices) {
      const paid = parseFloat(String(inv.paidAmount ?? '0'))
      if (paid > 0) {
        const effectiveFee = (policy.isNonRefundable || pastDeadline)
          ? paid   
          : parseFloat(cancellationFee)
        const refundAmount = Math.max(paid - effectiveFee, 0)

        if (refundAmount > 0) {
          await tx.insert(payments).values({
            invoiceId: inv.id,
            amount: refundAmount.toFixed(2),
            paymentMethod: 'bank_transfer',
            isRefund: true,
            notes: `Cancellation refund: ${reason}`,
            createdBy: userId,
          })

          await tx.execute(sql`
            UPDATE invoices
            SET paid_amount = COALESCE(paid_amount::numeric, 0) - ${refundAmount},
                balance = COALESCE(balance::numeric, 0) + ${refundAmount},
                status = (CASE
                  WHEN COALESCE(paid_amount::numeric, 0) - ${refundAmount} <= 0 THEN 'refunded'
                  ELSE 'partially_paid'
                END)::invoice_status
            WHERE id = ${inv.id}
          `)
        }
      }
    }

    return reservation
  })
}

export const markNoShow = async (
  reservationId: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const policy = await resolvePolicy(reservationId, tx)

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

    if (!policy.isNonRefundable) {
      await tx.execute(sql`
        UPDATE room_inventory ri
        SET available = ri.available + sub.cnt
        FROM (
          SELECT room_type_id, COUNT(*)::int AS cnt
          FROM reservation_rooms
          WHERE reservation_id = ${reservationId}
          GROUP BY room_type_id
        ) AS sub
        WHERE ri.room_type_id = sub.room_type_id
          AND ri.date >= (${reservation.checkInDate}::date + INTERVAL '1 day')::date
          AND ri.date < ${reservation.checkOutDate}
      `)
    }
    return reservation
  })
}

export const detectNoShows = async (
  businessDate: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const overdue = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.status, 'confirmed'),
        sql`${reservations.checkInDate} < ${businessDate}`,
      ),
    )

  const results: Array<{ reservationId: string; status: string }> = []

  for (const r of overdue) {
    const updated = await markNoShow(r.id, userId, db)
    results.push({ reservationId: updated.id, status: 'no_show' })
  }

  return results
}

export const getReservationStatus = async (
  reservationId: string,
  db: TxOrDb = defaultDb,
) => {
  const [reservation] = await db
    .select({
      id: reservations.id,
      status: reservations.status,
      reservationNumber: reservations.reservationNumber,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
    })
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .limit(1)

  if (!reservation) {
    throw new Error('reservation not found')
  }

  return {
    ...reservation,
    allowedTransitions: VALID_TRANSITIONS[reservation.status] ?? [],
  }
}
