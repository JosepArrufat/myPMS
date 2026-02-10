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

import { createTestPromotion } from '../../factories';

import {
  findPromotionByCode,
  listActivePromotions,
  listPromotionsForPeriod,
} from '../../../../db/queries/catalog/promotions';

describe('Catalog - promotions', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('findPromotionByCode', () => {
    it('finds a promotion by exact code', async () => {
      await createTestPromotion(db, { code: 'SUMMER10' });
      await createTestPromotion(db, { code: 'WINTER20' });

      const result = await findPromotionByCode('SUMMER10', db);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('SUMMER10');
    });

    it('returns empty when code does not exist', async () => {
      const result = await findPromotionByCode('NONEXISTENT', db);
      expect(result).toEqual([]);
    });
  });

  describe('listActivePromotions', () => {
    it('returns only active promotions valid for today', async () => {
      await createTestPromotion(db, {
        code: 'ACTIVE1',
        isActive: true,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
      await createTestPromotion(db, {
        code: 'EXPIRED',
        isActive: true,
        validFrom: '2025-01-01',
        validTo: '2025-06-01',
      });
      await createTestPromotion(db, {
        code: 'INACTIVE',
        isActive: false,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });

      const result = await listActivePromotions(db);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((p) => p.isActive)).toBe(true);
      expect(result.find((p) => p.code === 'EXPIRED')).toBeUndefined();
      expect(result.find((p) => p.code === 'INACTIVE')).toBeUndefined();
    });
  });

  describe('listPromotionsForPeriod', () => {
    it('returns promotions overlapping the given date range', async () => {
      await createTestPromotion(db, {
        code: 'OVERLAP',
        validFrom: '2026-03-01',
        validTo: '2026-04-30',
      });
      await createTestPromotion(db, {
        code: 'OUTSIDE',
        validFrom: '2026-06-01',
        validTo: '2026-07-31',
      });

      const result = await listPromotionsForPeriod(
        '2026-02-15',
        '2026-03-15',
        db,
      );

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('OVERLAP');
    });

    it('returns empty when no promotions overlap', async () => {
      await createTestPromotion(db, {
        validFrom: '2026-06-01',
        validTo: '2026-07-31',
      });

      const result = await listPromotionsForPeriod(
        '2026-01-01',
        '2026-01-31',
        db,
      );
      expect(result).toEqual([]);
    });
  });
});
