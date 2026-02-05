import {
  pgTable,
  serial,
  varchar,
  text,
  decimal,
  date,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const promotions = pgTable('promotions', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  
  discountType: varchar('discount_type', { length: 20 }).notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
  
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to').notNull(),
  blackoutDates: date('blackout_dates').array(),
  
  minNights: integer('min_nights').default(1),
  minAmount: decimal('min_amount', { precision: 10, scale: 2 }),
  maxUses: integer('max_uses'),
  usesCount: integer('uses_count').default(0),
  
  roomTypeIds: integer('room_type_ids').array(),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  promotionsCodeIdx: uniqueIndex('idx_promotions_code').on(table.code),
  promotionsActiveIdx: index('idx_promotions_active').on(table.isActive),
  promotionsDatesIdx: index('idx_promotions_dates').on(table.validFrom, table.validTo).where(sql`${table.isActive} = true`),
  promotionsActiveValidIdx: index('idx_promotions_active_valid').on(table.isActive, table.validFrom, table.validTo).where(sql`${table.isActive} = true`),
}));

export type Promotion = typeof promotions.$inferSelect;
export type NewPromotion = typeof promotions.$inferInsert;