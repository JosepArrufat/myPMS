import { pgTable, serial, integer, varchar, text, date, timestamp, decimal, index } from 'drizzle-orm/pg-core';
import { rooms } from './rooms';
import { users } from './users';
import { sql } from 'drizzle-orm';
export const housekeepingTasks = pgTable('housekeeping_tasks', {
    id: serial('id').primaryKey(),
    roomId: integer('room_id').notNull().references(() => rooms.id),
    taskDate: date('task_date').notNull().defaultNow(),
    taskType: varchar('task_type', { length: 50 }).notNull(),
    priority: integer('priority').default(0),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
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
export const housekeepingRoomDateIdx = index('idx_housekeeping_room_date').on(housekeepingTasks.roomId, housekeepingTasks.taskDate);
export const housekeepingDateStatusIdx = index('idx_housekeeping_date_status').on(housekeepingTasks.taskDate, housekeepingTasks.status);
export const housekeepingAssignedIdx = index('idx_housekeeping_assigned').on(housekeepingTasks.assignedTo, housekeepingTasks.status);
// Today's pending tasks
export const housekeepingTodayPendingIdx = index('idx_housekeeping_today_pending')
    .on(housekeepingTasks.taskDate, housekeepingTasks.status)
    .where(sql `${housekeepingTasks.status} IN ('pending', 'in_progress')`);
export const maintenanceRequests = pgTable('maintenance_requests', {
    id: serial('id').primaryKey(),
    roomId: integer('room_id').references(() => rooms.id),
    category: varchar('category', { length: 50 }),
    priority: varchar('priority', { length: 20 }).default('normal'),
    description: text('description').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    assignedTo: integer('assigned_to').references(() => users.id),
    scheduledDate: date('scheduled_date'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    resolutionNotes: text('resolution_notes'),
    partsUsed: text('parts_used'),
    cost: decimal('cost', { precision: 10, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow(),
    createdBy: integer('created_by').references(() => users.id),
    updatedAt: timestamp('updated_at').defaultNow(),
});
export const maintenanceRoomIdx = index('idx_maintenance_room').on(maintenanceRequests.roomId);
export const maintenanceStatusIdx = index('idx_maintenance_status').on(maintenanceRequests.status);
export const maintenanceAssignedIdx = index('idx_maintenance_assigned').on(maintenanceRequests.assignedTo, maintenanceRequests.status);
export const maintenanceCategoryIdx = index('idx_maintenance_category').on(maintenanceRequests.category);
export const maintenancePriorityIdx = index('idx_maintenance_priority').on(maintenanceRequests.priority);
// Open urgent requests
export const maintenanceOpenUrgentIdx = index('idx_maintenance_open_urgent')
    .on(maintenanceRequests.priority, maintenanceRequests.status)
    .where(sql `${maintenanceRequests.status} = 'open' AND ${maintenanceRequests.priority} = 'urgent'`);
