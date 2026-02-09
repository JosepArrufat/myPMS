import {
  and,
  asc,
  eq,
  gte,
  sql,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  maintenanceRequests,
} from '../../schema/housekeeping.js';

type DbConnection = typeof defaultDb;

export const listOpenRequests = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.status, 'open'))
    .orderBy(asc(maintenanceRequests.priority));

export const listScheduledRequests = async (from: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(maintenanceRequests)
    .where(and(
      sql`${maintenanceRequests.completedAt} IS NULL`,
      gte(maintenanceRequests.scheduledDate, from),
    ))
    .orderBy(asc(maintenanceRequests.scheduledDate));

export const listUrgentOpenRequests = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(maintenanceRequests)
    .where(sql`${maintenanceRequests.status} = 'open' AND ${maintenanceRequests.priority} = 'urgent'`)
    .orderBy(asc(maintenanceRequests.createdAt));
