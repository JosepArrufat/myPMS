import {
  and,
  desc,
  eq,
  gte,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  auditLog,
} from '../../schema/audit.js';

export const getAuditTrailForRecord = async (tableName: string, recordId: string, limit = 50) =>
  db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.tableName, tableName), eq(auditLog.recordId, recordId)))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);

export const getAuditEventsForUser = async (userId: number, since?: Date) =>
  db
    .select()
    .from(auditLog)
    .where(since
      ? and(eq(auditLog.userId, userId), gte(auditLog.timestamp, since))
      : eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.timestamp));
