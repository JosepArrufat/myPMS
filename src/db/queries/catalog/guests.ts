import {
  and,
  asc,
  desc,
  eq,
  ilike,
  or,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  guests,
} from '../../schema/guests.js';
import type { NewGuest } from '../../schema/guests.js';

type DbConnection = typeof defaultDb;

export const createGuest = async (
  data: NewGuest,
  db: DbConnection = defaultDb,
) => {
  const [guest] = await db
    .insert(guests)
    .values(data)
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
    .set(data)
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
    .where(eq(guests.id, guestId))
    .limit(1);

export const findGuestByEmail = async (email: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(guests)
    .where(eq(guests.email, email))
    .limit(1);

export const searchGuests = async (term: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(guests)
    .where(or(
      ilike(guests.firstName, `%${term}%`),
      ilike(guests.lastName, `%${term}%`),
      ilike(guests.email, `%${term}%`),
    ))
    .orderBy(asc(guests.lastName), asc(guests.firstName));

export const listVipGuests = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(guests)
    .where(eq(guests.vipStatus, true))
    .orderBy(desc(guests.updatedAt));
