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

      const result = await listActiveRoomTypes(db);

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('STD');
      expect(result[1].code).toBe('SUITE');
    });
  });

  describe('findRoomTypeByCode', () => {
    it('finds room type by exact code', async () => {
      await createTestRoomType(db, { code: 'DELUXE' });

      const result = await findRoomTypeByCode('DELUXE', db);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('DELUXE');
    });

    it('returns empty when code does not exist', async () => {
      const result = await findRoomTypeByCode('NOPE', db);
      expect(result).toEqual([]);
    });
  });
});
