import {
  and,
  asc,
  desc,
  eq,
  ilike,
  or,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  guests,
} from '../../schema/guests.js';

export const findGuestByEmail = async (email: string) =>
  db
    .select()
    .from(guests)
    .where(eq(guests.email, email))
    .limit(1);

export const searchGuests = async (term: string) =>
  db
    .select()
    .from(guests)
    .where(or(
      ilike(guests.firstName, `%${term}%`),
      ilike(guests.lastName, `%${term}%`),
      ilike(guests.email, `%${term}%`),
    ))
    .orderBy(asc(guests.lastName), asc(guests.firstName));

export const listVipGuests = async () =>
  db
    .select()
    .from(guests)
    .where(eq(guests.vipStatus, true))
    .orderBy(desc(guests.updatedAt));
