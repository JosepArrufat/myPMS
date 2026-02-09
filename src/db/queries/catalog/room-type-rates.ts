import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  roomTypeRates,
} from '../../schema/rates.js';

type DbConnection = typeof defaultDb;

export const findRateForStay = async (
  roomTypeId: number,
  ratePlanId: number,
  checkIn: string,
  checkOut: string,
  db: DbConnection = defaultDb
) =>
  db
    .select()
    .from(roomTypeRates)
    .where(and(
      eq(roomTypeRates.roomTypeId, roomTypeId),
      eq(roomTypeRates.ratePlanId, ratePlanId),
      lte(roomTypeRates.startDate, checkOut),
      gte(roomTypeRates.endDate, checkIn),
    ))
    .orderBy(asc(roomTypeRates.startDate));

export const listRatesForPlan = async (ratePlanId: number, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomTypeRates)
    .where(eq(roomTypeRates.ratePlanId, ratePlanId))
    .orderBy(asc(roomTypeRates.roomTypeId), asc(roomTypeRates.startDate));
