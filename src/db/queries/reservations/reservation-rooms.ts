import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  reservationRooms,
} from '../../schema/reservations.js';

type DbConnection = typeof defaultDb;

export const listRoomsForReservation = async (reservationId: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(reservationRooms)
    .where(eq(reservationRooms.reservationId, reservationId))
    .orderBy(asc(reservationRooms.checkInDate));

export const findRoomConflicts = async (
  roomId: number,
  from: string,
  to: string,
  db: DbConnection = defaultDb
) =>
  db
    .select()
    .from(reservationRooms)
    .where(and(
      eq(reservationRooms.roomId, roomId),
      lte(reservationRooms.checkInDate, to),
      gte(reservationRooms.checkOutDate, from),
    ))
    .orderBy(asc(reservationRooms.checkInDate));

export const findRoomTypeConflicts = async (
  roomTypeId: number,
  from: string,
  to: string,
  db: DbConnection = defaultDb
) =>
  db
    .select()
    .from(reservationRooms)
    .where(and(
      eq(reservationRooms.roomTypeId, roomTypeId),
      lte(reservationRooms.checkInDate, to),
      gte(reservationRooms.checkOutDate, from),
    ))
    .orderBy(asc(reservationRooms.checkInDate));
