import {
  and,
  asc,
  eq,
  gte,
  ilike,
  lte,
  sql,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  agencies,
} from '../../schema/agencies.js';
import {
  reservations,
} from '../../schema/reservations.js';

export const findAgencyByCode = async (code: string) =>
  db
    .select()
    .from(agencies)
    .where(eq(agencies.code, code))
    .limit(1);

export const searchAgencies = async (term: string, includeInactive = false) =>
  db
    .select()
    .from(agencies)
    .where(includeInactive
      ? ilike(agencies.name, `%${term}%`)
      : and(
          ilike(agencies.name, `%${term}%`),
          eq(agencies.isActive, true),
        ))
    .orderBy(agencies.name);

export const listChannelManagers = async () =>
  db
    .select()
    .from(agencies)
    .where(sql`${agencies.channelManagerId} IS NOT NULL`)
    .orderBy(agencies.name);

export const listAgencyReservations = async (
  agencyId: number,
  range?: { from: string; to: string },
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
