import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  monthlyRevenue,
} from '../schema/reporting.js';

export const getMonthlyRevenue = async (month: string) =>
  db
    .select()
    .from(monthlyRevenue)
    .where(eq(monthlyRevenue.month, month))
    .limit(1);

export const listMonthlyRevenueRange = async (from: string, to: string) =>
  db
    .select()
    .from(monthlyRevenue)
    .where(and(
      gte(monthlyRevenue.month, from),
      lte(monthlyRevenue.month, to),
    ))
    .orderBy(asc(monthlyRevenue.month));
