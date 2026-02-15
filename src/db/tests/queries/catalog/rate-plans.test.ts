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

import { createTestRatePlan, createTestRoomType } from '../../factories';

import {
  createRatePlan,
  updateRatePlan,
  createRoomTypeRate,
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

  describe('createRatePlan', () => {
    it('creates a rate plan and returns it', async () => {
      const plan = await createRatePlan(
        {
          name: 'Early Bird',
          code: 'EARLY',
          description: 'Book 30 days ahead',
          requiresAdvanceBookingDays: 30,
          isActive: true,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        },
        db,
      );

      expect(plan.id).toBeTruthy();
      expect(plan.code).toBe('EARLY');
      expect(plan.name).toBe('Early Bird');
    });
  });

  describe('updateRatePlan', () => {
    it('updates rate plan fields', async () => {
      const plan = await createTestRatePlan(db);

      const updated = await updateRatePlan(
        plan.id,
        { description: 'Updated plan', isActive: false },
        db,
      );

      expect(updated.description).toBe('Updated plan');
      expect(updated.isActive).toBe(false);
    });
  });

  describe('createRoomTypeRate', () => {
    it('creates a room type rate linking plan and room type', async () => {
      const rt = await createTestRoomType(db);
      const plan = await createTestRatePlan(db);

      const rate = await createRoomTypeRate(
        {
          roomTypeId: rt.id,
          ratePlanId: plan.id,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          price: '150.00',
        },
        db,
      );

      expect(rate.id).toBeTruthy();
      expect(rate.price).toBe('150.00');
      expect(rate.roomTypeId).toBe(rt.id);
      expect(rate.ratePlanId).toBe(plan.id);
    });
  });
});
