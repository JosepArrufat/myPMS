import {
  pgTable,
  serial,
  integer,
  date,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { roomTypes } from './rooms';

export const roomInventory = pgTable('room_inventory', {
  id: serial('id').primaryKey(),
  roomTypeId: integer('room_type_id').notNull().references(() => roomTypes.id),
  date: date('date').notNull(),
  capacity: integer('capacity').notNull().default(0),
  available: integer('available').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  inventoryUnique: uniqueIndex('idx_room_inventory_type_date').on(table.roomTypeId, table.date),
  inventoryTypeIdx: index('idx_room_inventory_type').on(table.roomTypeId),
}));

export type RoomInventory = typeof roomInventory.$inferSelect;
export type NewRoomInventory = typeof roomInventory.$inferInsert;
