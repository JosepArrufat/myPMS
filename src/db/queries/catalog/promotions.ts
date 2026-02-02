import {
  and,
  asc,
  eq,
  gte,
  lte,
  sql,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  promotions,
} from '../../schema/promotions.js';

export const findPromotionByCode = async (code: string) =>
  db
    .select()
    .from(promotions)
    .where(eq(promotions.code, code))
    .limit(1);

export const listActivePromotions = async () =>
  db
    .select()
    .from(promotions)
    .where(sql`${promotions.isActive} = true AND ${promotions.validFrom} <= CURRENT_DATE AND ${promotions.validTo} >= CURRENT_DATE`)
    .orderBy(asc(promotions.validTo));

export const listPromotionsForPeriod = async (from: string, to: string) =>
  db
    .select()
    .from(promotions)
    .where(and(
      lte(promotions.validFrom, to),
      gte(promotions.validTo, from),
    ))
    .orderBy(asc(promotions.validFrom));
