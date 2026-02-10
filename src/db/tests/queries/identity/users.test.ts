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
    const u = await createTestUser(db, { email: 'findme@example.com' });

    const res = await findUserByEmail('findme@example.com', db);
    expect(res.length).toBe(1);
    expect(res[0].email).toBe('findme@example.com');
    expect(res[0].id).toBe(u.id);
  });

  it('lists active users by role', async () => {
    await createTestUser(db, { role: 'housekeeping', isActive: true });
    await createTestUser(db, { role: 'housekeeping', isActive: false });
    await createTestUser(db, { role: 'manager', isActive: true });

    const results = await listActiveUsersByRole('housekeeping', db);

    expect(results.length).toBe(1);
    expect(results[0].role).toBe('housekeeping');
    expect(results[0].isActive).toBe(true);
  });

  it('searches users by email term', async () => {
    await createTestUser(db, { email: 'alice@company.test' });
    await createTestUser(db, { email: 'bob@test.com' });

    const results = await searchUsers('company', db);
    expect(results.length).toBe(1);
    expect(results[0].email).toContain('company');
  });
});
