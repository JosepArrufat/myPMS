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
      const base = await createTestRoomType(db, { code: 'BASE' });
      const derived = await createTestRoomType(db, { code: 'DERIV' });

      await db.insert(roomTypeRateAdjustments).values({
        baseRoomTypeId: base.id,
        derivedRoomTypeId: derived.id,
        adjustmentType: 'amount',
        adjustmentValue: '25.00',
      });

      const result = await listAdjustmentsForBaseType(base.id, undefined, db);

      expect(result).toHaveLength(1);
      expect(result[0].adjustmentValue).toBe('25.00');
    });

    it('filters by ratePlanId when provided', async () => {
      const base = await createTestRoomType(db, { code: 'BASE' });
      const derived = await createTestRoomType(db, { code: 'DRV' });
      const rp = await createTestRatePlan(db);

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

      const result = await listAdjustmentsForBaseType(base.id, rp.id, db);

      expect(result).toHaveLength(1);
      expect(result[0].adjustmentType).toBe('percent');
    });
  });

  describe('listAdjustmentsForDerivedType', () => {
    it('lists adjustments for a derived room type', async () => {
      const base = await createTestRoomType(db, { code: 'BASE' });
      const derived = await createTestRoomType(db, { code: 'DRV' });

      await db.insert(roomTypeRateAdjustments).values({
        baseRoomTypeId: base.id,
        derivedRoomTypeId: derived.id,
        adjustmentType: 'amount',
        adjustmentValue: '30.00',
      });

      const result = await listAdjustmentsForDerivedType(derived.id, db);

      expect(result).toHaveLength(1);
      expect(result[0].baseRoomTypeId).toBe(base.id);
    });
  });

  describe('FK constraints', () => {
    it('rejects adjustment with non-existent baseRoomTypeId', async () => {
      const derived = await createTestRoomType(db);

      await expect(
        db.insert(roomTypeRateAdjustments).values({
          baseRoomTypeId: 999999,
          derivedRoomTypeId: derived.id,
          adjustmentType: 'amount',
          adjustmentValue: '10.00',
        }),
      ).rejects.toThrow();
    });
  });
});
