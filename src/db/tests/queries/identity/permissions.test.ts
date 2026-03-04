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
import { eq } from 'drizzle-orm';

import { permissions, rolePermissions } from '../../../../db/schema/users';
import {
  listPermissions,
  findPermission,
} from '../../../../db/queries/identity/permissions';

describe('Identity - permissions', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  it('lists and finds permissions', async () => {
    // 1. Seed two permissions
    await db.insert(permissions).values({ resource: 'rooms', action: 'view' });
    await db.insert(permissions).values({ resource: 'reservations', action: 'edit' });

    // 2. List all permissions
    const all = await listPermissions(db);
    // At least the two we just created
    expect(all.length).toBeGreaterThanOrEqual(2);

    // 3. Find a specific permission by resource + action
    const found = await findPermission('rooms', 'view', db);
    // Exactly one match with correct resource
    expect(found.length).toBe(1);
    expect(found[0].resource).toBe('rooms');
  });

  it('role-permissions relations can be queried', async () => {
    // 1. Create a permission and capture its id
    const [p] = await db
      .insert(permissions)
      .values({ resource: 'housekeeping', action: 'assign' })
      .returning();

    // 2. Link the permission to the housekeeping role
    await db.insert(rolePermissions).values({ role: 'housekeeping', permissionId: p.id });

    // 3. Query role-permissions for housekeeping
    const roleList = await db.select().from(rolePermissions).where(eq(rolePermissions.role,'housekeeping'));
    // Should have exactly one mapping
    expect(roleList.length).toBe(1);
  });
});
