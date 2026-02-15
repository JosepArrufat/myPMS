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
      await createTestRoom(db, { roomNumber: '101A' });
      await createTestRoom(db, { roomNumber: '102A' });

      const result = await findRoomByNumber('101A', db);

      expect(result).toHaveLength(1);
      expect(result[0].roomNumber).toBe('101A');
    });

    it('returns empty when room number does not exist', async () => {
      const result = await findRoomByNumber('NONEXISTENT', db);
      expect(result).toEqual([]);
    });
  });

  describe('listRoomsByType', () => {
    it('returns rooms of the given type ordered by roomNumber', async () => {
      const rtA = await createTestRoomType(db, { code: 'TYPEA' });
      const rtB = await createTestRoomType(db, { code: 'TYPEB' });

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

      const result = await listRoomsByType(rtA.id, db);

      expect(result).toHaveLength(2);
      expect(result[0].roomNumber).toBe('A100');
      expect(result[1].roomNumber).toBe('B200');
    });
  });

  describe('listAvailableRooms', () => {
    it('returns only rooms with status available', async () => {
      await createTestRoom(db, {
        roomNumber: 'AVAIL1',
        status: 'available',
      });
      await createTestRoom(db, {
        roomNumber: 'OCC1',
        status: 'occupied',
      });

      const result = await listAvailableRooms(db);

      expect(result).toHaveLength(1);
      expect(result[0].roomNumber).toBe('AVAIL1');
    });
  });

  describe('getAvailabilityByDay', () => {
    it('returns per-day availability filling gaps with 0', async () => {
      const rt = await createTestRoomType(db);

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

      const result = await getAvailabilityByDay(
        rt.id,
        '2026-03-01',
        '2026-03-04',
        db,
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ date: '2026-03-01', available: 5 });
      expect(result[1]).toEqual({ date: '2026-03-02', available: 0 });
      expect(result[2]).toEqual({ date: '2026-03-03', available: 3 });
    });
  });

  describe('reserveRoomInventory', () => {
    it('decrements available count across the date range', async () => {
      const rt = await createTestRoomType(db);

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

      const result = await reserveRoomInventory(
        rt.id,
        '2026-04-01',
        '2026-04-03',
        1,
        db,
      );
      expect(result).toEqual({ ok: true });

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
      const rt = await createTestRoomType(db);

      await expect(
        reserveRoomInventory(rt.id, '2026-04-01', '2026-04-03', 1, db),
      ).rejects.toThrow('inventory missing');
    });

    it('throws when sold out', async () => {
      const rt = await createTestRoomType(db);

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-04-01',
        available: 0,
      });

      await expect(
        reserveRoomInventory(rt.id, '2026-04-01', '2026-04-02', 1, db),
      ).rejects.toThrow('sold out');
    });
  });

  describe('FK constraints', () => {
    it('rejects a room with a non-existent roomTypeId', async () => {
      const { rooms } = await import('../../../../db/schema/rooms');

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

      expect(rt.id).toBeTruthy();
      expect(rt.name).toBe('Presidential Suite');
      expect(rt.code).toBe('PRES');
    });
  });

  describe('updateRoomType', () => {
    it('updates room type fields', async () => {
      const rt = await createTestRoomType(db);

      const updated = await updateRoomType(
        rt.id,
        { basePrice: '350.00', description: 'Renovated' },
        db,
      );

      expect(updated.basePrice).toBe('350.00');
      expect(updated.description).toBe('Renovated');
    });
  });

  describe('findRoomTypeById', () => {
    it('returns the room type by id', async () => {
      const rt = await createTestRoomType(db);

      const result = await findRoomTypeById(rt.id, db);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(rt.id);
    });
  });

  describe('listRoomTypes', () => {
    it('lists only active room types', async () => {
      await createTestRoomType(db, { isActive: true });
      await createTestRoomType(db, { isActive: false });

      const results = await listRoomTypes(db);

      expect(results).toHaveLength(1);
      expect(results[0].isActive).toBe(true);
    });
  });

  describe('createRoom', () => {
    it('creates a room and returns it', async () => {
      const rt = await createTestRoomType(db);

      const room = await createRoom(
        {
          roomNumber: 'NEW-101',
          roomTypeId: rt.id,
          floor: 1,
        },
        db,
      );

      expect(room.roomNumber).toBe('NEW-101');
      expect(room.roomTypeId).toBe(rt.id);
    });
  });

  describe('updateRoom', () => {
    it('updates room fields', async () => {
      const room = await createTestRoom(db);

      const updated = await updateRoom(
        room.id,
        { floor: 5, notes: 'Corner room with view' },
        db,
      );

      expect(updated.floor).toBe(5);
      expect(updated.notes).toBe('Corner room with view');
    });
  });
});
