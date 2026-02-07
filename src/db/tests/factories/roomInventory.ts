import type { 
  RoomInventory, 
  NewRoomInventory 
} from '../../schema/roomInventory';
import { roomInventory } from '../../schema/roomInventory';

type TestDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>;

export const createTestRoomInventory = async (
  db: TestDb,
  roomTypeId: number,
  date: string,
  overrides: Partial<NewRoomInventory> = {},
  tx?: any
): Promise<RoomInventory> => {
  const conn = tx ?? db;
  
  const [inventory] = await conn.insert(roomInventory).values({
    roomTypeId,
    date,
    capacity: 10,
    available: 10,
    ...overrides,
  }).returning();
  
  return inventory;
};
