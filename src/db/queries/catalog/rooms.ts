import {
  and,
  asc,
  eq,
  gte,
  lt,
  sql,
} from 'drizzle-orm';

import type { PgTransaction } from 'drizzle-orm/pg-core';

import { db as defaultDb } from '../../index.js';
import {
  rooms,
  roomTypes,
} from '../../schema/rooms.js';
import { roomInventory } from '../../schema/roomInventory.js';
import type { NewRoom, NewRoomType } from '../../schema/rooms.js';
import {
  validateAvailability,
  decrementInventory,
} from '../../utils.js';

type DbConnection = typeof defaultDb;
type TxOrDb = DbConnection | PgTransaction<any, any, any>;

export const createRoomType = async (
  data: NewRoomType,
  db: DbConnection = defaultDb,
) => {
  const [roomType] = await db
    .insert(roomTypes)
    .values(data)
    .returning()

  return roomType
}

export const updateRoomType = async (
  roomTypeId: number,
  data: Partial<NewRoomType>,
  db: DbConnection = defaultDb,
) => {
  const [roomType] = await db
    .update(roomTypes)
    .set(data)
    .where(eq(roomTypes.id, roomTypeId))
    .returning()

  return roomType
}

export const findRoomTypeById = async (
  roomTypeId: number,
  db: DbConnection = defaultDb,
) =>
  db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.id, roomTypeId))
    .limit(1);

export const listRoomTypes = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.isActive, true))
    .orderBy(asc(roomTypes.sortOrder));

export const createRoom = async (
  data: NewRoom,
  db: DbConnection = defaultDb,
) => {
  const [room] = await db
    .insert(rooms)
    .values(data)
    .returning()

  return room
}

export const updateRoom = async (
  roomId: number,
  data: Partial<NewRoom>,
  db: DbConnection = defaultDb,
) => {
  const [room] = await db
    .update(rooms)
    .set(data)
    .where(eq(rooms.id, roomId))
    .returning()

  return room
}

export const findRoomByNumber = async (roomNumber: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(rooms)
    .where(eq(rooms.roomNumber, roomNumber))
    .limit(1);

export const listRoomsByType = async (roomTypeId: number, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(rooms)
    .where(eq(rooms.roomTypeId, roomTypeId))
    .orderBy(asc(rooms.roomNumber));

export const listAvailableRooms = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(rooms)
    .where(eq(rooms.status, 'available'))
    .orderBy(asc(rooms.floor), asc(rooms.roomNumber));

export const getAvailabilityByDay = async (roomTypeId: number, startDate: string, endDate: string, db: DbConnection = defaultDb) => {
  const rows = await db
    .select({ date: roomInventory.date, available: roomInventory.available })
    .from(roomInventory)
    .where(and(
      eq(roomInventory.roomTypeId, roomTypeId),
      gte(roomInventory.date, startDate),
      lt(roomInventory.date, endDate),
    ));

  const map = new Map<string, number>();
  rows.forEach(({ date, available }) => {
    map.set(String(date), Number(available));
  });

  const out: Array<{ date: string; available: number }> = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  while (cursor < end) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ date: key, available: map.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

export const reserveRoomInventory = async (
  roomTypeId: number,
  startDate: string,
  endDate: string,
  quantity = 1,
  db: TxOrDb = defaultDb,
  overbookingPercent?: number,
) => {
  return db.transaction(async (tx) => {
    await validateAvailability(
      [{ roomTypeId, quantity }],
      startDate,
      endDate,
      overbookingPercent,
      tx,
    )

    await decrementInventory(roomTypeId, startDate, endDate, quantity, tx)

    return { ok: true };
  });
};