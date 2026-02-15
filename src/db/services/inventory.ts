import {
  eq,
} from 'drizzle-orm'

import { db as defaultDb } from '../index.js'
import { roomInventory } from '../schema/roomInventory.js'
import { roomTypes } from '../schema/rooms.js'

type DbConnection = typeof defaultDb

export const seedInventory = async (
  roomTypeId: number,
  startDate: string,
  endDate: string,
  capacity: number,
  db: DbConnection = defaultDb,
) => {
  const dates: string[] = []
  const cursor = new Date(startDate)
  const last = new Date(endDate)

  while (cursor < last) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }

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
