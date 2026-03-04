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
  createTestRatePlan,
} from '../../factories';

import { roomTypeRateAdjustments } from '../../../../db/schema/rates';

import {
  listAdjustmentsForBaseType,
  listAdjustmentsForDerivedType,
} from '../../../../db/queries/catalog/room-type-rate-adjustments';

describe('Catalog - room type rate adjustments', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('listAdjustmentsForBaseType', () => {
    it('lists adjustments for a base type', async () => {
      // 1. Create base and derived room types
      const base = await createTestRoomType(db, { code: 'BASE' });
      const derived = await createTestRoomType(db, { code: 'DERIV' });

      // 2. Insert an adjustment linking base → derived
      await db.insert(roomTypeRateAdjustments).values({
        baseRoomTypeId: base.id,
        derivedRoomTypeId: derived.id,
        adjustmentType: 'amount',
        adjustmentValue: '25.00',
      });

      // 3. Query adjustments by base type
      const result = await listAdjustmentsForBaseType(base.id, undefined, db);

      // Should return one adjustment with correct value
      expect(result).toHaveLength(1);
      expect(result[0].adjustmentValue).toBe('25.00');
    });

    it('filters by ratePlanId when provided', async () => {
      // 1. Create base, derived room types and a rate plan
      const base = await createTestRoomType(db, { code: 'BASE' });
      const derived = await createTestRoomType(db, { code: 'DRV' });
      const rp = await createTestRatePlan(db);

      // 2. Insert plan-specific and plan-agnostic adjustments
      await db.insert(roomTypeRateAdjustments).values({
        baseRoomTypeId: base.id,
        derivedRoomTypeId: derived.id,
        ratePlanId: rp.id,
        adjustmentType: 'percent',
        adjustmentValue: '10.00',
      });
      await db.insert(roomTypeRateAdjustments).values({
        baseRoomTypeId: base.id,
        derivedRoomTypeId: derived.id,
        ratePlanId: null,
        adjustmentType: 'amount',
        adjustmentValue: '15.00',
      });

      // 3. Query with the specific ratePlanId
      const result = await listAdjustmentsForBaseType(base.id, rp.id, db);

      // Only the plan-specific adjustment should match
      expect(result).toHaveLength(1);
      expect(result[0].adjustmentType).toBe('percent');
    });
  });

  describe('listAdjustmentsForDerivedType', () => {
    it('lists adjustments for a derived room type', async () => {
      // 1. Create base and derived room types
      const base = await createTestRoomType(db, { code: 'BASE' });
      const derived = await createTestRoomType(db, { code: 'DRV' });

      // 2. Insert an adjustment linking base → derived
      await db.insert(roomTypeRateAdjustments).values({
        baseRoomTypeId: base.id,
        derivedRoomTypeId: derived.id,
        adjustmentType: 'amount',
        adjustmentValue: '30.00',
      });

      // 3. Query by derived type
      const result = await listAdjustmentsForDerivedType(derived.id, db);

      // Should link back to the correct base
      expect(result).toHaveLength(1);
      expect(result[0].baseRoomTypeId).toBe(base.id);
    });
  });

  describe('FK constraints', () => {
    it('rejects adjustment with non-existent baseRoomTypeId', async () => {
      // 1. Create only a derived room type
      const derived = await createTestRoomType(db);

      // 2. Attempt insert with bogus baseRoomTypeId
      await expect(
        db.insert(roomTypeRateAdjustments).values({
          baseRoomTypeId: 999999,
          derivedRoomTypeId: derived.id,
          adjustmentType: 'amount',
          adjustmentValue: '10.00',
        }),
      // Should throw due to FK violation
      ).rejects.toThrow();
    });
  });
});
