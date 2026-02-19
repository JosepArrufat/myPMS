import type {
  OverbookingPolicy,
  NewOverbookingPolicy,
} from '../../schema/overbooking';
import { overbookingPolicies } from '../../schema/overbooking';
import type { TestDb } from '../setup';

export const createTestOverbookingPolicy = async (
  db: TestDb,
  overrides: Partial<NewOverbookingPolicy> = {},
  tx?: any,
): Promise<OverbookingPolicy> => {
  const conn = tx ?? db;

  const [policy] = await conn.insert(overbookingPolicies).values({
    roomTypeId: overrides.roomTypeId ?? null, // null = hotel-wide
    startDate: overrides.startDate ?? '2026-01-01',
    endDate: overrides.endDate ?? '2026-12-31',
    overbookingPercent: overrides.overbookingPercent ?? 110,
    ...overrides,
  }).returning();

  return policy;
};
