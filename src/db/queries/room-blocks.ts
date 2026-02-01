import {
  and,
  asc,
  eq,
  gte,
  lte,
  sql,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  roomBlocks,
} from '../schema/reservations.js';

export const listActiveBlocksForRange = async (from: string, to: string) =>
  db
    .select()
    .from(roomBlocks)
    .where(and(
      sql`${roomBlocks.releasedAt} IS NULL`,
      lte(roomBlocks.startDate, to),
      gte(roomBlocks.endDate, from),
    ))
    .orderBy(asc(roomBlocks.startDate));

export const listBlocksForRoom = async (roomId: number) =>
  db
    .select()
    .from(roomBlocks)
    .where(eq(roomBlocks.roomId, roomId))
    .orderBy(asc(roomBlocks.startDate));
