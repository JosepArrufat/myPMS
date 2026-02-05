import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  date,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { userRoleEnum, users } from './users';
import { sql } from 'drizzle-orm';
import { permission } from 'node:process';

export const guestDocumentTypeEnum = pgEnum('guest_document_type', [
  'passport',
  'national_id',
  'drivers_license',
  'residence_permit',
  'other'
]);

export const guests = pgTable('guests', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  dateOfBirth: date('date_of_birth'),
  nationality: varchar('nationality', { length: 100 }),
  languagePreference: varchar('language_preference', { length: 10 }).default('en'),
  
  // Identification
  idDocumentType: guestDocumentTypeEnum('id_document_type'),
  idDocumentNumber: varchar('id_document_number', { length: 100 }),
  idDocumentExpiry: date('id_document_expiry'),
  idDocumentCountry: varchar('id_document_country', { length: 100 }),
  
  // Address
  addressLine1: varchar('address_line1', { length: 255 }),
  addressLine2: varchar('address_line2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  stateProvince: varchar('state_province', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 100 }),
  
  // Preferences & Notes
  preferences: jsonb('preferences').$type<{
    floor?: 'low' | 'high';
    bedType?: 'single' | 'double' | 'king' | 'queen';
    pillowType?: 'soft' | 'firm';
    smokingRoom?: boolean;
    [key: string]: any;
  }>(),
  dietaryRestrictions: text('dietary_restrictions'),
  specialNeeds: text('special_needs'),
  observations: text('observations'),
  
  // Marketing
  marketingOptIn: boolean('marketing_opt_in').default(false),
  vipStatus: boolean('vip_status').default(false),
  loyaltyNumber: varchar('loyalty_number', { length: 50 }),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
  createdBy: serial('created_by').references(() => users.id),
}, (table) => ({
  emailIdx: index('idx_guests_email').on(table.email).where(sql`${table.email} IS NOT NULL`),
  nameIdx: index('idx_guests_name').on(table.lastName, table.firstName),
  vipIdx: index('idx_guests_vip').on(table.vipStatus).where(sql`${table.vipStatus} = true`),
  loyaltyIdx: index('idx_guests_loyalty').on(table.loyaltyNumber),
}));

export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
