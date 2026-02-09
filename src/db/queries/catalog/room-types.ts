import {
  asc,
  eq,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  roomTypes,
} from '../../schema/rooms.js';

type DbConnection = typeof defaultDb;

export const listActiveRoomTypes = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.isActive, true))
    .orderBy(asc(roomTypes.sortOrder));

export const findRoomTypeByCode = async (code: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.code, code))
    .limit(1);
