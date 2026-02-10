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
});
