import type { Guest, NewGuest } from '../../schema/guests';
import { guests } from '../../schema/guests';
import type { TestDb } from '../setup';

export const createTestGuest = async (
  db: TestDb,
  overrides: Partial<NewGuest> = {},
  tx?: any
): Promise<Guest> => {
  const conn = tx ?? db;
  const timestamp = Date.now();

  const [guest] = await conn.insert(guests).values({
    firstName: 'John',
    lastName: 'Doe',
    email: `john.doe.${timestamp}@example.com`,
    phone: '+1234567890',
    dateOfBirth: '1990-01-15',
    nationality: 'US',
    idDocumentNumber: 'AB123456',
    addressLine1: '123 Test St',
    city: 'Test City',
    stateProvince: 'TS',
    country: 'USA',
    postalCode: '12345',
    ...overrides,
  }).returning();
  
  return guest;
};
