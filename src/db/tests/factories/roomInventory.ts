import type { 
  RoomInventory, 
  NewRoomInventory 
} from '../../schema/roomInventory';
import { roomInventory } from '../../schema/roomInventory';
import type { TestDb } from '../setup';

export const createTestRoomInventory = async (
  db: TestDb,
  overrides: Partial<NewRoomInventory> = {},
  tx?: any
): Promise<RoomInventory> => {
  const conn = tx ?? db;
  
  let roomTypeId = overrides.roomTypeId;
  if (!roomTypeId) {
    const { createTestRoomType } = await import('./rooms');
    const roomType = await createTestRoomType(db, {}, tx);
    roomTypeId = roomType.id;
  }
  
  const date = overrides.date || '2026-02-10';
  
  const [inventory] = await conn.insert(roomInventory).values({
    roomTypeId,
    date,
    capacity: 10,
    available: 10,
    ...overrides,
  }).returning();
  
  return inventory;
};
