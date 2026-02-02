import {
  and,
  asc,
  eq,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  roomTypeRateAdjustments,
} from '../../schema/rates.js';

export const listAdjustmentsForBaseType = async (baseRoomTypeId: number, ratePlanId?: number) =>
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

export const listAdjustmentsForDerivedType = async (derivedRoomTypeId: number) =>
  db
    .select()
    .from(roomTypeRateAdjustments)
    .where(eq(roomTypeRateAdjustments.derivedRoomTypeId, derivedRoomTypeId))
    .orderBy(asc(roomTypeRateAdjustments.ratePlanId));
