import {
  and,
  asc,
  eq,
  gte,
  lte,
  isNull,
  or,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  ratePlans,
  roomTypeRates,
} from '../../schema/rates.js';
import type { NewRatePlan, NewRoomTypeRate } from '../../schema/rates.js';

type DbConnection = typeof defaultDb;

export const createRatePlan = async (
  data: NewRatePlan,
  db: DbConnection = defaultDb,
) => {
  const [plan] = await db
    .insert(ratePlans)
    .values(data)
    .returning()

  return plan
}

export const updateRatePlan = async (
  planId: number,
  data: Partial<NewRatePlan>,
  db: DbConnection = defaultDb,
) => {
  const [plan] = await db
    .update(ratePlans)
    .set(data)
    .where(eq(ratePlans.id, planId))
    .returning()

  return plan
}

export const createRoomTypeRate = async (
  data: NewRoomTypeRate,
  db: DbConnection = defaultDb,
) => {
  const [rate] = await db
    .insert(roomTypeRates)
    .values(data)
    .returning()

  return rate
}

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
  // Include active plans that either have a validity range overlapping the stay
  // OR have NULL validFrom/validTo (treated as always-applicable / generic plans).
  db
    .select()
    .from(ratePlans)
    .where(and(
      eq(ratePlans.isActive, true),
      or(isNull(ratePlans.validFrom), lte(ratePlans.validFrom, checkOut)),
      or(isNull(ratePlans.validTo), gte(ratePlans.validTo, checkIn)),
    ))
    .orderBy(asc(ratePlans.validFrom));
