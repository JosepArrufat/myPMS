import type { User, NewUser } from '../../schema/users';
import { users } from '../../schema/users';

type TestDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>;

export const createTestUser = async (
  db: TestDb,
  overrides: Partial<NewUser> = {},
  tx?: any
): Promise<User> => {
  const conn = tx ?? db;
  const timestamp = Date.now();
  
  const [user] = await conn.insert(users).values({
    email: `user${timestamp}@example.com`,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    ...overrides,
  }).returning();
  
  return user;
};
