import {
  pgTable,
  serial,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const agencyType = pgEnum('agency_type', ['agency', 'company']);

export const agencies = pgTable('agencies', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 8 }).unique(),
  type: agencyType('type').notNull(),
  contactPerson: varchar('contact_person', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  
  addressLine1: varchar('address_line1', { length: 255 }),
  city: varchar('city', { length: 100 }),
  stateProvince: varchar('state_province', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 100 }),
  vatNumber: varchar('vat_number', { length: 50 }),
  
  commissionPercent: decimal('commission_percent', { precision: 4, scale: 2 }),
  paymentTermsDays: integer('payment_terms_days').default(30),
  
  /*future siteMinder integration*/
  // apiKey: text('api_key'),
  // channelManagerId: varchar('channel_manager_id', { length: 100 }),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  agenciesCodeIdx: uniqueIndex('idx_agencies_code').on(table.code),
  agenciesNameIdx: index('idx_agencies_name').on(table.name),
}));

export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;