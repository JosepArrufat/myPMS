import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  ratePlans,
} from '../../schema/rates.js';

type DbConnection = typeof defaultDb;

export const findRatePlanByCode = async (code: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.code, code))
    .limit(1);

export const listActiveRatePlans = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.isActive, true))
    .orderBy(asc(ratePlans.name));

export const listRatePlansForStay = async (checkIn: string, checkOut: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(ratePlans)
    .where(and(
      eq(ratePlans.isActive, true),
      lte(ratePlans.validFrom, checkOut),
      gte(ratePlans.validTo, checkIn),
    ))
    .orderBy(asc(ratePlans.validFrom));
