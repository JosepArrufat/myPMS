import {
  and,
  eq,
  gte,
  lt,
  lte,
  sql,
} from 'drizzle-orm'

import { db as defaultDb } from '../index.js'
import { roomInventory } from '../schema/roomInventory.js'
import { roomTypes } from '../schema/rooms.js'
import { roomBlocks } from '../schema/reservations.js'
import { type TxOrDb, dateRange, lookupOverbookingPercent } from '../utils.js'

export const checkAvailability = async (
  roomTypeId: number,
  checkIn: string,
  checkOut: string,
  db: TxOrDb = defaultDb,
) => {
  const nights = dateRange(checkIn, checkOut)

  const rows = await db
    .select({
      date: roomInventory.date,
      available: roomInventory.available,
      capacity: roomInventory.capacity,
    })
    .from(roomInventory)
    .where(
      and(
        eq(roomInventory.roomTypeId, roomTypeId),
        gte(roomInventory.date, checkIn),
        lt(roomInventory.date, checkOut),
      ),
    )

  const inventoryMap = new Map(rows.map((r) => [r.date, r]))

  let minAvailable = Infinity
  const dailyAvailability: Array<{
    date: string
    available: number
    capacity: number
  }> = []

  for (const night of nights) {
    const inv = inventoryMap.get(night)
    const available = inv ? inv.available : 0
    const capacity = inv ? inv.capacity : 0
    dailyAvailability.push({ date: night, available, capacity })
    if (available < minAvailable) minAvailable = available
  }

  return {
    roomTypeId,
    checkIn,
    checkOut,
    nights: nights.length,
    minAvailable: minAvailable === Infinity ? 0 : minAvailable,
    isAvailable: minAvailable > 0,
    dailyAvailability,
  }
}

export const getAvailableRoomTypes = async (
  checkIn: string,
  checkOut: string,
  db: TxOrDb = defaultDb,
) => {
  const allTypes = await db
    .select({
      id: roomTypes.id,
      name: roomTypes.name,
      code: roomTypes.code,
      basePrice: roomTypes.basePrice,
      maxOccupancy: roomTypes.maxOccupancy,
      totalRooms: roomTypes.totalRooms,
    })
    .from(roomTypes)
    .where(eq(roomTypes.isActive, true))

  const results: Array<{
    roomTypeId: number
    name: string
    code: string
    basePrice: string
    maxOccupancy: number
    totalRooms: number
    minAvailable: number
    isAvailable: boolean
  }> = []

  for (const rt of allTypes) {
    const avail = await checkAvailability(rt.id, checkIn, checkOut, db)
    results.push({
      roomTypeId: rt.id,
      name: rt.name,
      code: rt.code,
      basePrice: String(rt.basePrice),
      maxOccupancy: rt.maxOccupancy,
      totalRooms: rt.totalRooms,
      minAvailable: avail.minAvailable,
      isAvailable: avail.isAvailable,
    })
  }

  return results
}

export const getBlockedRooms = async (
  checkIn: string,
  checkOut: string,
  db: TxOrDb = defaultDb,
) =>
  db
    .select()
    .from(roomBlocks)
    .where(
      and(
        lte(roomBlocks.startDate, checkOut),
        gte(roomBlocks.endDate, checkIn),
        sql`${roomBlocks.releasedAt} IS NULL`,
      ),
    )


export const canOverbook = async (
  roomTypeId: number,
  checkIn: string,
  checkOut: string,
  requestedRooms: number,
  overbookingPercent?: number,
  db: TxOrDb = defaultDb,
) => {
  const avail = await checkAvailability(roomTypeId, checkIn, checkOut, db)

  for (const day of avail.dailyAvailability) {
    const effectivePct = overbookingPercent
      ?? await lookupOverbookingPercent(roomTypeId, day.date, db)
    const maxAllowed = Math.floor(day.capacity * effectivePct / 100)
    const sold = day.capacity - day.available
    const remainingSlots = maxAllowed - sold
    if (remainingSlots < requestedRooms) {
      return {
        allowed: false,
        blockedDate: day.date,
        remainingSlots,
        requestedRooms,
      }
    }
  }

  return {
    allowed: true,
    blockedDate: null,
    remainingSlots: null,
    requestedRooms,
  }
}
