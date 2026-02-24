import {
  and,
  eq,
  inArray,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import { housekeepingTaskTypeEnum, housekeepingTasks } from '../schema/housekeeping.js'
import { rooms } from '../schema/rooms.js'
import { users } from '../schema/users.js'
import { assertNotPastDate, assertOperationalRole } from '../guards.js'

type TaskType = (typeof housekeepingTaskTypeEnum.enumValues)[number]

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

const OPEN_STATUSES = ['pending', 'assigned', 'in_progress'] as const

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
  // Guard: task date must not be in the past
  await assertNotPastDate(task.taskDate, db, 'Task date')

  // Check for an existing open task of the same type on the same room + date
  const [duplicate] = await db
    .select()
    .from(housekeepingTasks)
    .where(
      and(
        eq(housekeepingTasks.roomId, task.roomId),
        eq(housekeepingTasks.taskDate, task.taskDate),
        eq(housekeepingTasks.taskType, task.taskType),
        inArray(housekeepingTasks.status, [...OPEN_STATUSES]),
      ),
    )
    .limit(1)

  if (duplicate) {
    return { ...duplicate, _alreadyExists: true }
  }

  // Check for any other open task on the same room + date (different type)
  const [otherOpen] = await db
    .select()
    .from(housekeepingTasks)
    .where(
      and(
        eq(housekeepingTasks.roomId, task.roomId),
        eq(housekeepingTasks.taskDate, task.taskDate),
        inArray(housekeepingTasks.status, [...OPEN_STATUSES]),
      ),
    )
    .limit(1)

  if (otherOpen) {
    return { ...otherOpen, _blocked: true }
  }

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
  // Validate assignee has 'housekeeping' role
  const [assignee] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, assigneeId))
    .limit(1)

  if (!assignee) throw new Error('assignee user not found')
  assertOperationalRole(assignee.role, 'housekeeping')

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
  // Guard: cannot generate task board for a past date
  await assertNotPastDate(taskDate, db, 'Task board date')

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

  // Filter out rooms that already have an open checkout_cleaning task for this date
  const existingTasks = await db
    .select({ roomId: housekeepingTasks.roomId })
    .from(housekeepingTasks)
    .where(
      and(
        eq(housekeepingTasks.taskDate, taskDate),
        eq(housekeepingTasks.taskType, 'checkout_cleaning'),
        inArray(housekeepingTasks.status, [...OPEN_STATUSES]),
      ),
    )

  const existingRoomIds = new Set(existingTasks.map((t) => t.roomId))
  const newRooms = dirtyRooms.filter((r) => !existingRoomIds.has(r.roomId))

  if (newRooms.length === 0) {
    return []
  }

  const rows = newRooms.map((r) => ({
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

export const updateTaskType = async (
  taskId: number,
  taskType: TaskType,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const [task] = await db
    .update(housekeepingTasks)
    .set({
      taskType,
      modifiedBy: userId,
    })
    .where(
      and(
        eq(housekeepingTasks.id, taskId),
        inArray(housekeepingTasks.status, [...OPEN_STATUSES]),
      ),
    )
    .returning()

  if (!task) {
    throw new Error('task not found or already closed')
  }

  return task
}
