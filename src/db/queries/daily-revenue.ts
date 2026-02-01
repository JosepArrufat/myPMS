import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  dailyRevenue,
} from '../schema/reporting.js';

export const getDailyRevenue = async (targetDate: string) =>
  db
    .select()
    .from(dailyRevenue)
    .where(eq(dailyRevenue.date, targetDate))
    .limit(1);

export const listDailyRevenueRange = async (from: string, to: string) =>
  db
    .select()
    .from(dailyRevenue)
    .where(and(
      gte(dailyRevenue.date, from),
      lte(dailyRevenue.date, to),
    ))
    .orderBy(asc(dailyRevenue.date));
