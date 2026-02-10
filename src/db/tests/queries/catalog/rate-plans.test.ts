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

import { createTestRatePlan } from '../../factories';

import {
  findRatePlanByCode,
  listActiveRatePlans,
  listRatePlansForStay,
} from '../../../../db/queries/catalog/rate-plans';

describe('Catalog - rate plans', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('findRatePlanByCode', () => {
    it('finds a rate plan by exact code', async () => {
      await createTestRatePlan(db, { code: 'BAR2026' });
      await createTestRatePlan(db, { code: 'CORP2026' });

      const result = await findRatePlanByCode('BAR2026', db);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('BAR2026');
    });

    it('returns empty when code does not exist', async () => {
      const result = await findRatePlanByCode('NONE', db);
      expect(result).toEqual([]);
    });
  });

  describe('listActiveRatePlans', () => {
    it('returns only active plans ordered by name', async () => {
      await createTestRatePlan(db, {
        name: 'Zebra Rate',
        isActive: true,
      });
      await createTestRatePlan(db, {
        name: 'Alpha Rate',
        isActive: true,
      });
      await createTestRatePlan(db, {
        name: 'Inactive Rate',
        isActive: false,
      });

      const result = await listActiveRatePlans(db);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alpha Rate');
      expect(result[1].name).toBe('Zebra Rate');
    });
  });

  describe('listRatePlansForStay', () => {
    it('returns active plans valid for the stay window', async () => {
      await createTestRatePlan(db, {
        code: 'VALID',
        isActive: true,
        validFrom: '2026-01-01',
        validTo: '2026-06-30',
      });
      await createTestRatePlan(db, {
        code: 'EXPIRED',
        isActive: true,
        validFrom: '2025-01-01',
        validTo: '2025-06-30',
      });
      await createTestRatePlan(db, {
        code: 'INACTIVE',
        isActive: false,
        validFrom: '2026-01-01',
        validTo: '2026-06-30',
      });

      const result = await listRatePlansForStay(
        '2026-03-01',
        '2026-03-05',
        db,
      );

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('VALID');
    });

    it('returns empty when no plan covers the stay', async () => {
      await createTestRatePlan(db, {
        isActive: true,
        validFrom: '2026-06-01',
        validTo: '2026-06-30',
      });

      const result = await listRatePlansForStay(
        '2026-01-01',
        '2026-01-05',
        db,
      );
      expect(result).toEqual([]);
    });
  });
});
