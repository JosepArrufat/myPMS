import {
  and,
  asc,
  eq,
  gte,
  sql,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  maintenanceRequests,
} from '../schema/housekeeping.js';

export const listOpenRequests = async () =>
  db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.status, 'open'))
    .orderBy(asc(maintenanceRequests.priority));

export const listScheduledRequests = async (from: string) =>
  db
    .select()
    .from(maintenanceRequests)
    .where(and(
      sql`${maintenanceRequests.completedAt} IS NULL`,
      gte(maintenanceRequests.scheduledDate, from),
    ))
    .orderBy(asc(maintenanceRequests.scheduledDate));

export const listUrgentOpenRequests = async () =>
  db
    .select()
    .from(maintenanceRequests)
    .where(sql`${maintenanceRequests.status} = 'open' AND ${maintenanceRequests.priority} = 'urgent'`)
    .orderBy(asc(maintenanceRequests.createdAt));
