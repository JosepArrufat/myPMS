import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest';

import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../../setup';

import {
  createTestRoomType,
  createTestRoom,
  createTestRoomInventory,
} from '../../factories';

import {
  createRoomType,
  updateRoomType,
  findRoomTypeById,
  listRoomTypes,
  createRoom,
  updateRoom,
  findRoomByNumber,
  listRoomsByType,
  listAvailableRooms,
  getAvailabilityByDay,
  reserveRoomInventory,
} from '../../../../db/queries/catalog/rooms';

describe('Catalog - rooms', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('findRoomByNumber', () => {
    it('finds a room by exact room number', async () => {
      // 1. Seed two rooms with different numbers
      await createTestRoom(db, { roomNumber: '101A' });
      await createTestRoom(db, { roomNumber: '102A' });

      // 2. Look up by the first room number
      const result = await findRoomByNumber('101A', db);

      // Should return exactly one match
      expect(result).toHaveLength(1);
      expect(result[0].roomNumber).toBe('101A');
    });

    it('returns empty when room number does not exist', async () => {
      // 1. Search for a room number that was never seeded
      const result = await findRoomByNumber('NONEXISTENT', db);
      // Should return empty array
      expect(result).toEqual([]);
    });
  });

  describe('listRoomsByType', () => {
    it('returns rooms of the given type ordered by roomNumber', async () => {
      // 1. Create two room types
      const rtA = await createTestRoomType(db, { code: 'TYPEA' });
      const rtB = await createTestRoomType(db, { code: 'TYPEB' });

      // 2. Seed rooms — two for type A, one for type B
      await createTestRoom(db, {
        roomTypeId: rtA.id,
        roomNumber: 'B200',
      });
      await createTestRoom(db, {
        roomTypeId: rtA.id,
        roomNumber: 'A100',
      });
      await createTestRoom(db, {
        roomTypeId: rtB.id,
        roomNumber: 'C300',
      });

      // 3. List rooms for type A
      const result = await listRoomsByType(rtA.id, db);

      // Should return two rooms sorted by number
      expect(result).toHaveLength(2);
      expect(result[0].roomNumber).toBe('A100');
      expect(result[1].roomNumber).toBe('B200');
    });
  });

  describe('listAvailableRooms', () => {
    it('returns only rooms with status available', async () => {
      // 1. Seed one available room and one occupied room
      await createTestRoom(db, {
        roomNumber: 'AVAIL1',
        status: 'available',
      });
      await createTestRoom(db, {
        roomNumber: 'OCC1',
        status: 'occupied',
      });

      // 2. Fetch available rooms
      const result = await listAvailableRooms(db);

      // Should return only the available room
      expect(result).toHaveLength(1);
      expect(result[0].roomNumber).toBe('AVAIL1');
    });
  });

  describe('getAvailabilityByDay', () => {
    it('returns per-day availability filling gaps with 0', async () => {
      // 1. Create a room type
      const rt = await createTestRoomType(db);

      // 2. Seed inventory for day 1 and day 3, leaving day 2 empty
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-03-01',
        available: 5,
      });
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-03-03',
        available: 3,
      });

      // 3. Query availability for the 3-day window
      const result = await getAvailabilityByDay(
        rt.id,
        '2026-03-01',
        '2026-03-04',
        db,
      );

      // Should fill the gap day with 0 availability
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ date: '2026-03-01', available: 5 });
      expect(result[1]).toEqual({ date: '2026-03-02', available: 0 });
      expect(result[2]).toEqual({ date: '2026-03-03', available: 3 });
    });
  });

  describe('reserveRoomInventory', () => {
    it('decrements available count across the date range', async () => {
      // 1. Create a room type
      const rt = await createTestRoomType(db);

      // 2. Seed inventory with 5 available for two consecutive days
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-04-01',
        available: 5,
      });
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-04-02',
        available: 5,
      });

      // 3. Reserve 1 unit across the two-day range
      const result = await reserveRoomInventory(
        rt.id,
        '2026-04-01',
        '2026-04-03',
        1,
        db,
      );
      // Should succeed
      expect(result).toEqual({ ok: true });

      // 4. Verify counts decremented by 1 on each day
      const after = await getAvailabilityByDay(
        rt.id,
        '2026-04-01',
        '2026-04-03',
        db,
      );
      expect(after[0].available).toBe(4);
      expect(after[1].available).toBe(4);
    });

    it('throws when inventory is missing', async () => {
      // 1. Create a room type with no inventory rows
      const rt = await createTestRoomType(db);

      // 2. Attempt to reserve — should throw
      await expect(
        reserveRoomInventory(rt.id, '2026-04-01', '2026-04-03', 1, db),
      ).rejects.toThrow('No inventory row');
    });

    it('throws when sold out', async () => {
      // 1. Create a room type
      const rt = await createTestRoomType(db);

      // 2. Seed inventory with 0 available
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-04-01',
        available: 0,
      });

      // 3. Attempt to reserve — should throw
      await expect(
        reserveRoomInventory(rt.id, '2026-04-01', '2026-04-02', 1, db),
      ).rejects.toThrow('Insufficient availability');
    });
  });

  describe('FK constraints', () => {
    it('rejects a room with a non-existent roomTypeId', async () => {
      // 1. Import the rooms table directly
      const { rooms } = await import('../../../../db/schema/rooms');

      // 2. Attempt to insert with a fake roomTypeId — should throw FK error
      await expect(
        db.insert(rooms).values({
          roomNumber: 'FK-TEST',
          roomTypeId: 999999,
          floor: 1,
          status: 'available',
        }),
      ).rejects.toThrow();
    });
  });

  describe('createRoomType', () => {
    it('creates a room type and returns it', async () => {
      // 1. Create a room type with full details
      const rt = await createRoomType(
        {
          name: 'Presidential Suite',
          code: 'PRES',
          totalRooms: 2,
          basePrice: '500.00',
          maxOccupancy: 4,
          maxAdults: 2,
          maxChildren: 2,
        },
        db,
      );

      // Should have a generated id and correct fields
      expect(rt.id).toBeTruthy();
      expect(rt.name).toBe('Presidential Suite');
      expect(rt.code).toBe('PRES');
    });
  });

  describe('updateRoomType', () => {
    it('updates room type fields', async () => {
      // 1. Seed a default room type
      const rt = await createTestRoomType(db);

      // 2. Update price and description
      const updated = await updateRoomType(
        rt.id,
        { basePrice: '350.00', description: 'Renovated' },
        db,
      );

      // Should reflect the new values
      expect(updated.basePrice).toBe('350.00');
      expect(updated.description).toBe('Renovated');
    });
  });

  describe('findRoomTypeById', () => {
    it('returns the room type by id', async () => {
      // 1. Seed a room type
      const rt = await createTestRoomType(db);

      // 2. Look up by its id
      const result = await findRoomTypeById(rt.id, db);

      // Should return exactly one match
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(rt.id);
    });
  });

  describe('listRoomTypes', () => {
    it('lists only active room types', async () => {
      // 1. Seed one active and one inactive room type
      await createTestRoomType(db, { isActive: true });
      await createTestRoomType(db, { isActive: false });

      // 2. List room types (active only)
      const results = await listRoomTypes(db);

      // Should return only the active one
      expect(results).toHaveLength(1);
      expect(results[0].isActive).toBe(true);
    });
  });

  describe('createRoom', () => {
    it('creates a room and returns it', async () => {
      // 1. Seed a room type to satisfy the FK
      const rt = await createTestRoomType(db);

      // 2. Create a room linked to that type
      const room = await createRoom(
        {
          roomNumber: 'NEW-101',
          roomTypeId: rt.id,
          floor: 1,
        },
        db,
      );

      // Should return the room with correct fields
      expect(room.roomNumber).toBe('NEW-101');
      expect(room.roomTypeId).toBe(rt.id);
    });
  });

  describe('updateRoom', () => {
    it('updates room fields', async () => {
      // 1. Seed a default room
      const room = await createTestRoom(db);

      // 2. Update floor and notes
      const updated = await updateRoom(
        room.id,
        { floor: 5, notes: 'Corner room with view' },
        db,
      );

      // Should reflect the new values
      expect(updated.floor).toBe(5);
      expect(updated.notes).toBe('Corner room with view');
    });
  });
});
