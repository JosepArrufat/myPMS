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
  createTestRatePlan,
} from '../../factories';

import {
  getDailyRevenue,
  listDailyRevenueRange,
} from '../../../../db/queries/reporting/daily-revenue';

import {
  listRatePlanRevenueRange,
} from '../../../../db/queries/reporting/daily-rate-revenue';

import {
  listRoomTypeRevenueRange,
} from '../../../../db/queries/reporting/daily-room-type-revenue';

import {
  getMonthlyRevenue,
  listMonthlyRevenueRange,
} from '../../../../db/queries/reporting/monthly-revenue';

import {
  getYearlyRevenue,
  listYearlyRevenueRange,
} from '../../../../db/queries/reporting/yearly-revenue';

import {
  dailyRevenue,
  dailyRateRevenue,
  dailyRoomTypeRevenue,
  monthlyRevenue,
  yearlyRevenue,
} from '../../../../db/schema/reporting';

describe('Reporting queries', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  it('gets daily revenue by date and range', async () => {
    await db.insert(dailyRevenue).values({ date: '2026-02-01', totalRevenue: '100.00' });
    await db.insert(dailyRevenue).values({ date: '2026-02-02', totalRevenue: '200.00' });

    const single = await getDailyRevenue('2026-02-01', db);
    expect(single.length).toBe(1);
    expect(single[0].totalRevenue).toBe('100.00');

    const range = await listDailyRevenueRange('2026-02-01', '2026-02-02', db);
    expect(range.length).toBe(2);
  });

  it('lists rate-plan and room-type revenue ranges', async () => {
    const rp = await createTestRatePlan(db);
    const rt = await createTestRoomType(db);

    await db.insert(dailyRateRevenue).values({ date: '2026-02-01', ratePlanId: rp.id, roomRevenue: '150.00' });
    await db.insert(dailyRateRevenue).values({ date: '2026-02-02', ratePlanId: rp.id, roomRevenue: '100.00' });

    await db.insert(dailyRoomTypeRevenue).values({ date: '2026-02-01', roomTypeId: rt.id, revenue: '300.00' });

    const rpr = await listRatePlanRevenueRange(rp.id, '2026-02-01', '2026-02-02', db);
    expect(rpr.length).toBe(2);

    const rtr = await listRoomTypeRevenueRange(rt.id, '2026-02-01', '2026-02-02', db);
    expect(rtr.length).toBe(1);
  });

  it('gets monthly and yearly revenue', async () => {
    await db.insert(monthlyRevenue).values({ month: '2026-02-01', totalRevenue: '5000.00' });
    await db.insert(monthlyRevenue).values({ month: '2026-03-01', totalRevenue: '6000.00' });

    await db.insert(yearlyRevenue).values({ year: 2026, totalRevenue: '70000.00' });
    await db.insert(yearlyRevenue).values({ year: 2025, totalRevenue: '65000.00' });

    const m = await getMonthlyRevenue('2026-02-01', db);
    expect(m.length).toBe(1);
    expect(m[0].totalRevenue).toBe('5000.00');

    const mr = await listMonthlyRevenueRange('2026-02-01', '2026-03-01', db);
    expect(mr.length).toBe(2);

    const y = await getYearlyRevenue(2026, db);
    expect(y.length).toBe(1);
    expect(y[0].totalRevenue).toBe('70000.00');

    const yr = await listYearlyRevenueRange(2025, 2026, db);
    expect(yr.length).toBe(2);
  });
});
