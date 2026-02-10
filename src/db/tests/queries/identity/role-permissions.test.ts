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
    const [p] = await db.insert(permissions).values({ resource: 'rooms', action: 'view' }).returning();

    await db.insert(rolePermissions).values({ role: 'manager', permissionId: p.id });
    await db.insert(rolePermissions).values({ role: 'front_desk', permissionId: p.id });

    const perms = await listPermissionsForRole('manager', db);
    expect(perms.length).toBe(1);

    const roles = await listRolesForPermission(p.id, db);
    expect(roles.length).toBeGreaterThanOrEqual(2);
  });
});
