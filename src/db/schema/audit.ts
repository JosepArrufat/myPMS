import {
  pgTable,
  bigserial,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const auditActionEnum = pgEnum('audit_action', [
  'insert',
  'update',
  'delete'
]);

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  tableName: varchar('table_name', { length: 100 }).notNull(),
  recordId: varchar('record_id', { length: 100 }).notNull(),
  action: auditActionEnum('action').notNull(),
  
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  changedFields: text('changed_fields').array(),
  
  userId: integer('user_id').references(() => users.id),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow(),
}, (table) => ({
  auditLogTableRecordIdx: index('idx_audit_log_table_record').on(table.tableName, table.recordId),
  auditLogUserIdx: index('idx_audit_log_user').on(table.userId),
  auditLogTimestampIdx: index('idx_audit_log_timestamp').on(table.timestamp),
}));

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;