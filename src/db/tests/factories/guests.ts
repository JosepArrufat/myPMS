import type { Guest, NewGuest } from '../../schema/guests';
import { guests } from '../../schema/guests';
import { users } from '../../schema/users';
import { createTestUser } from './users';

type TestDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>;

export const createTestGuest = async (
  db: TestDb,
  overrides: Partial<NewGuest> = {},
  tx?: any
): Promise<Guest> => {
  const conn = tx ?? db;
  const timestamp = Date.now();
  
  // ensure createdBy points to an existing user (avoid FK violations)
  let createdBy = (overrides as any).createdBy;
  if (!createdBy) {
    const [existingUser] = await conn.select().from(users).limit(1);
    if (existingUser) {
      createdBy = existingUser.id;
    } else {
      const newUser = await createTestUser(db);
      createdBy = newUser.id;
    }
  }

  const [guest] = await conn.insert(guests).values({
    firstName: 'John',
    lastName: 'Doe',
    email: `john.doe.${timestamp}@example.com`,
    phone: '+1234567890',
    dateOfBirth: '1990-01-15',
    nationality: 'US',
    idNumber: 'AB123456',
    address: '123 Test St',
    city: 'Test City',
    state: 'TS',
    country: 'USA',
    postalCode: '12345',
    createdBy,
    ...overrides,
  }).returning();
  
  return guest;
};
