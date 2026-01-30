import { pgTable, serial, varchar, text, decimal, date, integer, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
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
});
export const promotionsCodeIdx = uniqueIndex('idx_promotions_code').on(promotions.code);
export const promotionsActiveIdx = index('idx_promotions_active').on(promotions.isActive);
export const promotionsDatesIdx = index('idx_promotions_dates')
    .on(promotions.validFrom, promotions.validTo)
    .where(sql `${promotions.isActive} = true`);
// Active promotions
export const promotionsActiveValidIdx = index('idx_promotions_active_valid')
    .on(promotions.isActive, promotions.validFrom, promotions.validTo)
    .where(sql `${promotions.isActive} = true AND ${promotions.validFrom} <= CURRENT_DATE AND ${promotions.validTo} >= CURRENT_DATE`);
