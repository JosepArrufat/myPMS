import { pgTable, serial, varchar, text, decimal, integer, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const agencies = pgTable('agencies', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 20 }).unique(),
  type: varchar('type', { length: 50 }),
  
  contactPerson: varchar('contact_person', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  
  addressLine1: varchar('address_line1', { length: 255 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  
  commissionPercent: decimal('commission_percent', { precision: 5, scale: 2 }),
  paymentTermsDays: integer('payment_terms_days').default(30),
  
  apiKey: text('api_key'),
  channelManagerId: varchar('channel_manager_id', { length: 100 }),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const agenciesCodeIdx = uniqueIndex('idx_agencies_code').on(agencies.code);
export const agenciesActiveIdx = index('idx_agencies_active').on(agencies.isActive);
export const agenciesTypeIdx = index('idx_agencies_type').on(agencies.type);
export const agenciesNameIdx = index('idx_agencies_name').on(agencies.name);

export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;