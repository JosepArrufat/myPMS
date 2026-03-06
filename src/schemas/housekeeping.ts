import { z } from 'zod'
import { numericId, dateStr, dateRangeQuery, requiredStr } from './shared.js'
import { housekeepingTaskTypeEnum } from '../db/schema/housekeeping.js'

export const numericTaskParams = z.object({ id: numericId })

export const createTaskBody = z.object({
  roomId: numericId,
  taskDate: dateStr,
  taskType: z.enum(housekeepingTaskTypeEnum.enumValues),
  priority: z.number().int().optional(),
  notes: z.string().optional(),
})

export const updateTaskTypeBody = z.object({
  taskType: z.enum(housekeepingTaskTypeEnum.enumValues),
})

export const assignTaskBody = z.object({
  assigneeId: numericId,
})

export const dailyBoardBody = z.object({
  taskDate: dateStr,
})

export const taskRangeQuery = dateRangeQuery
export const taskRoomParams = z.object({ id: numericId })
export const taskAssigneeParams = z.object({ id: numericId })
export const inspectParams = z.object({ taskId: numericId })
