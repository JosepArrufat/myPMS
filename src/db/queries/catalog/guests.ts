import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  guests,
} from '../../schema/guests.js';
import type { NewGuest } from '../../schema/guests.js';
import { sanitiseGuestInput } from '../../../utils/sanitise.js';

type DbConnection = typeof defaultDb;

export const createGuest = async (
  data: NewGuest,
  db: DbConnection = defaultDb,
) => {
  const [guest] = await db
    .insert(guests)
    .values(sanitiseGuestInput(data))
    .returning()

  return guest
}

export const updateGuest = async (
  guestId: string,
  data: Partial<NewGuest>,
  db: DbConnection = defaultDb,
) => {
  const [guest] = await db
    .update(guests)
    .set(sanitiseGuestInput(data))
    .where(eq(guests.id, guestId))
    .returning()

  return guest
}

export const findGuestById = async (
  guestId: string,
  db: DbConnection = defaultDb,
) =>
  db
    .select()
    .from(guests)
    .where(and(eq(guests.id, guestId), isNull(guests.deletedAt)))
    .limit(1);

export const findGuestByEmail = async (email: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(guests)
    .where(and(eq(guests.email, email), isNull(guests.deletedAt)))
    .limit(1);

export const searchGuests = async (
  term: string,
  opts: { limit?: number; offset?: number } = {},
  db: DbConnection = defaultDb,
) => {
  const where = and(
    or(
      ilike(guests.firstName, `%${term}%`),
      ilike(guests.lastName, `%${term}%`),
      ilike(guests.email, `%${term}%`),
    ),
    isNull(guests.deletedAt),
  )

  const [{ total }] = await db
    .select({ total: count() })
    .from(guests)
    .where(where)

  const data = await db
    .select()
    .from(guests)
    .where(where)
    .orderBy(asc(guests.lastName), asc(guests.firstName))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0)

  return { data, total }
}

export const listVipGuests = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(guests)
    .where(and(eq(guests.vipStatus, true), isNull(guests.deletedAt)))
    .orderBy(desc(guests.updatedAt));

export const softDeleteGuest = async (guestId: string, db: DbConnection = defaultDb) => {
  const [guest] = await db
    .update(guests)
    .set({ deletedAt: new Date() })
    .where(and(eq(guests.id, guestId), isNull(guests.deletedAt)))
    .returning()
  return guest
}

export const restoreGuest = async (guestId: string, db: DbConnection = defaultDb) => {
  const [guest] = await db
    .update(guests)
    .set({ deletedAt: null })
    .where(eq(guests.id, guestId))
    .returning()
  return guest
}
