import { pgTable, serial, varchar, text, integer, decimal, boolean, timestamp, date, jsonb, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const roomStatusEnum = pgEnum('room_status', [
  'available',
  'occupied',
  'maintenance',
  'out_of_order',
  'blocked'
]);

export const roomTypes = pgTable('room_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  description: text('description'),
  basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
  maxOccupancy: integer('max_occupancy').notNull().default(2),
  maxAdults: integer('max_adults').notNull().default(2),
  maxChildren: integer('max_children').notNull().default(1),
  
  sizeSqm: decimal('size_sqm', { precision: 6, scale: 2 }),
  bedConfiguration: varchar('bed_configuration', { length: 100 }),
  viewType: varchar('view_type', { length: 50 }),
  
  amenities: jsonb('amenities').$type<string[]>(),
  images: jsonb('images').$type<Array<{
    url: string;
    caption?: string;
    order: number;
  }>>(),
  
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const roomTypesNameIdx = uniqueIndex('idx_room_types_name').on(roomTypes.name);
export const roomTypesCodeIdx = uniqueIndex('idx_room_types_code').on(roomTypes.code);
export const roomTypesActiveIdx = index('idx_room_types_active').on(roomTypes.isActive, roomTypes.sortOrder);
export const roomTypesSortIdx = index('idx_room_types_sort').on(roomTypes.sortOrder);

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  roomNumber: varchar('room_number', { length: 20 }).notNull().unique(),
  roomTypeId: integer('room_type_id').notNull().references(() => roomTypes.id),
  floor: integer('floor'),
  building: varchar('building', { length: 50 }),
  status: roomStatusEnum('status').notNull().default('available'),
  
  hasConnectingDoor: boolean('has_connecting_door').default(false),
  connectingRoomId: integer('connecting_room_id').references(() => rooms.id),
  isAccessible: boolean('is_accessible').default(false),
  
  lastDeepClean: date('last_deep_clean'),
  lastMaintenance: date('last_maintenance'),
  nextMaintenanceDue: date('next_maintenance_due'),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const roomsNumberIdx = uniqueIndex('idx_rooms_number').on(rooms.roomNumber);
export const roomsTypeIdx = index('idx_rooms_type').on(rooms.roomTypeId);
export const roomsStatusIdx = index('idx_rooms_status').on(rooms.status);
export const roomsFloorIdx = index('idx_rooms_floor').on(rooms.floor);
export const roomsTypeStatusIdx = index('idx_rooms_type_status').on(rooms.roomTypeId, rooms.status);
export const roomsMaintenanceIdx = index('idx_rooms_maintenance').on(rooms.nextMaintenanceDue);

export type RoomType = typeof roomTypes.$inferSelect;
export type NewRoomType = typeof roomTypes.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;