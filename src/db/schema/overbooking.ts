import {
  pgTable,
  serial,
  integer,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { roomTypes } from './rooms';

/**
 * Overbooking policies define the allowed overbooking percentage
 * for a date range, optionally scoped to a specific room type.
 *
 * Lookup priority (per room-type + per night):
 *   1. Specific policy — room_type_id = X covering that date → use it.
 *   2. Hotel-wide policy — room_type_id IS NULL covering that date → fallback.
 *   3. No policy found → default to 100 (no overbooking).
 *
 * Night audit trims / deletes expired policies so only future dates remain.
 */
export const overbookingPolicies = pgTable('overbooking_policies', {
  id: serial('id').primaryKey(),
  /** NULL = hotel-wide default policy */
  roomTypeId: integer('room_type_id').references(() => roomTypes.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  /** 100 = no overbooking, 110 = +10%, etc. */
  overbookingPercent: integer('overbooking_percent').notNull().default(100),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  typeIdx: index('idx_overbooking_policies_room_type').on(table.roomTypeId),
  dateRangeIdx: index('idx_overbooking_policies_dates').on(table.startDate, table.endDate),
}));

export type OverbookingPolicy = typeof overbookingPolicies.$inferSelect;
export type NewOverbookingPolicy = typeof overbookingPolicies.$inferInsert;
