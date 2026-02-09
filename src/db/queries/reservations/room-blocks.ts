import {
  and,
  asc,
  eq,
  gte,
  lte,
  sql,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  roomBlocks,
} from '../../schema/reservations.js';

type DbConnection = typeof defaultDb;

export const listActiveBlocksForRange = async (from: string, to: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomBlocks)
    .where(and(
      sql`${roomBlocks.releasedAt} IS NULL`,
      lte(roomBlocks.startDate, to),
      gte(roomBlocks.endDate, from),
    ))
    .orderBy(asc(roomBlocks.startDate));

export const listBlocksForRoom = async (roomId: number, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomBlocks)
    .where(eq(roomBlocks.roomId, roomId))
    .orderBy(asc(roomBlocks.startDate));

export const createRoomBlock = async (payload: {
  roomTypeId?: number;
  roomId?: number;
  startDate: string;
  endDate: string;
  blockType: string;
  quantity?: number;
  reason?: string;
}, db: DbConnection = defaultDb) => {
  const quantity = payload.quantity ?? 1;
  return db.transaction(async (tx) => {
    const [block] = await tx.insert(roomBlocks).values({
      roomId: payload.roomId ?? null,
      roomTypeId: payload.roomTypeId ?? null,
      startDate: payload.startDate,
      endDate: payload.endDate,
      blockType: payload.blockType as any,
      quantity,
      reason: payload.reason ?? null,
    }).returning();

    if (payload.roomTypeId) {
      await tx.execute(sql`
        UPDATE room_inventory
        SET available = available - ${quantity}
        WHERE room_type_id = ${payload.roomTypeId}
          AND date >= ${payload.startDate}
          AND date < ${payload.endDate}
      `);
    }

    return block;
  });
};

export const releaseRoomBlock = async (blockId: number, db: DbConnection = defaultDb) => {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(roomBlocks).where(eq(roomBlocks.id, blockId)).limit(1);
    if (!b) throw new Error('block not found');

    await tx.update(roomBlocks).set({ releasedAt: new Date() }).where(eq(roomBlocks.id, blockId));

    if (b.roomTypeId) {
      await tx.execute(sql`
        UPDATE room_inventory
        SET available = available + ${b.quantity}
        WHERE room_type_id = ${b.roomTypeId}
          AND date >= ${b.startDate}
          AND date < ${b.endDate}
      `);
    }

    return { ok: true };
  });
};
