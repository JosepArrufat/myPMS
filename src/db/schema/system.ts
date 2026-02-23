import {
  pgTable,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core'

export const systemConfig = pgTable('system_config', {
  key: varchar('key', { length: 50 }).primaryKey(),
  value: varchar('value', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
})

export type SystemConfig = typeof systemConfig.$inferSelect
export type NewSystemConfig = typeof systemConfig.$inferInsert
