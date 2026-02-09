import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  dailyRateRevenue,
} from '../../schema/reporting.js';

type DbConnection = typeof defaultDb;

export const listRatePlanRevenueRange = async (
  ratePlanId: number,
  from: string,
  to: string,
  db: DbConnection = defaultDb
) =>
  db
    .select()
    .from(dailyRateRevenue)
    .where(and(
      eq(dailyRateRevenue.ratePlanId, ratePlanId),
      gte(dailyRateRevenue.date, from),
      lte(dailyRateRevenue.date, to),
    ))
    .orderBy(asc(dailyRateRevenue.date));
