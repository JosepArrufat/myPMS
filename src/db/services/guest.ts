import {
  and,
  asc,
  desc,
  eq,
  ilike,
  ne,
  or,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import { guests } from '../schema/guests.js'
import type { NewGuest } from '../schema/guests.js'
import { reservations } from '../schema/reservations.js'
import { invoices } from '../schema/invoices.js'

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const searchGuestsByDocument = async (
  documentNumber: string,
  db: TxOrDb = defaultDb,
) =>
  db
    .select()
    .from(guests)
    .where(eq(guests.idDocumentNumber, documentNumber))
    .orderBy(asc(guests.lastName), asc(guests.firstName))

export const searchGuestsByPhone = async (
  phone: string,
  db: TxOrDb = defaultDb,
) =>
  db
    .select()
    .from(guests)
    .where(eq(guests.phone, phone))
    .orderBy(asc(guests.lastName), asc(guests.firstName))

export const searchGuestsByEmail = async (
  email: string,
  db: TxOrDb = defaultDb,
) =>
  db
    .select()
    .from(guests)
    .where(eq(guests.email, email))
    .orderBy(asc(guests.lastName), asc(guests.firstName))

export const searchGuestsFuzzy = async (
  term: string,
  db: TxOrDb = defaultDb,
) =>
  db
    .select()
    .from(guests)
    .where(
      or(
        ilike(guests.firstName, `%${term}%`),
        ilike(guests.lastName, `%${term}%`),
        ilike(guests.email, `%${term}%`),
        ilike(guests.phone, `%${term}%`),
        ilike(guests.idDocumentNumber, `%${term}%`),
      ),
    )
    .orderBy(asc(guests.lastName), asc(guests.firstName))

export const setVipStatus = async (
  guestId: string,
  vipStatus: boolean,
  db: TxOrDb = defaultDb,
) => {
  const [updated] = await db
    .update(guests)
    .set({ vipStatus })
    .where(eq(guests.id, guestId))
    .returning()

  if (!updated) throw new Error('guest not found')
  return updated
}

export const setLoyaltyNumber = async (
  guestId: string,
  loyaltyNumber: string,
  db: TxOrDb = defaultDb,
) => {
  const [updated] = await db
    .update(guests)
    .set({ loyaltyNumber })
    .where(eq(guests.id, guestId))
    .returning()

  if (!updated) throw new Error('guest not found')
  return updated
}

export const listVipGuests = async (db: TxOrDb = defaultDb) =>
  db
    .select()
    .from(guests)
    .where(eq(guests.vipStatus, true))
    .orderBy(asc(guests.lastName), asc(guests.firstName))

export const getGuestHistory = async (
  guestId: string,
  db: TxOrDb = defaultDb,
) => {
  const stayHistory = await db
    .select({
      id: reservations.id,
      reservationNumber: reservations.reservationNumber,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
      status: reservations.status,
      totalAmount: reservations.totalAmount,
      source: reservations.source,
    })
    .from(reservations)
    .where(eq(reservations.guestId, guestId))
    .orderBy(desc(reservations.checkInDate))

  const completedStays = stayHistory.filter(
    (r) => r.status === 'checked_out',
  )
  const totalSpend = completedStays.reduce(
    (sum, r) => sum + parseFloat(String(r.totalAmount ?? '0')),
    0,
  )

  return {
    stays: stayHistory,
    stats: {
      totalStays: completedStays.length,
      totalReservations: stayHistory.length,
      totalSpend: totalSpend.toFixed(2),
    },
  }
}


export const findDuplicates = async (
  guestId: string,
  db: TxOrDb = defaultDb,
) => {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1)

  if (!guest) throw new Error('guest not found')

  const conditions = []
  if (guest.email) {
    conditions.push(eq(guests.email, guest.email))
  }
  if (guest.phone) {
    conditions.push(eq(guests.phone, guest.phone))
  }
  if (guest.idDocumentNumber) {
    conditions.push(eq(guests.idDocumentNumber, guest.idDocumentNumber))
  }

  if (conditions.length === 0) return []

  return db
    .select()
    .from(guests)
    .where(
      and(
        ne(guests.id, guestId),
        or(...conditions),
      ),
    )
    .orderBy(asc(guests.lastName), asc(guests.firstName))
}


export const mergeGuests = async (
  primaryGuestId: string,
  secondaryGuestId: string,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [primary] = await tx
      .select()
      .from(guests)
      .where(eq(guests.id, primaryGuestId))
      .limit(1)
    if (!primary) throw new Error('primary guest not found')

    const [secondary] = await tx
      .select()
      .from(guests)
      .where(eq(guests.id, secondaryGuestId))
      .limit(1)
    if (!secondary) throw new Error('secondary guest not found')

    await tx
      .update(reservations)
      .set({ guestId: primaryGuestId })
      .where(eq(reservations.guestId, secondaryGuestId))

    await tx
      .update(invoices)
      .set({ guestId: primaryGuestId })
      .where(eq(invoices.guestId, secondaryGuestId))

    const mergedPrefs: Partial<NewGuest> = {}
    if (!primary.phone && secondary.phone) mergedPrefs.phone = secondary.phone
    if (!primary.email && secondary.email) mergedPrefs.email = secondary.email
    if (!primary.dateOfBirth && secondary.dateOfBirth) mergedPrefs.dateOfBirth = secondary.dateOfBirth
    if (!primary.nationality && secondary.nationality) mergedPrefs.nationality = secondary.nationality
    if (!primary.idDocumentNumber && secondary.idDocumentNumber) {
      mergedPrefs.idDocumentType = secondary.idDocumentType
      mergedPrefs.idDocumentNumber = secondary.idDocumentNumber
      mergedPrefs.idDocumentExpiry = secondary.idDocumentExpiry
      mergedPrefs.idDocumentCountry = secondary.idDocumentCountry
    }
    if (!primary.loyaltyNumber && secondary.loyaltyNumber) {
      mergedPrefs.loyaltyNumber = secondary.loyaltyNumber
    }
    if (secondary.vipStatus && !primary.vipStatus) {
      mergedPrefs.vipStatus = true
    }

    if (Object.keys(mergedPrefs).length > 0) {
      await tx
        .update(guests)
        .set(mergedPrefs)
        .where(eq(guests.id, primaryGuestId))
    }

    await tx.delete(guests).where(eq(guests.id, secondaryGuestId))

    const [merged] = await tx
      .select()
      .from(guests)
      .where(eq(guests.id, primaryGuestId))
      .limit(1)

    return merged
  })
}
