import {
  and,
  asc,
  eq,
  gte,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  overbookingPolicies,
  type NewOverbookingPolicy,
} from '../../schema/overbooking.js';

type DbConnection = typeof defaultDb;

// ─── Create ─────────────────────────────────────────────────────────
export const createOverbookingPolicy = async (
  data: Omit<NewOverbookingPolicy, 'id' | 'createdAt' | 'updatedAt'>,
  db: DbConnection = defaultDb,
) => {
  const [policy] = await db
    .insert(overbookingPolicies)
    .values(data)
    .returning();

  return policy;
};

// ─── Update ─────────────────────────────────────────────────────────
export const updateOverbookingPolicy = async (
  policyId: number,
  data: Partial<Pick<NewOverbookingPolicy, 'startDate' | 'endDate' | 'overbookingPercent' | 'roomTypeId'>>,
  db: DbConnection = defaultDb,
) => {
  const [policy] = await db
    .update(overbookingPolicies)
    .set(data)
    .where(eq(overbookingPolicies.id, policyId))
    .returning();

  return policy;
};

// ─── Delete ─────────────────────────────────────────────────────────
export const deleteOverbookingPolicy = async (
  policyId: number,
  db: DbConnection = defaultDb,
) => {
  const [deleted] = await db
    .delete(overbookingPolicies)
    .where(eq(overbookingPolicies.id, policyId))
    .returning();

  return deleted;
};

// ─── List all active (future) policies ──────────────────────────────
export const listOverbookingPolicies = async (
  db: DbConnection = defaultDb,
) =>
  db
    .select()
    .from(overbookingPolicies)
    .orderBy(asc(overbookingPolicies.startDate));

// ─── List policies covering a date range ────────────────────────────
export const listPoliciesForRange = async (
  startDate: string,
  endDate: string,
  db: DbConnection = defaultDb,
) =>
  db
    .select()
    .from(overbookingPolicies)
    .where(
      and(
        lte(overbookingPolicies.startDate, endDate),
        gte(overbookingPolicies.endDate, startDate),
      ),
    )
    .orderBy(asc(overbookingPolicies.startDate));

// ─── Get effective overbooking percent for a room type on a date ────
/**
 * Lookup priority:
 *   1. Specific policy for `roomTypeId` covering `date`
 *   2. Hotel-wide policy (roomTypeId IS NULL) covering `date`
 *   3. Default → 100 (no overbooking)
 */
export const getEffectiveOverbookingPercent = async (
  roomTypeId: number,
  date: string,
  db: DbConnection = defaultDb,
): Promise<number> => {
  // Try room-type-specific policy first
  const [specific] = await db
    .select({ overbookingPercent: overbookingPolicies.overbookingPercent })
    .from(overbookingPolicies)
    .where(
      and(
        eq(overbookingPolicies.roomTypeId, roomTypeId),
        lte(overbookingPolicies.startDate, date),
        gte(overbookingPolicies.endDate, date),
      ),
    )
    .limit(1);

  if (specific) return specific.overbookingPercent;

  // Fallback to hotel-wide policy
  const [hotelWide] = await db
    .select({ overbookingPercent: overbookingPolicies.overbookingPercent })
    .from(overbookingPolicies)
    .where(
      and(
        isNull(overbookingPolicies.roomTypeId),
        lte(overbookingPolicies.startDate, date),
        gte(overbookingPolicies.endDate, date),
      ),
    )
    .limit(1);

  if (hotelWide) return hotelWide.overbookingPercent;

  // No policy → no overbooking
  return 100;
};

// ─── Trim / delete expired policies (called by night audit) ─────────
/**
 * - Policies whose endDate < businessDate → delete (fully expired).
 * - Policies whose startDate <= businessDate and endDate >= businessDate →
 *   advance startDate to businessDate + 1 (trim past portion).
 */
export const trimExpiredPolicies = async (
  businessDate: string,
  db: DbConnection = defaultDb,
) => {
  // Delete fully expired
  const deleted = await db
    .delete(overbookingPolicies)
    .where(sql`${overbookingPolicies.endDate} < ${businessDate}`)
    .returning();

  // Trim policies that started before/on businessDate but still extend past it
  const trimmed = await db
    .update(overbookingPolicies)
    .set({
      startDate: sql`(${businessDate}::date + interval '1 day')::date`.mapWith(String),
    })
    .where(
      and(
        lte(overbookingPolicies.startDate, businessDate),
        gte(overbookingPolicies.endDate, businessDate),
      ),
    )
    .returning();

  return { deleted: deleted.length, trimmed: trimmed.length };
};
