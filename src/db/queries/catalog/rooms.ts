import {
  asc,
  eq,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  rooms,
} from '../../schema/rooms.js';

export const findRoomByNumber = async (roomNumber: string) =>
  db
    .select()
    .from(rooms)
    .where(eq(rooms.roomNumber, roomNumber))
    .limit(1);

export const listRoomsByType = async (roomTypeId: number) =>
  db
    .select()
    .from(rooms)
    .where(eq(rooms.roomTypeId, roomTypeId))
    .orderBy(asc(rooms.roomNumber));

export const listAvailableRooms = async () =>
  db
    .select()
    .from(rooms)
    .where(eq(rooms.status, 'available'))
    .orderBy(asc(rooms.floor), asc(rooms.roomNumber));
