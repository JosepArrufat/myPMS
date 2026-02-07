import type { 
  RoomType, 
  NewRoomType, 
  Room, 
  NewRoom 
} from '../../schema/rooms';
import { roomTypes, rooms } from '../../schema/rooms';

type TestDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>;

export const createTestRoomType = async (
  db: TestDb,
  overrides: Partial<NewRoomType> = {},
  tx?: any
): Promise<RoomType> => {
  const conn = tx ?? db;
  const timestamp = Date.now();
  
  const [roomType] = await conn.insert(roomTypes).values({
    name: `Standard Room ${timestamp}`,
    code: `STD${timestamp.toString().slice(-6)}`,
    description: 'Standard room type',
    totalRooms: 25,
    basePrice: '100.00',
    maxOccupancy: 2,
    maxAdults: 2,
    maxChildren: 1,
    sizeSqm: '30.00',
    bedConfiguration: 'queen',
    viewType: 'city',
    amenities: ['wifi', 'tv', 'minibar'],
    isActive: true,
    ...overrides,
  }).returning();
  
  return roomType;
};

export const createTestRoom = async (
  db: TestDb,
  roomTypeId: number,
  overrides: Partial<NewRoom> = {},
  tx?: any
): Promise<Room> => {
  const conn = tx ?? db;
  const randomNum = 100 + Math.floor(Math.random() * 900);
  
  const [room] = await conn.insert(rooms).values({
    roomTypeId,
    roomNumber: randomNum,
    floor: 1,
    status: 'available',
    ...overrides,
  }).returning();
  
  return room;
};
