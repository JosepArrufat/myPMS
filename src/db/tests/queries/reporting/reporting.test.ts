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
    // 1. Insert daily revenue rows for two dates
    await db.insert(dailyRevenue).values({ date: '2026-02-01', totalRevenue: '100.00' });
    await db.insert(dailyRevenue).values({ date: '2026-02-02', totalRevenue: '200.00' });

    // 2. Query a single date
    const single = await getDailyRevenue('2026-02-01', db);
    // Exactly 1 row with the correct amount
    expect(single.length).toBe(1);
    expect(single[0].totalRevenue).toBe('100.00');

    // 3. Query the full date range
    const range = await listDailyRevenueRange('2026-02-01', '2026-02-02', db);
    // Both dates returned
    expect(range.length).toBe(2);
  });

  it('lists rate-plan and room-type revenue ranges', async () => {
    // 1. Create a rate plan and a room type
    const rp = await createTestRatePlan(db);
    const rt = await createTestRoomType(db);

    // 2. Insert rate-plan revenue for two dates
    await db.insert(dailyRateRevenue).values({ date: '2026-02-01', ratePlanId: rp.id, roomRevenue: '150.00' });
    await db.insert(dailyRateRevenue).values({ date: '2026-02-02', ratePlanId: rp.id, roomRevenue: '100.00' });

    // 3. Insert room-type revenue for one date
    await db.insert(dailyRoomTypeRevenue).values({ date: '2026-02-01', roomTypeId: rt.id, revenue: '300.00' });

    // 4. Query rate-plan revenue range
    const rpr = await listRatePlanRevenueRange(rp.id, '2026-02-01', '2026-02-02', db);
    // Both dates returned
    expect(rpr.length).toBe(2);

    // 5. Query room-type revenue range
    const rtr = await listRoomTypeRevenueRange(rt.id, '2026-02-01', '2026-02-02', db);
    // Only 1 date has data
    expect(rtr.length).toBe(1);
  });

  it('gets monthly and yearly revenue', async () => {
    // 1. Insert monthly revenue for two months
    await db.insert(monthlyRevenue).values({ month: '2026-02', totalRevenue: '5000.00' });
    await db.insert(monthlyRevenue).values({ month: '2026-03', totalRevenue: '6000.00' });

    // 2. Insert yearly revenue for two years
    await db.insert(yearlyRevenue).values({ year: 2026, totalRevenue: '70000.00' });
    await db.insert(yearlyRevenue).values({ year: 2025, totalRevenue: '65000.00' });

    // 3. Query a single month
    const m = await getMonthlyRevenue('2026-02', db);
    // 1 row, correct amount
    expect(m.length).toBe(1);
    expect(m[0].totalRevenue).toBe('5000.00');

    // 4. Query monthly range
    const mr = await listMonthlyRevenueRange('2026-02', '2026-03', db);
    // Both months returned
    expect(mr.length).toBe(2);

    // 5. Query a single year
    const y = await getYearlyRevenue(2026, db);
    // 1 row, correct amount
    expect(y.length).toBe(1);
    expect(y[0].totalRevenue).toBe('70000.00');

    // 6. Query yearly range
    const yr = await listYearlyRevenueRange(2025, 2026, db);
    // Both years returned
    expect(yr.length).toBe(2);
  });
});
