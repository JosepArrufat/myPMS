import {
  and,
  eq,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import { housekeepingTaskTypeEnum, housekeepingTasks } from '../schema/housekeeping.js'
import { rooms } from '../schema/rooms.js'

type TaskType = (typeof housekeepingTaskTypeEnum.enumValues)[number]

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const createTask = async (
  task: {
    roomId: number
    taskDate: string
    taskType: TaskType
    priority?: number
    notes?: string
  },
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const [newTask] = await db
    .insert(housekeepingTasks)
    .values({
      roomId: task.roomId,
      taskDate: task.taskDate,
      taskType: task.taskType,
      priority: task.priority ?? 0,
      notes: task.notes,
      status: 'pending',
      createdBy: userId,
    })
    .returning()

  return newTask
}

export const assignTask = async (
  taskId: number,
  assigneeId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const [task] = await db
    .update(housekeepingTasks)
    .set({
      assignedTo: assigneeId,
      status: 'assigned',
      modifiedBy: userId,
    })
    .where(
      and(
        eq(housekeepingTasks.id, taskId),
        eq(housekeepingTasks.status, 'pending'),
      ),
    )
    .returning()

  if (!task) {
    throw new Error('task not found or not pending')
  }

  return task
}

export const startTask = async (
  taskId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const [task] = await db
    .update(housekeepingTasks)
    .set({
      status: 'in_progress',
      startedAt: new Date(),
      modifiedBy: userId,
    })
    .where(
      and(
        eq(housekeepingTasks.id, taskId),
        eq(housekeepingTasks.status, 'assigned'),
      ),
    )
    .returning()

  if (!task) {
    throw new Error('task not found or not assigned')
  }

  return task
}

export const completeTask = async (
  taskId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const [task] = await db
    .update(housekeepingTasks)
    .set({
      status: 'completed',
      completedAt: new Date(),
      modifiedBy: userId,
    })
    .where(
      and(
        eq(housekeepingTasks.id, taskId),
        eq(housekeepingTasks.status, 'in_progress'),
      ),
    )
    .returning()

  if (!task) {
    throw new Error('task not found or not in progress')
  }

  return task
}

export const generateDailyTaskBoard = async (
  taskDate: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const dirtyRooms = await db
    .select({
      roomId: rooms.id,
      roomNumber: rooms.roomNumber,
    })
    .from(rooms)
    .where(eq(rooms.cleanlinessStatus, 'dirty'))

  if (dirtyRooms.length === 0) {
    return []
  }

  const rows = dirtyRooms.map((r) => ({
    roomId: r.roomId,
    taskDate,
    taskType: 'checkout_cleaning' as const,
    status: 'pending' as const,
    createdBy: userId,
  }))

  const tasks = await db
    .insert(housekeepingTasks)
    .values(rows)
    .returning()

  return tasks
}
