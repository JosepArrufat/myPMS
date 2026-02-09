import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  yearlyRevenue,
} from '../../schema/reporting.js';

type DbConnection = typeof defaultDb;

export const getYearlyRevenue = async (year: number, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(yearlyRevenue)
    .where(eq(yearlyRevenue.year, year))
    .limit(1);

export const listYearlyRevenueRange = async (from: number, to: number, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(yearlyRevenue)
    .where(and(
      gte(yearlyRevenue.year, from),
      lte(yearlyRevenue.year, to),
    ))
    .orderBy(asc(yearlyRevenue.year));
