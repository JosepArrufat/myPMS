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
import {
  decrementInventory,
  incrementInventory,
} from '../../utils.js';

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
      await decrementInventory(
        payload.roomTypeId,
        payload.startDate,
        payload.endDate,
        quantity,
        tx,
      );
    }

    return block;
  });
};

export const releaseRoomBlock = async (blockId: number, db: DbConnection = defaultDb) => {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(roomBlocks).where(eq(roomBlocks.id, blockId)).limit(1);
    if (!b) throw new Error('block not found');
    if (b.releasedAt) throw new Error('block already released');

    // Count rooms already picked up from this block (linked via block_id)
    const [pickupResult] = await tx.execute(sql`
      SELECT COUNT(*)::int AS pickup
      FROM reservation_rooms rr
      JOIN reservations r ON r.id = rr.reservation_id
      WHERE rr.block_id = ${blockId}
        AND r.status IN ('pending', 'confirmed', 'checked_in')
    `);
    const pickedUp = (pickupResult as any).pickup ?? 0;
    const unreleased = (b.quantity ?? 0) - pickedUp;

    await tx.update(roomBlocks).set({ releasedAt: new Date() }).where(eq(roomBlocks.id, blockId));

    // Only restore unreleased slots (picked-up rooms stay decremented)
    if (unreleased > 0 && b.roomTypeId) {
      await incrementInventory(
        b.roomTypeId,
        b.startDate,
        b.endDate,
        unreleased,
        tx,
      );
    }

    return { ok: true, releasedSlots: unreleased, pickedUp };
  });
};
