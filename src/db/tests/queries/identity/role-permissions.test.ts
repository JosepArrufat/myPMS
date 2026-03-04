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

import { permissions, rolePermissions } from '../../../../db/schema/users';
import {
  listPermissionsForRole,
  listRolesForPermission,
} from '../../../../db/queries/identity/role-permissions';

describe('Identity - role-permissions', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  it('lists permissions for a role and roles for a permission', async () => {
    // 1. Create a permission
    const [p] = await db.insert(permissions).values({ resource: 'rooms', action: 'view' }).returning();

    // 2. Assign the same permission to two different roles
    await db.insert(rolePermissions).values({ role: 'manager', permissionId: p.id });
    await db.insert(rolePermissions).values({ role: 'front_desk', permissionId: p.id });

    // 3. List permissions for the manager role
    const perms = await listPermissionsForRole('manager', db);
    // Manager has exactly one permission
    expect(perms.length).toBe(1);

    // 4. List roles that hold this permission
    const roles = await listRolesForPermission(p.id, db);
    // At least manager + front_desk
    expect(roles.length).toBeGreaterThanOrEqual(2);
  });
});
