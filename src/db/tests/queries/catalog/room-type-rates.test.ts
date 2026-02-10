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

import { roomTypeRates } from '../../../../db/schema/rates';

import {
  findRateForStay,
  listRatesForPlan,
} from '../../../../db/queries/catalog/room-type-rates';

describe('Catalog - room type rates', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('findRateForStay', () => {
    it('finds rates overlapping the stay window', async () => {
      const rt = await createTestRoomType(db);
      const rp = await createTestRatePlan(db);

      await db.insert(roomTypeRates).values({
        roomTypeId: rt.id,
        ratePlanId: rp.id,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        price: '150.00',
      });
      await db.insert(roomTypeRates).values({
        roomTypeId: rt.id,
        ratePlanId: rp.id,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        price: '200.00',
      });

      const result = await findRateForStay(
        rt.id,
        rp.id,
        '2026-03-10',
        '2026-03-15',
        db,
      );

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe('150.00');
    });

    it('returns empty when no rate covers the stay', async () => {
      const rt = await createTestRoomType(db);
      const rp = await createTestRatePlan(db);

      const result = await findRateForStay(
        rt.id,
        rp.id,
        '2026-01-01',
        '2026-01-05',
        db,
      );
      expect(result).toEqual([]);
    });
  });

  describe('listRatesForPlan', () => {
    it('lists all rates for a plan ordered by roomType and startDate', async () => {
      const rtA = await createTestRoomType(db, { code: 'RTA' });
      const rtB = await createTestRoomType(db, { code: 'RTB' });
      const rp = await createTestRatePlan(db);

      await db.insert(roomTypeRates).values({
        roomTypeId: rtB.id,
        ratePlanId: rp.id,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        price: '100.00',
      });
      await db.insert(roomTypeRates).values({
        roomTypeId: rtA.id,
        ratePlanId: rp.id,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        price: '120.00',
      });

      const result = await listRatesForPlan(rp.id, db);

      expect(result).toHaveLength(2);
      expect(result[0].roomTypeId).toBe(rtA.id);
      expect(result[1].roomTypeId).toBe(rtB.id);
    });
  });

  describe('FK constraints', () => {
    it('rejects a rate with non-existent roomTypeId', async () => {
      const rp = await createTestRatePlan(db);

      await expect(
        db.insert(roomTypeRates).values({
          roomTypeId: 999999,
          ratePlanId: rp.id,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          price: '100.00',
        }),
      ).rejects.toThrow();
    });

    it('rejects a rate with non-existent ratePlanId', async () => {
      const rt = await createTestRoomType(db);

      await expect(
        db.insert(roomTypeRates).values({
          roomTypeId: rt.id,
          ratePlanId: 999999,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          price: '100.00',
        }),
      ).rejects.toThrow();
    });
  });
});
