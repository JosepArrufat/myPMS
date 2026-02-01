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
});

export const reservationsNumberIdx = uniqueIndex('idx_reservations_number').on(reservations.reservationNumber);
export const reservationsGuestIdx = index('idx_reservations_guest').on(reservations.guestId);
export const reservationsDatesIdx = index('idx_reservations_dates').on(reservations.checkInDate, reservations.checkOutDate);
export const reservationsCheckInStatusIdx = index('idx_reservations_checkin_status').on(
  reservations.checkInDate,
  reservations.status,
);
export const reservationsCheckOutStatusIdx = index('idx_reservations_checkout_status').on(
  reservations.checkOutDate,
  reservations.status,
);
export const reservationsAgencyIdx = index('idx_reservations_agency')
  .on(reservations.agencyId)
  .where(sql`${reservations.agencyId} IS NOT NULL`);
export const reservationsActiveIdx = index('idx_reservations_active')
  .on(reservations.checkInDate, reservations.checkOutDate)
  .where(sql`${reservations.status} IN ('confirmed', 'checked_in')`);

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
});

export const reservationRoomsReservationIdx = index('idx_reservation_rooms_reservation').on(reservationRooms.reservationId);
export const reservationRoomsDatesIdx = index('idx_reservation_rooms_dates').on(
  reservationRooms.checkInDate,
  reservationRooms.checkOutDate,
);
export const reservationRoomsTypeIdx = index('idx_reservation_rooms_type').on(reservationRooms.roomTypeId);
export const reservationRoomsAvailabilityIdx = index('idx_reservation_rooms_availability')
  .on(reservationRooms.roomId, reservationRooms.checkInDate, reservationRooms.checkOutDate)
  .where(sql`${reservationRooms.roomId} IS NOT NULL`);
export const reservationRoomsTypeAvailabilityIdx = index('idx_reservation_rooms_type_availability').on(
  reservationRooms.roomTypeId,
  reservationRooms.checkInDate,
  reservationRooms.checkOutDate,
);

export const roomAssignments = pgTable('room_assignments', {
  id: serial('id').primaryKey(),
  reservationId: uuid('reservation_id').notNull().references(() => reservations.id, { onDelete: 'cascade' }),
  roomId: integer('room_id').notNull().references(() => rooms.id),
  date: date('date').notNull(),
  
  assignedAt: timestamp('assigned_at').defaultNow(),
  assignedBy: integer('assigned_by').references(() => users.id),
  notes: text('notes'),
});

export const roomAssignmentsRoomDateUnique = uniqueIndex('idx_room_assignments_room_date_unique').on(
  roomAssignments.roomId,
  roomAssignments.date,
);
export const roomAssignmentsReservationIdx = index('idx_room_assignments_reservation').on(roomAssignments.reservationId);
export const roomAssignmentsRoomDateIdx = index('idx_room_assignments_room_date').on(
  roomAssignments.roomId,
  roomAssignments.date,
);
export const roomAssignmentsDateIdx = index('idx_room_assignments_date').on(roomAssignments.date);

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
});

export const roomBlocksRoomIdx = index('idx_room_blocks_room').on(roomBlocks.roomId, roomBlocks.startDate, roomBlocks.endDate);
export const roomBlocksTypeIdx = index('idx_room_blocks_type').on(roomBlocks.roomTypeId, roomBlocks.startDate, roomBlocks.endDate);
export const roomBlocksDatesIdx = index('idx_room_blocks_dates').on(roomBlocks.startDate, roomBlocks.endDate);
export const roomBlocksActiveIdx = index('idx_room_blocks_active')
  .on(roomBlocks.startDate, roomBlocks.endDate)
  .where(sql`${roomBlocks.releasedAt} IS NULL`);

export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type ReservationRoom = typeof reservationRooms.$inferSelect;
export type NewReservationRoom = typeof reservationRooms.$inferInsert;
export type RoomAssignment = typeof roomAssignments.$inferSelect;
export type NewRoomAssignment = typeof roomAssignments.$inferInsert;
export type RoomBlock = typeof roomBlocks.$inferSelect;
export type NewRoomBlock = typeof roomBlocks.$inferInsert;