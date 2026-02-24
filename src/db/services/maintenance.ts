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
import { users } from '../schema/users.js'
import { assertNotPastDate, assertOperationalRole, getBusinessDateTx } from '../guards.js'

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
  // Guard: scheduled date must not be in the past
  if (request.scheduledDate) {
    await assertNotPastDate(request.scheduledDate, db, 'Scheduled date')
  }

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
  // Validate assignee has maintenance-capable role
  const [assignee] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, assigneeId))
    .limit(1)

  if (!assignee) throw new Error('assignee user not found')
  assertOperationalRole(assignee.role, 'maintenance')

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
  // Guard: OOO block start date must not be in the past
  await assertNotPastDate(startDate, db, 'Out-of-order start date')

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
    const today = await getBusinessDateTx(tx)
    await tx
      .update(rooms)
      .set({
        status: 'available',
        cleanlinessStatus: 'dirty',
      })
      .where(eq(rooms.id, roomId))

    // Only release maintenance blocks that overlap today (not future blocks)
    await tx.execute(sql`
      UPDATE room_blocks
      SET released_at = NOW(),
          released_by = ${userId}
      WHERE room_id = ${roomId}
        AND released_at IS NULL
        AND block_type = 'maintenance'
        AND start_date <= ${today}
        AND end_date >= ${today}
    `)
  })
}

export const updateOutOfOrderBlock = async (
  blockId: number,
  updates: { startDate?: string; endDate?: string; reason?: string },
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  // Guard: new start date must not be in the past
  if (updates.startDate) {
    await assertNotPastDate(updates.startDate, db, 'Out-of-order start date')
  }

  const set: Record<string, any> = { modifiedBy: userId }
  if (updates.startDate) set.startDate = updates.startDate
  if (updates.endDate) set.endDate = updates.endDate
  if (updates.reason) set.reason = updates.reason

  const [block] = await db
    .update(roomBlocks)
    .set(set)
    .where(
      and(
        eq(roomBlocks.id, blockId),
        eq(roomBlocks.blockType, 'maintenance'),
        sql`${roomBlocks.releasedAt} IS NULL`,
      ),
    )
    .returning()

  if (!block) throw new Error('block not found, already released, or not a maintenance block')

  return block
}

export const releaseOutOfOrderBlock = async (
  blockId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [block] = await tx
      .update(roomBlocks)
      .set({
        releasedAt: new Date(),
        releasedBy: userId,
      })
      .where(
        and(
          eq(roomBlocks.id, blockId),
          eq(roomBlocks.blockType, 'maintenance'),
          sql`${roomBlocks.releasedAt} IS NULL`,
        ),
      )
      .returning()

    if (!block) throw new Error('block not found, already released, or not a maintenance block')

    // Check if the room has any other active maintenance blocks — if not, set available
    const remaining = await tx.execute(sql`
      SELECT COUNT(*) AS cnt FROM room_blocks
      WHERE room_id = ${block.roomId}
        AND released_at IS NULL
        AND block_type = 'maintenance'
        AND id != ${blockId}
    `)
    const cnt = Number((remaining as any)[0]?.cnt ?? 0)
    if (cnt === 0 && block.roomId) {
      await tx
        .update(rooms)
        .set({ status: 'available', cleanlinessStatus: 'dirty' })
        .where(eq(rooms.id, block.roomId))
    }

    return block
  })
}
