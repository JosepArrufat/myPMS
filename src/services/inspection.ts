import {
  and,
  eq,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../db/index.js'
import { housekeepingTasks } from '../db/schema/housekeeping.js'
import { rooms } from '../db/schema/rooms.js'

type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

export const inspectRoom = async (
  taskId: number,
  inspectorId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [task] = await tx
      .update(housekeepingTasks)
      .set({
        status: 'inspected',
        inspectedBy: inspectorId,
        inspectedAt: new Date(),
        modifiedBy: inspectorId,
      })
      .where(
        and(
          eq(housekeepingTasks.id, taskId),
          eq(housekeepingTasks.status, 'completed'),
        ),
      )
      .returning()

    if (!task) {
      throw new Error('task not found or not completed')
    }

    await tx
      .update(rooms)
      .set({ cleanlinessStatus: 'inspected' })
      .where(eq(rooms.id, task.roomId))

    return task
  })
}
