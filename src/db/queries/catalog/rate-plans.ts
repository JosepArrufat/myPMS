import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  ratePlans,
} from '../../schema/rates.js';

export const findRatePlanByCode = async (code: string) =>
  db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.code, code))
    .limit(1);

export const listActiveRatePlans = async () =>
  db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.isActive, true))
    .orderBy(asc(ratePlans.name));

export const listRatePlansForStay = async (checkIn: string, checkOut: string) =>
  db
    .select()
    .from(ratePlans)
    .where(and(
      eq(ratePlans.isActive, true),
      lte(ratePlans.validFrom, checkOut),
      gte(ratePlans.validTo, checkIn),
    ))
    .orderBy(asc(ratePlans.validFrom));
