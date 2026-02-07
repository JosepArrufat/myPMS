import type { Agency, NewAgency } from '../../schema/agencies';
import { agencies } from '../../schema/agencies';

type TestDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>;

export const createTestAgency = async (
  db: TestDb,
  overrides: Partial<NewAgency> = {},
  tx?: any
): Promise<Agency> => {
  const conn = tx ?? db;
  const timestamp = Date.now();
  
  const [agency] = await conn.insert(agencies).values({
    name: `Test Travel Agency ${timestamp}`,
    code: `A${timestamp.toString().slice(-6)}`,
    type: 'agency',
    contactPerson: 'Jane Smith',
    email: `agency.${timestamp}@example.com`,
    phone: '+0987654321',
    addressLine1: '456 Agency Ave',
    stateProvince: 'BA',
    city: 'Agency City',
    country: 'USA',
    postalCode: '54321',
    commissionPercent: '10.00',
    vatNumber: 'B123456789',
    ...overrides,
  }).returning();
  
  return agency;
};
