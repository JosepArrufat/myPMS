import {
  and,
  eq,
  isNull,
  lte,
  gte,
  sql,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from './index.js'
import { roomInventory } from './schema/roomInventory.js'
import { overbookingPolicies } from './schema/overbooking.js'

type DbConnection = typeof defaultDb
export type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const dateRange = (start: string, end: string): string[] => {
  const dates: string[] = []
  const cursor = new Date(start)
  const last = new Date(end)
  while (cursor < last) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export interface AvailabilityRequest {
  roomTypeId: number
  quantity: number
}

// ─── Lookup overbooking percent from policy table ───────────────────
/**
 * Priority: room-type-specific policy → hotel-wide policy → 100 (none).
 */
export const lookupOverbookingPercent = async (
  roomTypeId: number,
  date: string,
  tx: TxOrDb,
): Promise<number> => {
  // 1. Room-type-specific policy
  const [specific] = await tx
    .select({ overbookingPercent: overbookingPolicies.overbookingPercent })
    .from(overbookingPolicies)
    .where(
      and(
        eq(overbookingPolicies.roomTypeId, roomTypeId),
        lte(overbookingPolicies.startDate, date),
        gte(overbookingPolicies.endDate, date),
      ),
    )
    .limit(1)

  if (specific) return specific.overbookingPercent

  // 2. Hotel-wide fallback
  const [hotelWide] = await tx
    .select({ overbookingPercent: overbookingPolicies.overbookingPercent })
    .from(overbookingPolicies)
    .where(
      and(
        isNull(overbookingPolicies.roomTypeId),
        lte(overbookingPolicies.startDate, date),
        gte(overbookingPolicies.endDate, date),
      ),
    )
    .limit(1)

  if (hotelWide) return hotelWide.overbookingPercent

  // 3. Default — no overbooking
  return 100
}

// ─── Validate availability (with optional auto-lookup) ──────────────
/**
 * When `overbookingPercent` is omitted (undefined), the function
 * auto-looks-up the effective policy per room type per night.
 * Pass an explicit number to override (e.g. manager override).
 */
export const validateAvailability = async (
  requests: AvailabilityRequest[],
  checkIn: string,
  checkOut: string,
  overbookingPercent: number | undefined,
  tx: TxOrDb,
) => {
  const nights = dateRange(checkIn, checkOut)

  const byType = new Map<number, number>()
  for (const r of requests) {
    byType.set(r.roomTypeId, (byType.get(r.roomTypeId) ?? 0) + r.quantity)
  }

  for (const [rtId, requestedQty] of byType) {
    for (const night of nights) {
      const rows = await tx.execute(sql`
        SELECT available, capacity
        FROM room_inventory
        WHERE room_type_id = ${rtId}
          AND date = ${night}
        LIMIT 1
        FOR UPDATE
      `)

      const inv = (rows as any)[0]

      if (!inv) {
        throw new Error(
          `No inventory row for room type ${rtId} on ${night}`,
        )
      }

      // Auto-lookup from policy table when caller didn't specify
      const effectivePct = overbookingPercent
        ?? await lookupOverbookingPercent(rtId, night, tx)

      const available = Number(inv.available)
      const capacity = Number(inv.capacity)
      const maxAllowed = Math.floor(capacity * effectivePct / 100)
      const sold = capacity - available
      const remainingSlots = maxAllowed - sold

      if (remainingSlots < requestedQty) {
        throw new Error(
          `Insufficient availability for room type ${rtId} on ${night}: ` +
          `${remainingSlots} slot(s) remaining, ${requestedQty} requested ` +
          `(overbooking ${effectivePct}%)`,
        )
      }
    }
  }
}


export const decrementInventory = async (
  roomTypeId: number,
  checkIn: string,
  checkOut: string,
  quantity: number,
  tx: TxOrDb,
) => {
  await tx
    .update(roomInventory)
    .set({ available: sql`${roomInventory.available} - ${quantity}` })
    .where(
      and(
        eq(roomInventory.roomTypeId, roomTypeId),
        sql`${roomInventory.date} >= ${checkIn}`,
        sql`${roomInventory.date} < ${checkOut}`,
      ),
    )
}


export const incrementInventory = async (
  roomTypeId: number,
  checkIn: string,
  checkOut: string,
  quantity: number,
  tx: TxOrDb,
) => {
  await tx
    .update(roomInventory)
    .set({ available: sql`${roomInventory.available} + ${quantity}` })
    .where(
      and(
        eq(roomInventory.roomTypeId, roomTypeId),
        sql`${roomInventory.date} >= ${checkIn}`,
        sql`${roomInventory.date} < ${checkOut}`,
      ),
    )
}
