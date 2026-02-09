import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  monthlyRevenue,
} from '../../schema/reporting.js';

type DbConnection = typeof defaultDb;

export const getMonthlyRevenue = async (month: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(monthlyRevenue)
    .where(eq(monthlyRevenue.month, month))
    .limit(1);

export const listMonthlyRevenueRange = async (from: string, to: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(monthlyRevenue)
    .where(and(
      gte(monthlyRevenue.month, from),
      lte(monthlyRevenue.month, to),
    ))
    .orderBy(asc(monthlyRevenue.month));
