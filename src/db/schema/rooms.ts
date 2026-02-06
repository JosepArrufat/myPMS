import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  AnyPgColumn,
} from 'drizzle-orm/pg-core';
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
  totalRooms: integer('total_rooms').notNull().default(0),
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
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  nameIdx: uniqueIndex('idx_room_types_name').on(table.name),
  codeIdx: uniqueIndex('idx_room_types_code').on(table.code),
  activeIdx: index('idx_room_types_active').on(table.isActive, table.sortOrder),
  sortIdx: index('idx_room_types_sort').on(table.sortOrder),
}));

export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  roomNumber: varchar('room_number', { length: 20 }).notNull().unique(),
  roomTypeId: integer('room_type_id').notNull().references(() => roomTypes.id),
  floor: integer('floor'),
  building: varchar('building', { length: 50 }),
  status: roomStatusEnum('status').notNull().default('available'),
  
  hasConnectingDoor: boolean('has_connecting_door').default(false),
  connectingRoomId: integer('connecting_room_id').references((): AnyPgColumn => rooms.id),
  isAccessible: boolean('is_accessible').default(false),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  roomsNumberIdx: uniqueIndex('idx_rooms_number').on(table.roomNumber),
}));

export type RoomType = typeof roomTypes.$inferSelect;
export type NewRoomType = typeof roomTypes.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;