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
  createPromotion,
  updatePromotion,
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
      // 1. Create two promotions with distinct codes
      await createTestPromotion(db, { code: 'SUMMER10' });
      await createTestPromotion(db, { code: 'WINTER20' });

      // 2. Search for SUMMER10
      const result = await findPromotionByCode('SUMMER10', db);

      // Should return exactly one match
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('SUMMER10');
    });

    it('returns empty when code does not exist', async () => {
      // 1. Search for a non-existent code
      const result = await findPromotionByCode('NONEXISTENT', db);

      // Should return empty
      expect(result).toEqual([]);
    });
  });

  describe('listActivePromotions', () => {
    it('returns only active promotions valid for today', async () => {
      // 1. Create active/valid, expired, and inactive promotions
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

      // 2. List active promotions
      const result = await listActivePromotions(db);

      // Only the active, currently-valid promotion should appear
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((p) => p.isActive)).toBe(true);
      expect(result.find((p) => p.code === 'EXPIRED')).toBeUndefined();
      expect(result.find((p) => p.code === 'INACTIVE')).toBeUndefined();
    });
  });

  describe('listPromotionsForPeriod', () => {
    it('returns promotions overlapping the given date range', async () => {
      // 1. Create an overlapping and a non-overlapping promotion
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

      // 2. Query for the overlapping period
      const result = await listPromotionsForPeriod(
        '2026-02-15',
        '2026-03-15',
        db,
      );

      // Only the overlapping one should match
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('OVERLAP');
    });

    it('returns empty when no promotions overlap', async () => {
      // 1. Create a promotion outside the query range
      await createTestPromotion(db, {
        validFrom: '2026-06-01',
        validTo: '2026-07-31',
      });

      // 2. Query for January range
      const result = await listPromotionsForPeriod(
        '2026-01-01',
        '2026-01-31',
        db,
      );

      // No promotions should match
      expect(result).toEqual([]);
    });
  });

  describe('createPromotion', () => {
    it('creates a promotion and returns it', async () => {
      // 1. Create a new promotion with specific fields
      const promo = await createPromotion(
        {
          code: 'NEWYEAR25',
          name: 'New Year Special',
          discountType: 'percent',
          discountValue: '25.00',
          validFrom: '2026-12-25',
          validTo: '2027-01-05',
          isActive: true,
        },
        db,
      );

      // ID should be assigned, code and discount should match
      expect(promo.id).toBeTruthy();
      expect(promo.code).toBe('NEWYEAR25');
      expect(promo.discountValue).toBe('25.00');
    });
  });

  describe('updatePromotion', () => {
    it('updates promotion fields', async () => {
      // 1. Create a promotion via factory
      const promo = await createTestPromotion(db);

      // 2. Update discount value and deactivate
      const updated = await updatePromotion(
        promo.id,
        { discountValue: '20.00', isActive: false },
        db,
      );

      // Fields should reflect the changes
      expect(updated.discountValue).toBe('20.00');
      expect(updated.isActive).toBe(false);
    });
  });
});
