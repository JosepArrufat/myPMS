import type { RatePlan, NewRatePlan } from '../../schema/rates';
import { ratePlans } from '../../schema/rates';

type TestDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>;

export const createTestRatePlan = async (
  db: TestDb,
  overrides: Partial<NewRatePlan> = {},
  tx?: any
): Promise<RatePlan> => {
  const conn = tx ?? db;
  const timestamp = Date.now();
  
  const [ratePlan] = await conn.insert(ratePlans).values({
    name: `Standard Rate ${timestamp}`,
    code: `STD${timestamp.toString().slice(-6)}`,
    description: 'Standard room rate',
    requiresAdvanceBookingDays: 3,
    maxLengthOfStay: 7,
    cancellationPolicy: '72h before check-in',
    cancellationDeadlineHours: 72,
    cancellationFeePercent: '100.00',
    validFrom: '2026-02-10',
    validTo: '2026-05-10',
    ...overrides,
  }).returning();
  
  return ratePlan;
};
