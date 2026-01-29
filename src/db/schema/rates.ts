import { pgTable, serial, varchar, text, integer, decimal, boolean, date, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { roomTypes } from './rooms';

export const ratePlans = pgTable('rate_plans', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  description: text('description'),
  
  isPublic: boolean('is_public').default(true),
  requiresAdvanceBookingDays: integer('requires_advance_booking_days').default(0),
  minLengthOfStay: integer('min_length_of_stay').default(1),
  maxLengthOfStay: integer('max_length_of_stay'),
  
  cancellationPolicy: text('cancellation_policy'),
  cancellationDeadlineHours: integer('cancellation_deadline_hours'),
  cancellationFeePercent: decimal('cancellation_fee_percent', { precision: 5, scale: 2 }),
  
  includesBreakfast: boolean('includes_breakfast').default(false),
  includesLunch: boolean('includes_lunch').default(false),
  includesDinner: boolean('includes_dinner').default(false),
  
  isActive: boolean('is_active').default(true),
  validFrom: date('valid_from'),
  validTo: date('valid_to'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const ratePlansCodeIdx = uniqueIndex('idx_rate_plans_code').on(ratePlans.code);
export const ratePlansActiveIdx = index('idx_rate_plans_active').on(ratePlans.isActive);
export const ratePlansDatesIdx = index('idx_rate_plans_dates')
  .on(ratePlans.validFrom, ratePlans.validTo)
  .where(ratePlans.isActive.eq(true));

export const roomTypeRates = pgTable('room_type_rates', {
  id: serial('id').primaryKey(),
  roomTypeId: integer('room_type_id').notNull().references(() => roomTypes.id),
  ratePlanId: integer('rate_plan_id').notNull().references(() => ratePlans.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  minStay: integer('min_stay').default(1),
  
  appliesMonday: boolean('applies_monday').default(true),
  appliesTuesday: boolean('applies_tuesday').default(true),
  appliesWednesday: boolean('applies_wednesday').default(true),
  appliesThursday: boolean('applies_thursday').default(true),
  appliesFriday: boolean('applies_friday').default(true),
  appliesSaturday: boolean('applies_saturday').default(true),
  appliesSunday: boolean('applies_sunday').default(true),
  
  createdAt: timestamp('created_at').defaultNow(),
});

export const roomTypeRatesLookupIdx = index('idx_room_type_rates_lookup').on(
  roomTypeRates.roomTypeId,
  roomTypeRates.ratePlanId,
  roomTypeRates.startDate,
  roomTypeRates.endDate,
);
export const roomTypeRatesDatesIdx = index('idx_room_type_rates_dates').on(
  roomTypeRates.startDate,
  roomTypeRates.endDate,
);
export const roomTypeRatesRoomTypeIdx = index('idx_room_type_rates_room_type').on(roomTypeRates.roomTypeId);

export type RatePlan = typeof ratePlans.$inferSelect;
export type NewRatePlan = typeof ratePlans.$inferInsert;
export type RoomTypeRate = typeof roomTypeRates.$inferSelect;
export type NewRoomTypeRate = typeof roomTypeRates.$inferInsert;