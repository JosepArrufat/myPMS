import {
  and,
  asc,
  eq,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  roomTypeRateAdjustments,
} from '../../schema/rates.js';

type DbConnection = typeof defaultDb;

export const listAdjustmentsForBaseType = async (baseRoomTypeId: number, ratePlanId?: number, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomTypeRateAdjustments)
    .where(ratePlanId !== undefined
      ? and(
          eq(roomTypeRateAdjustments.baseRoomTypeId, baseRoomTypeId),
          eq(roomTypeRateAdjustments.ratePlanId, ratePlanId),
        )
      : eq(roomTypeRateAdjustments.baseRoomTypeId, baseRoomTypeId))
    .orderBy(asc(roomTypeRateAdjustments.derivedRoomTypeId));

export const listAdjustmentsForDerivedType = async (derivedRoomTypeId: number, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomTypeRateAdjustments)
    .where(eq(roomTypeRateAdjustments.derivedRoomTypeId, derivedRoomTypeId))
    .orderBy(asc(roomTypeRateAdjustments.ratePlanId));
