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
      // 1. Seed two rate plans with distinct codes
      await createTestRatePlan(db, { code: 'BAR2026' });
      await createTestRatePlan(db, { code: 'CORP2026' });

      // 2. Look up by the first code
      const result = await findRatePlanByCode('BAR2026', db);

      // Should return exactly one match
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('BAR2026');
    });

    it('returns empty when code does not exist', async () => {
      // 1. Search for a code that was never seeded
      const result = await findRatePlanByCode('NONE', db);
      // Should return empty array
      expect(result).toEqual([]);
    });
  });

  describe('listActiveRatePlans', () => {
    it('returns only active plans ordered by name', async () => {
      // 1. Seed two active plans and one inactive
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

      // 2. Fetch active rate plans
      const result = await listActiveRatePlans(db);

      // Should return only active plans, sorted alphabetically
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alpha Rate');
      expect(result[1].name).toBe('Zebra Rate');
    });
  });

  describe('listRatePlansForStay', () => {
    it('returns active plans valid for the stay window', async () => {
      // 1. Seed a valid+active, an expired+active, and a valid+inactive plan
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

      // 2. Query plans valid for a March 2026 stay
      const result = await listRatePlansForStay(
        '2026-03-01',
        '2026-03-05',
        db,
      );

      // Should return only the plan that is both active and covers the stay
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('VALID');
    });

    it('returns empty when no plan covers the stay', async () => {
      // 1. Seed a plan valid only in June
      await createTestRatePlan(db, {
        isActive: true,
        validFrom: '2026-06-01',
        validTo: '2026-06-30',
      });

      // 2. Query for a January stay
      const result = await listRatePlansForStay(
        '2026-01-01',
        '2026-01-05',
        db,
      );
      // Should return empty — no plan covers the window
      expect(result).toEqual([]);
    });
  });

  describe('createRatePlan', () => {
    it('creates a rate plan and returns it', async () => {
      // 1. Create a rate plan with full details
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

      // Should have a generated id and correct fields
      expect(plan.id).toBeTruthy();
      expect(plan.code).toBe('EARLY');
      expect(plan.name).toBe('Early Bird');
    });
  });

  describe('updateRatePlan', () => {
    it('updates rate plan fields', async () => {
      // 1. Seed a default rate plan
      const plan = await createTestRatePlan(db);

      // 2. Update description and deactivate
      const updated = await updateRatePlan(
        plan.id,
        { description: 'Updated plan', isActive: false },
        db,
      );

      // Should reflect the new values
      expect(updated.description).toBe('Updated plan');
      expect(updated.isActive).toBe(false);
    });
  });

  describe('createRoomTypeRate', () => {
    it('creates a room type rate linking plan and room type', async () => {
      // 1. Seed a room type and a rate plan
      const rt = await createTestRoomType(db);
      const plan = await createTestRatePlan(db);

      // 2. Link them with a room-type rate for March
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

      // Should have a generated id and correct foreign keys
      expect(rate.id).toBeTruthy();
      expect(rate.price).toBe('150.00');
      expect(rate.roomTypeId).toBe(rt.id);
      expect(rate.ratePlanId).toBe(plan.id);
    });
  });
});
