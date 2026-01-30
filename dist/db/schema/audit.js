import { pgTable, bigserial, varchar, text, jsonb, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users';
export const auditLog = pgTable('audit_log', {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    tableName: varchar('table_name', { length: 100 }).notNull(),
    recordId: varchar('record_id', { length: 100 }).notNull(),
    action: varchar('action', { length: 20 }).notNull(),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    changedFields: text('changed_fields').array(),
    userId: integer('user_id').references(() => users.id),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    timestamp: timestamp('timestamp').defaultNow(),
});
export const auditLogTableRecordIdx = index('idx_audit_log_table_record').on(auditLog.tableName, auditLog.recordId);
export const auditLogUserIdx = index('idx_audit_log_user').on(auditLog.userId);
export const auditLogTimestampIdx = index('idx_audit_log_timestamp').on(auditLog.timestamp);
export const auditLogActionIdx = index('idx_audit_log_action').on(auditLog.action);
