import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  dailyRoomTypeRevenue,
} from '../../schema/reporting.js';

type DbConnection = typeof defaultDb;

export const listRoomTypeRevenueRange = async (
  roomTypeId: number,
  from: string,
  to: string,
  db: DbConnection = defaultDb
) =>
  db
    .select()
    .from(dailyRoomTypeRevenue)
    .where(and(
      eq(dailyRoomTypeRevenue.roomTypeId, roomTypeId),
      gte(dailyRoomTypeRevenue.date, from),
      lte(dailyRoomTypeRevenue.date, to),
    ))
    .orderBy(asc(dailyRoomTypeRevenue.date));
