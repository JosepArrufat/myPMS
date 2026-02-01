import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  date,
  timestamp,
  decimal,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { rooms } from './rooms';
import { users } from './users';
import { sql } from 'drizzle-orm';

export const maintenancePriorityEnum = pgEnum('maintenance_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const maintenanceStatusEnum = pgEnum('maintenance_status', [
  'open',
  'in_progress',
  'completed',
  'cancelled',
]);

export const housekeepingTaskTypeEnum = pgEnum('housekeeping_task_type', [
  'client_service',
  'checkout_cleaning',
  'maintenance_prep',
  'carpet_cleaning',
  'deep_cleaning',
  'vip_setup',
  'turndown_service',
  'linen_change',
  'inspection',
  'special_request',
]);

export const housekeepingTaskStatusEnum = pgEnum('housekeeping_task_status', [
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
  'inspected',
]);

export const housekeepingTasks = pgTable('housekeeping_tasks', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id').notNull().references(() => rooms.id),
  taskDate: date('task_date').notNull().defaultNow(),
  
  taskType: housekeepingTaskTypeEnum('task_type').notNull(),
  priority: integer('priority').default(0),
  
  status: housekeepingTaskStatusEnum('status').notNull().default('pending'),
  
  assignedTo: integer('assigned_to').references(() => users.id),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  inspectedAt: timestamp('inspected_at'),
  inspectedBy: integer('inspected_by').references(() => users.id),
  
  notes: text('notes'),
  foundItems: text('found_items'),
  maintenanceNeeded: text('maintenance_needed'),
  
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
});

export const housekeepingRoomDateIdx = index('idx_housekeeping_room_date').on(
  housekeepingTasks.roomId,
  housekeepingTasks.taskDate,
);
export const housekeepingAssignedIdx = index('idx_housekeeping_assigned').on(
  housekeepingTasks.assignedTo,
  housekeepingTasks.status,
);
export const housekeepingWorkloadIdx = index('idx_housekeeping_workload').on(
  housekeepingTasks.assignedTo,
  housekeepingTasks.taskDate,
  housekeepingTasks.status,
);
export const housekeepingCurrentIdx = index('idx_housekeeping_current')
  .on(housekeepingTasks.taskDate, housekeepingTasks.status, housekeepingTasks.roomId)
  .where(sql`${housekeepingTasks.taskDate} >= CURRENT_DATE`);
export const housekeepingTypeIdx = index('idx_housekeeping_type').on(housekeepingTasks.taskType, housekeepingTasks.status);

export const maintenanceRequests = pgTable('maintenance_requests', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id').references(() => rooms.id),
  
  category: varchar('category', { length: 50 }),
  priority: maintenancePriorityEnum('priority').default('normal'),
  description: text('description').notNull(),
  
  status: maintenanceStatusEnum('status').notNull().default('open'),
  
  assignedTo: integer('assigned_to').references(() => users.id),
  scheduledDate: date('scheduled_date'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  resolutionNotes: text('resolution_notes'),
  partsUsed: text('parts_used'),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const maintenanceRoomIdx = index('idx_maintenance_room').on(maintenanceRequests.roomId);
export const maintenanceStatusIdx = index('idx_maintenance_status').on(maintenanceRequests.status);
export const maintenanceAssignedIdx = index('idx_maintenance_assigned').on(
  maintenanceRequests.assignedTo,
  maintenanceRequests.status,
);

export const maintenanceCurrentIdx = index('idx_maintenance_current')
  .on(maintenanceRequests.scheduledDate, maintenanceRequests.status, maintenanceRequests.roomId)
  .where(sql`${maintenanceRequests.scheduledDate} >= CURRENT_DATE`);
export const maintenanceOpenUrgentIdx = index('idx_maintenance_open_urgent')
  .on(maintenanceRequests.priority, maintenanceRequests.status)
  .where(sql`${maintenanceRequests.status} = 'open' AND ${maintenanceRequests.priority} = 'urgent'`);

export type HousekeepingTask = typeof housekeepingTasks.$inferSelect;
export type NewHousekeepingTask = typeof housekeepingTasks.$inferInsert;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
export type NewMaintenanceRequest = typeof maintenanceRequests.$inferInsert;