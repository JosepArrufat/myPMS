import { z } from 'zod'
import { numericId, dateStr, requiredStr, monetaryStr } from './shared.js'
import { maintenancePriorityEnum } from '../db/schema/housekeeping.js'

export const numericRequestParams = z.object({ id: numericId })

export const createRequestBody = z.object({
  roomId: numericId,
  description: requiredStr,
  category: z.string().optional(),
  priority: z.enum(maintenancePriorityEnum.enumValues).optional(),
  scheduledDate: dateStr.optional(),
})

export const assignRequestBody = z.object({
  assigneeId: numericId,
})

export const completeRequestBody = z.object({
  resolutionNotes: requiredStr,
  cost: monetaryStr.optional(),
})

export const outOfOrderBody = z.object({
  roomId: numericId,
  startDate: dateStr,
  endDate: dateStr,
  reason: requiredStr,
})

export const returnToServiceBody = z.object({
  roomId: numericId,
})

export const updateBlockBody = z
  .object({
    startDate: dateStr.optional(),
    endDate: dateStr.optional(),
    reason: z.string().min(1).optional(),
  })
  .refine((d) => d.startDate || d.endDate || d.reason, {
    message: 'At least one of startDate, endDate, or reason is required',
  })

export const scheduledQuery = z.object({
  from: dateStr,
})
