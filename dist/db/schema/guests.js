import { pgTable, serial, uuid, varchar, text, date, boolean, timestamp, jsonb, pgEnum, index, } from 'drizzle-orm/pg-core';
import { users } from './users';
import { sql } from 'drizzle-orm';
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
    preferences: jsonb('preferences').$type(),
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
});
export const guestsEmailIdx = index('idx_guests_email')
    .on(guests.email)
    .where(sql `${guests.email} IS NOT NULL`);
export const guestsPhoneIdx = index('idx_guests_phone').on(guests.phone);
export const guestsNameIdx = index('idx_guests_name').on(guests.lastName, guests.firstName);
export const guestsVipIdx = index('idx_guests_vip').on(guests.vipStatus).where(sql `${guests.vipStatus} = true`);
export const guestsLoyaltyIdx = index('idx_guests_loyalty').on(guests.loyaltyNumber);
