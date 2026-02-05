import {
  and,
  eq,
  gte,
  lte,
  sql,
} from 'drizzle-orm';

import { db } from '../../index.js';
import { rooms } from '../../schema/rooms.js';
import { roomBlocks, roomAssignments } from '../../schema/reservations.js';

export const isRoomAvailableNow = async (roomId: number, date: string) => {
  const [room] = await db
    .select({ status: rooms.status })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room || room.status !== 'available') {
    return false;
  }

  const [assignment] = await db
    .select({ id: roomAssignments.id })
    .from(roomAssignments)
    .where(and(
      eq(roomAssignments.roomId, roomId),
      eq(roomAssignments.date, date)
    ))
    .limit(1);

  if (assignment) {
    return false;
  }

  const [block] = await db
    .select({ id: roomBlocks.id })
    .from(roomBlocks)
    .where(and(
      eq(roomBlocks.roomId, roomId),
      lte(roomBlocks.startDate, date),
      gte(roomBlocks.endDate, date),
      sql`${roomBlocks.releasedAt} IS NULL`
    ))
    .limit(1);

  return !block;
};
