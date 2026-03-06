import { z } from 'zod'
import { requiredStr, dateStr, monetaryStr, numericId } from './shared.js'

export const createReservationBody = z.object({
  reservation: z.object({}).passthrough(),
  rooms: z.array(z.object({}).passthrough()).min(1, 'At least one room is required'),
  overbookingPercent: z.number().optional(),
})

export const setBusinessDateBody = z.object({
  date: dateStr,
})

export const checkInBody = z.object({
  roomId: numericId,
  guestId: requiredStr,
})

export const checkOutBody = z.object({
  roomId: numericId,
})

export const cancelBody = z.object({
  reason: requiredStr,
  cancellationFee: monetaryStr.optional(),
})

export const rateOverrideBody = z.object({
  startDate: dateStr,
  endDate: dateStr,
  newRate: monetaryStr,
  reservationRoomId: z.string().optional(),
})

export const roomIdBody = z.object({
  roomId: numericId,
})

export const stayWindowQuery = z.object({
  from: dateStr,
  to: dateStr,
})

export const roomConflictQuery = z.object({
  roomId: z.coerce.number().int().positive(),
  from: dateStr,
  to: dateStr,
})
