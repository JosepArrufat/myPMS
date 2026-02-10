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
} from '../../schema/rooms.js';
import { roomInventory } from '../../schema/roomInventory.js';

type DbConnection = typeof defaultDb;
type TxOrDb = DbConnection | PgTransaction<any, any, any>;

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

export const reserveRoomInventory = async (roomTypeId: number, startDate: string, endDate: string, quantity = 1, db: TxOrDb = defaultDb) => {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ available: number }>(sql`
      SELECT available FROM room_inventory
      WHERE room_type_id = ${roomTypeId}
        AND date >= ${startDate}
        AND date < ${endDate}
      FOR UPDATE
    `);
    
    if (!rows || rows.length === 0) {
      throw new Error('inventory missing for some dates');
    }

    const soldOut = rows.some((r: { available: number }) => Number(r.available) < quantity);
    if (soldOut) {
      throw new Error('sold out');
    }

    await tx.execute(sql`
      UPDATE room_inventory
      SET available = available - ${quantity}
      WHERE room_type_id = ${roomTypeId}
        AND date >= ${startDate}
        AND date < ${endDate}
    `);

    return { ok: true };
  });
};