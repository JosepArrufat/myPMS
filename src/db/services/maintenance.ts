import {
  and,
  eq,
  sql,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import { maintenancePriorityEnum, maintenanceRequests } from '../schema/housekeeping.js'
import { rooms } from '../schema/rooms.js'
import { roomBlocks } from '../schema/reservations.js'

type MaintenancePriority = (typeof maintenancePriorityEnum.enumValues)[number]

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const createRequest = async (
  request: {
    roomId: number
    category?: string
    priority?: MaintenancePriority
    description: string
    scheduledDate?: string
  },
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const [newRequest] = await db
    .insert(maintenanceRequests)
    .values({
      roomId: request.roomId,
      category: request.category,
      priority: request.priority ?? 'normal',
      description: request.description,
      scheduledDate: request.scheduledDate,
      status: 'open',
      createdBy: userId,
    })
    .returning()

  return newRequest
}

export const assignRequest = async (
  requestId: number,
  assigneeId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const [request] = await db
    .update(maintenanceRequests)
    .set({
      assignedTo: assigneeId,
      status: 'in_progress',
      startedAt: new Date(),
      modifiedBy: userId,
    })
    .where(
      and(
        eq(maintenanceRequests.id, requestId),
        eq(maintenanceRequests.status, 'open'),
      ),
    )
    .returning()

  if (!request) {
    throw new Error('request not found or not open')
  }

  return request
}

export const completeRequest = async (
  requestId: number,
  resolutionNotes: string,
  cost: string | undefined,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const [request] = await db
    .update(maintenanceRequests)
    .set({
      status: 'completed',
      completedAt: new Date(),
      resolutionNotes,
      cost,
      modifiedBy: userId,
    })
    .where(
      and(
        eq(maintenanceRequests.id, requestId),
        eq(maintenanceRequests.status, 'in_progress'),
      ),
    )
    .returning()

  if (!request) {
    throw new Error('request not found or not in progress')
  }

  return request
}

export const putRoomOutOfOrder = async (
  roomId: number,
  startDate: string,
  endDate: string,
  reason: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    await tx
      .update(rooms)
      .set({ status: 'out_of_order' })
      .where(eq(rooms.id, roomId))

    const [block] = await tx
      .insert(roomBlocks)
      .values({
        roomId,
        startDate,
        endDate,
        blockType: 'maintenance',
        reason,
        createdBy: userId,
      })
      .returning()

    return block
  })
}

export const returnRoomToService = async (
  roomId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    await tx
      .update(rooms)
      .set({
        status: 'available',
        cleanlinessStatus: 'dirty',
      })
      .where(eq(rooms.id, roomId))

    await tx.execute(sql`
      UPDATE room_blocks
      SET released_at = NOW(),
          released_by = ${userId}
      WHERE room_id = ${roomId}
        AND released_at IS NULL
    `)
  })
}
