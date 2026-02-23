import {
  and,
  eq,
  gte,
  lte,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import {
  roomTypeRates,
  roomTypeRateAdjustments,
} from '../schema/rates.js'
import {
  reservations,
  reservationDailyRates,
  reservationRooms,
} from '../schema/reservations.js'
import { roomTypes } from '../schema/rooms.js'

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const setRoomTypeRate = async (
  roomTypeId: number,
  ratePlanId: number,
  startDate: string,
  endDate: string,
  price: string,
  db: TxOrDb = defaultDb,
) => {
  const [rate] = await db
    .insert(roomTypeRates)
    .values({
      roomTypeId,
      ratePlanId,
      startDate,
      endDate,
      price,
    })
    .returning()

  return rate
}

export const getEffectiveRate = async (
  roomTypeId: number,
  ratePlanId: number,
  date: string,
  db: TxOrDb = defaultDb,
) => {
  const [rate] = await db
    .select()
    .from(roomTypeRates)
    .where(
      and(
        eq(roomTypeRates.roomTypeId, roomTypeId),
        eq(roomTypeRates.ratePlanId, ratePlanId),
        lte(roomTypeRates.startDate, date),
        gte(roomTypeRates.endDate, date),
      ),
    )
    .limit(1)

  if (!rate) {
    const [rt] = await db
      .select({ basePrice: roomTypes.basePrice })
      .from(roomTypes)
      .where(eq(roomTypes.id, roomTypeId))
      .limit(1)

    return rt ? { price: rt.basePrice, source: 'base_price' as const } : null
  }

  return { price: rate.price, source: 'rate_plan' as const }
}

export const overrideReservationRate = async (
  reservationId: string,
  startDate: string,
  endDate: string,
  newRate: string,
  userId: number,
  reservationRoomId?: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const targetRooms = reservationRoomId
      ? [{ id: reservationRoomId }]
      : await tx
          .select({ id: reservationRooms.id })
          .from(reservationRooms)
          .where(eq(reservationRooms.reservationId, reservationId))

    if (targetRooms.length === 0) {
      throw new Error('no rooms found for this reservation')
    }

    const allUpdated = []
    for (const room of targetRooms) {
      const rows = await tx
        .update(reservationDailyRates)
        .set({ rate: newRate, modifiedBy: userId })
        .where(
          and(
            eq(reservationDailyRates.reservationRoomId, room.id),
            gte(reservationDailyRates.date, startDate),
            lte(reservationDailyRates.date, endDate),
          ),
        )
        .returning()
      allUpdated.push(...rows)
    }

    if (allUpdated.length === 0) {
      throw new Error('no daily rates found for the given range')
    }

    const allRooms = await tx
      .select({ id: reservationRooms.id })
      .from(reservationRooms)
      .where(eq(reservationRooms.reservationId, reservationId))

    let total = 0
    for (const room of allRooms) {
      const rates = await tx
        .select({ rate: reservationDailyRates.rate })
        .from(reservationDailyRates)
        .where(eq(reservationDailyRates.reservationRoomId, room.id))
      total += rates.reduce((sum, r) => sum + parseFloat(String(r.rate)), 0)
    }

    const [reservation] = await tx
      .update(reservations)
      .set({ totalAmount: total.toFixed(2), modifiedBy: userId })
      .where(eq(reservations.id, reservationId))
      .returning()

    return { dailyRates: allUpdated, reservation }
  })
}

export const recalculateReservationTotal = async (
  reservationId: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const resRooms = await tx
      .select({ id: reservationRooms.id })
      .from(reservationRooms)
      .where(eq(reservationRooms.reservationId, reservationId))

    let total = 0
    for (const rr of resRooms) {
      const rates = await tx
        .select({ rate: reservationDailyRates.rate })
        .from(reservationDailyRates)
        .where(eq(reservationDailyRates.reservationRoomId, rr.id))

      total += rates.reduce(
        (sum, r) => sum + parseFloat(String(r.rate)),
        0,
      )
    }

    const [updated] = await tx
      .update(reservations)
      .set({
        totalAmount: total.toFixed(2),
        modifiedBy: userId,
      })
      .where(eq(reservations.id, reservationId))
      .returning()

    return updated
  })
}

export const createRateAdjustment = async (
  baseRoomTypeId: number,
  derivedRoomTypeId: number,
  adjustmentType: 'amount' | 'percent',
  adjustmentValue: string,
  ratePlanId?: number,
  db: TxOrDb = defaultDb,
) => {
  const [adjustment] = await db
    .insert(roomTypeRateAdjustments)
    .values({
      baseRoomTypeId,
      derivedRoomTypeId,
      adjustmentType,
      adjustmentValue,
      ratePlanId: ratePlanId ?? null,
    })
    .returning()

  return adjustment
}

export const updateBaseRateAndPropagate = async (
  baseRoomTypeId: number,
  ratePlanId: number,
  startDate: string,
  endDate: string,
  newPrice: string,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const baseRate = await setRoomTypeRate(
      baseRoomTypeId,
      ratePlanId,
      startDate,
      endDate,
      newPrice,
      tx,
    )

    const adjustments = await tx
      .select()
      .from(roomTypeRateAdjustments)
      .where(eq(roomTypeRateAdjustments.baseRoomTypeId, baseRoomTypeId))

    const derivedRates: Array<{
      roomTypeId: number
      price: string
      adjustmentType: string
      adjustmentValue: string
    }> = []

    const base = parseFloat(newPrice)

    for (const adj of adjustments) {
      const value = parseFloat(String(adj.adjustmentValue))
      const derived =
        adj.adjustmentType === 'percent'
          ? base * (1 + value / 100)
          : base + value

      const derivedPrice = derived.toFixed(2)

      await setRoomTypeRate(
        adj.derivedRoomTypeId,
        ratePlanId,
        startDate,
        endDate,
        derivedPrice,
        tx,
      )

      derivedRates.push({
        roomTypeId: adj.derivedRoomTypeId,
        price: derivedPrice,
        adjustmentType: adj.adjustmentType,
        adjustmentValue: String(adj.adjustmentValue),
      })
    }

    return {
      baseRate,
      derivedRates,
    }
  })
}

export const getDerivedRate = async (
  baseRoomTypeId: number,
  derivedRoomTypeId: number,
  ratePlanId: number,
  date: string,
  db: TxOrDb = defaultDb,
) => {
  const baseRate = await getEffectiveRate(baseRoomTypeId, ratePlanId, date, db)
  if (!baseRate) return null

  const [adjustment] = await db
    .select()
    .from(roomTypeRateAdjustments)
    .where(
      and(
        eq(roomTypeRateAdjustments.baseRoomTypeId, baseRoomTypeId),
        eq(roomTypeRateAdjustments.derivedRoomTypeId, derivedRoomTypeId),
      ),
    )
    .limit(1)

  if (!adjustment) {
    return baseRate
  }

  const base = parseFloat(String(baseRate.price))
  const value = parseFloat(String(adjustment.adjustmentValue))

  const derived =
    adjustment.adjustmentType === 'percent'
      ? base * (1 + value / 100)
      : base + value

  return {
    price: derived.toFixed(2),
    source: 'derived' as const,
    basePrice: baseRate.price,
    adjustment: {
      type: adjustment.adjustmentType,
      value: adjustment.adjustmentValue,
    },
  }
}
