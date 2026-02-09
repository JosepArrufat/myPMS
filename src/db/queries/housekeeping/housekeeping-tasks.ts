import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  housekeepingTasks,
} from '../../schema/housekeeping.js';

type DbConnection = typeof defaultDb;

export const listTasksForDate = async (taskDate: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(housekeepingTasks)
    .where(eq(housekeepingTasks.taskDate, taskDate))
    .orderBy(asc(housekeepingTasks.roomId));

export const listTasksForRoom = async (roomId: number, from: string, to: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(housekeepingTasks)
    .where(and(
      eq(housekeepingTasks.roomId, roomId),
      gte(housekeepingTasks.taskDate, from),
      lte(housekeepingTasks.taskDate, to),
    ))
    .orderBy(asc(housekeepingTasks.taskDate));

export const listTasksForAssignee = async (userId: number, from: string, to: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(housekeepingTasks)
    .where(and(
      eq(housekeepingTasks.assignedTo, userId),
      gte(housekeepingTasks.taskDate, from),
      lte(housekeepingTasks.taskDate, to),
    ))
    .orderBy(asc(housekeepingTasks.taskDate));
