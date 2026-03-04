import {
  and,
  asc,
  count,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  agencies,
} from '../../schema/agencies.js';
import type { NewAgency } from '../../schema/agencies.js';
import {
  reservations,
} from '../../schema/reservations.js';
import { sanitiseAgencyInput } from '../../../utils/sanitise.js';

type DbConnection = typeof defaultDb;

export const createAgency = async (
  data: NewAgency,
  db: DbConnection = defaultDb,
) => {
  const [agency] = await db
    .insert(agencies)
    .values(sanitiseAgencyInput(data))
    .returning()

  return agency
}

export const updateAgency = async (
  agencyId: number,
  data: Partial<NewAgency>,
  db: DbConnection = defaultDb,
) => {
  const [agency] = await db
    .update(agencies)
    .set(sanitiseAgencyInput(data))
    .where(eq(agencies.id, agencyId))
    .returning()

  return agency
}

export const findAgencyByCode = async (code: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(agencies)
    .where(and(eq(agencies.code, code), isNull(agencies.deletedAt)))
    .limit(1);

export const searchAgencies = async (
  term: string,
  includeInactive = false,
  opts: { limit?: number; offset?: number } = {},
  db: DbConnection = defaultDb,
) => {
  const where = includeInactive
    ? and(ilike(agencies.name, `%${term}%`), isNull(agencies.deletedAt))
    : and(
        ilike(agencies.name, `%${term}%`),
        eq(agencies.isActive, true),
        isNull(agencies.deletedAt),
      )

  const [{ total }] = await db
    .select({ total: count() })
    .from(agencies)
    .where(where)

  const data = await db
    .select()
    .from(agencies)
    .where(where)
    .orderBy(agencies.name)
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0)

  return { data, total }
}

export const listAgencyReservations = async (
  agencyId: number,
  range?: { from: string; to: string },
  db: DbConnection = defaultDb
) =>
  db
    .select()
    .from(reservations)
    .where(range
      ? and(
          eq(reservations.agencyId, agencyId),
          lte(reservations.checkInDate, range.to),
          gte(reservations.checkOutDate, range.from),
        )
      : eq(reservations.agencyId, agencyId))
    .orderBy(asc(reservations.checkInDate));

export const softDeleteAgency = async (agencyId: number, db: DbConnection = defaultDb) => {
  const [agency] = await db
    .update(agencies)
    .set({ deletedAt: new Date() })
    .where(and(eq(agencies.id, agencyId), isNull(agencies.deletedAt)))
    .returning()
  return agency
}

export const restoreAgency = async (agencyId: number, db: DbConnection = defaultDb) => {
  const [agency] = await db
    .update(agencies)
    .set({ deletedAt: null })
    .where(eq(agencies.id, agencyId))
    .returning()
  return agency
}
