import { z } from 'zod'
import { numericId, dateStr, checkInOutQuery } from './shared.js'

// /check — roomTypeId + date range
export const checkAvailabilityQuery = checkInOutQuery.extend({
  roomTypeId: z.coerce.number().int().positive(),
})

// /room-types — date range only
export const roomTypesAvailQuery = checkInOutQuery

// /blocks — date range only
export const blocksQuery = z.object({
  checkIn: dateStr,
  checkOut: dateStr,
})

// /overbook — full availability + overbooking params
export const overbookQuery = checkInOutQuery.extend({
  roomTypeId: z.coerce.number().int().positive(),
  requestedRooms: z.coerce.number().int().positive(),
  overbookingPercent: z.coerce.number().positive().optional(),
})

// /day/:date — single day view
export const dayAvailParams = z.object({ date: dateStr })
export const dayAvailQuery = z.object({
  roomTypeId: z.coerce.number().int().positive(),
})

// Inventory seed
export const seedInventoryBody = z.object({
  roomTypeId: numericId,
  startDate: dateStr,
  endDate: dateStr,
  capacity: z.number().int().positive(),
})

export const seedAllBody = z.object({
  startDate: dateStr,
  endDate: dateStr,
})

// Room availability
export const roomAvailParams = z.object({ id: numericId })
