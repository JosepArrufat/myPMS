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
  createTestUser,
} from '../../factories';

import {
  findUserByEmail,
  listActiveUsersByRole,
  searchUsers,
} from '../../../../db/queries/identity/users';

describe('Identity - users', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  it('finds user by email', async () => {
    // 1. Create a user with a known email
    const u = await createTestUser(db, { email: 'findme@example.com' });

    // 2. Look up the user by that email
    const res = await findUserByEmail('findme@example.com', db);
    // Should return exactly one match
    expect(res.length).toBe(1);
    // Email and id must match the created user
    expect(res[0].email).toBe('findme@example.com');
    expect(res[0].id).toBe(u.id);
  });

  it('lists active users by role', async () => {
    // 1. Create three users: two housekeeping (one active, one inactive), one manager
    await createTestUser(db, { role: 'housekeeping', isActive: true });
    await createTestUser(db, { role: 'housekeeping', isActive: false });
    await createTestUser(db, { role: 'manager', isActive: true });

    // 2. Query active users filtered to housekeeping role
    const results = await listActiveUsersByRole('housekeeping', db);

    // Only the active housekeeping user should appear
    expect(results.length).toBe(1);
    expect(results[0].role).toBe('housekeeping');
    expect(results[0].isActive).toBe(true);
  });

  it('searches users by email term', async () => {
    // 1. Create two users with different email domains
    await createTestUser(db, { email: 'alice@company.test' });
    await createTestUser(db, { email: 'bob@test.com' });

    // 2. Search by partial email term "company"
    const results = await searchUsers('company', db);
    // Only alice's email contains "company"
    expect(results.length).toBe(1);
    expect(results[0].email).toContain('company');
  });
});
