import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  dailyRevenue,
} from '../../schema/reporting.js';

type DbConnection = typeof defaultDb;

export const getDailyRevenue = async (targetDate: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(dailyRevenue)
    .where(eq(dailyRevenue.date, targetDate))
    .limit(1);

export const listDailyRevenueRange = async (from: string, to: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(dailyRevenue)
    .where(and(
      gte(dailyRevenue.date, from),
      lte(dailyRevenue.date, to),
    ))
    .orderBy(asc(dailyRevenue.date));
