import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  housekeepingTasks,
} from '../../schema/housekeeping.js';

export const listTasksForDate = async (taskDate: string) =>
  db
    .select()
    .from(housekeepingTasks)
    .where(eq(housekeepingTasks.taskDate, taskDate))
    .orderBy(asc(housekeepingTasks.roomId));

export const listTasksForRoom = async (roomId: number, from: string, to: string) =>
  db
    .select()
    .from(housekeepingTasks)
    .where(and(
      eq(housekeepingTasks.roomId, roomId),
      gte(housekeepingTasks.taskDate, from),
      lte(housekeepingTasks.taskDate, to),
    ))
    .orderBy(asc(housekeepingTasks.taskDate));

export const listTasksForAssignee = async (userId: number, from: string, to: string) =>
  db
    .select()
    .from(housekeepingTasks)
    .where(and(
      eq(housekeepingTasks.assignedTo, userId),
      gte(housekeepingTasks.taskDate, from),
      lte(housekeepingTasks.taskDate, to),
    ))
    .orderBy(asc(housekeepingTasks.taskDate));
