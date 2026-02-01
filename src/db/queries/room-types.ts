import {
  asc,
  eq,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  roomTypes,
} from '../schema/rooms.js';

export const listActiveRoomTypes = async () =>
  db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.isActive, true))
    .orderBy(asc(roomTypes.sortOrder));

export const findRoomTypeByCode = async (code: string) =>
  db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.code, code))
    .limit(1);
