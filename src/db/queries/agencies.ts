import {
  and,
  eq,
  ilike,
  sql,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  agencies,
} from '../schema/agencies.js';

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
