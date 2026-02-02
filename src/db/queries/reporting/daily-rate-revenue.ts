import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  dailyRateRevenue,
} from '../../schema/reporting.js';

export const listRatePlanRevenueRange = async (
  ratePlanId: number,
  from: string,
  to: string,
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
