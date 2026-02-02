import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  date,
  timestamp,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { guests } from './guests';
import { agencies } from './agencies';
import { ratePlans } from './rates';
import { rooms, roomTypes } from './rooms';
import { users } from './users';
import { sql } from 'drizzle-orm';

export const reservationStatusEnum = pgEnum('reservation_status', [
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show'
]);

export const roomBlockTypeEnum = pgEnum('room_block_type', [
  'maintenance',
  'renovation',
  'group_hold',
  'overbooking_buffer',
  'vip_hold'
]);

export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  reservationNumber: varchar('reservation_number', { length: 50 }).notNull().unique(),
  
  guestId: uuid('guest_id').notNull().references(() => guests.id),
  guestNameSnapshot: varchar('guest_name_snapshot', { length: 255 }).notNull(),
  guestEmailSnapshot: varchar('guest_email_snapshot', { length: 255 }),
  
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  actualCheckInTime: timestamp('actual_check_in_time'),
  actualCheckOutTime: timestamp('actual_check_out_time'),
  
  adultsCount: integer('adults_count').notNull().default(1),
  childrenCount: integer('children_count').notNull().default(0),
  
  status: reservationStatusEnum('status').notNull().default('pending'),
  source: varchar('source', { length: 50 }),
  agencyId: integer('agency_id').references(() => agencies.id),
  ratePlanId: integer('rate_plan_id').references(() => ratePlans.id),
  
  specialRequests: text('special_requests'),
  arrivalTime: varchar('arrival_time', { length: 10 }),
  observations: text('observations'),
  
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }),
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }),
  depositPaidAt: timestamp('deposit_paid_at'),
  currency: varchar('currency', { length: 3 }).default('USD'),
  
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: integer('cancelled_by').references(() => users.id),
  cancellationReason: text('cancellation_reason'),
  cancellationFee: decimal('cancellation_fee', { precision: 10, scale: 2 }),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
  createdBy: integer('created_by').references(() => users.id),
}, (table) => ({
  reservationsNumberIdx: uniqueIndex('idx_reservations_number').on(table.reservationNumber),
  reservationsGuestIdx: index('idx_reservations_guest').on(table.guestId),
  reservationsDatesIdx: index('idx_reservations_dates').on(table.checkInDate, table.checkOutDate),
  reservationsCheckInStatusIdx: index('idx_reservations_checkin_status').on(table.checkInDate, table.status),
  reservationsCheckOutStatusIdx: index('idx_reservations_checkout_status').on(table.checkOutDate, table.status),
  reservationsAgencyIdx: index('idx_reservations_agency').on(table.agencyId).where(sql`${table.agencyId} IS NOT NULL`),
  reservationsActiveIdx: index('idx_reservations_active').on(table.checkInDate, table.checkOutDate).where(sql`${table.status} IN ('confirmed', 'checked_in')`),
}));

export const reservationRooms = pgTable('reservation_rooms', {
  id: serial('id').primaryKey(),
  reservationId: uuid('reservation_id').notNull().references(() => reservations.id, { onDelete: 'cascade' }),
  roomId: integer('room_id').references(() => rooms.id),
  roomTypeId: integer('room_type_id').notNull().references(() => roomTypes.id),
  
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  
  rate: decimal('rate', { precision: 10, scale: 2 }).notNull(),
  ratePlanId: integer('rate_plan_id').references(() => ratePlans.id),
  
  assignedAt: timestamp('assigned_at'),
  assignedBy: integer('assigned_by').references(() => users.id),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  reservationRoomsReservationIdx: index('idx_reservation_rooms_reservation').on(table.reservationId),
  reservationRoomsDatesIdx: index('idx_reservation_rooms_dates').on(table.checkInDate, table.checkOutDate),
  reservationRoomsTypeIdx: index('idx_reservation_rooms_type').on(table.roomTypeId),
  reservationRoomsAvailabilityIdx: index('idx_reservation_rooms_availability').on(table.roomId, table.checkInDate, table.checkOutDate).where(sql`${table.roomId} IS NOT NULL`),
  reservationRoomsTypeAvailabilityIdx: index('idx_reservation_rooms_type_availability').on(table.roomTypeId, table.checkInDate, table.checkOutDate),
}));

export const roomAssignments = pgTable('room_assignments', {
  id: serial('id').primaryKey(),
  reservationId: uuid('reservation_id').notNull().references(() => reservations.id, { onDelete: 'cascade' }),
  roomId: integer('room_id').notNull().references(() => rooms.id),
  date: date('date').notNull(),
  
  assignedAt: timestamp('assigned_at').defaultNow(),
  assignedBy: integer('assigned_by').references(() => users.id),
  notes: text('notes'),
}, (table) => ({
  roomAssignmentsRoomDateUnique: uniqueIndex('idx_room_assignments_room_date_unique').on(table.roomId, table.date),
  roomAssignmentsReservationIdx: index('idx_room_assignments_reservation').on(table.reservationId),
  roomAssignmentsRoomDateIdx: index('idx_room_assignments_room_date').on(table.roomId, table.date),
  roomAssignmentsDateIdx: index('idx_room_assignments_date').on(table.date),
}));

export const roomBlocks = pgTable('room_blocks', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id').references(() => rooms.id),
  roomTypeId: integer('room_type_id').references(() => roomTypes.id),
  
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  
  blockType: roomBlockTypeEnum('block_type').notNull(),
  quantity: integer('quantity').default(1),
  
  reason: text('reason'),
  notes: text('notes'),
  
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
  releasedAt: timestamp('released_at'),
  releasedBy: integer('released_by').references(() => users.id),
}, (table) => ({
  roomBlocksRoomIdx: index('idx_room_blocks_room').on(table.roomId, table.startDate, table.endDate),
  roomBlocksTypeIdx: index('idx_room_blocks_type').on(table.roomTypeId, table.startDate, table.endDate),
  roomBlocksDatesIdx: index('idx_room_blocks_dates').on(table.startDate, table.endDate),
  roomBlocksActiveIdx: index('idx_room_blocks_active').on(table.startDate, table.endDate).where(sql`${table.releasedAt} IS NULL`),
}));

export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type ReservationRoom = typeof reservationRooms.$inferSelect;
export type NewReservationRoom = typeof reservationRooms.$inferInsert;
export type RoomAssignment = typeof roomAssignments.$inferSelect;
export type NewRoomAssignment = typeof roomAssignments.$inferInsert;
export type RoomBlock = typeof roomBlocks.$inferSelect;
export type NewRoomBlock = typeof roomBlocks.$inferInsert;