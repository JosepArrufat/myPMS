import {
  eq,
} from 'drizzle-orm'

import { db as defaultDb } from '../index.js'
import { roomInventory } from '../schema/roomInventory.js'
import { roomTypes } from '../schema/rooms.js'
import { dateRange } from '../utils.js'
import { assertNotPastDate } from '../guards.js'

type DbConnection = typeof defaultDb

export const seedInventory = async (
  roomTypeId: number,
  startDate: string,
  endDate: string,
  capacity: number,
  db: DbConnection = defaultDb,
) => {
  // Guard: cannot seed inventory starting in the past
  await assertNotPastDate(startDate, db as any, 'Inventory start date')

  const dates = dateRange(startDate, endDate)

  const rows = dates.map((d) => ({
    roomTypeId,
    date: d,
    capacity,
    available: capacity,
  }))

  const inserted = await db
    .insert(roomInventory)
    .values(rows)
    .onConflictDoNothing()
    .returning()

  return inserted
}

export const seedAllRoomTypeInventory = async (
  startDate: string,
  endDate: string,
  db: DbConnection = defaultDb,
) => {
  const types = await db
    .select({
      id: roomTypes.id,
      totalRooms: roomTypes.totalRooms,
    })
    .from(roomTypes)
    .where(eq(roomTypes.isActive, true))

  const results: { roomTypeId: number; count: number }[] = []

  for (const rt of types) {
    const inserted = await seedInventory(
      rt.id,
      startDate,
      endDate,
      rt.totalRooms,
      db,
    )
    results.push({
      roomTypeId: rt.id,
      count: inserted.length,
    })
  }

  return results
}
