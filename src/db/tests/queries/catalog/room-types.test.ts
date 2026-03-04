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
} from '../../factories';

import {
  listActiveRoomTypes,
  findRoomTypeByCode,
} from '../../../../db/queries/catalog/room-types';

describe('Catalog - room types', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('listActiveRoomTypes', () => {
    it('returns only active room types ordered by sortOrder', async () => {
      // 1. Seed two active room types and one inactive
      await createTestRoomType(db, {
        name: 'Suite',
        code: 'SUITE',
        isActive: true,
        sortOrder: 2,
      });
      await createTestRoomType(db, {
        name: 'Standard',
        code: 'STD',
        isActive: true,
        sortOrder: 1,
      });
      await createTestRoomType(db, {
        name: 'Disabled',
        code: 'DIS',
        isActive: false,
        sortOrder: 0,
      });

      // 2. Fetch active room types
      const result = await listActiveRoomTypes(db);

      // Should return only active types, sorted by sortOrder
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('STD');
      expect(result[1].code).toBe('SUITE');
    });
  });

  describe('findRoomTypeByCode', () => {
    it('finds room type by exact code', async () => {
      // 1. Seed a room type with a known code
      await createTestRoomType(db, { code: 'DELUXE' });

      // 2. Look up by that code
      const result = await findRoomTypeByCode('DELUXE', db);

      // Should return exactly one match
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('DELUXE');
    });

    it('returns empty when code does not exist', async () => {
      // 1. Search for a code that was never seeded
      const result = await findRoomTypeByCode('NOPE', db);
      // Should return empty array
      expect(result).toEqual([]);
    });
  });
});
