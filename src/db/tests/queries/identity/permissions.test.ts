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
    await db.insert(permissions).values({ resource: 'rooms', action: 'view' });
    await db.insert(permissions).values({ resource: 'reservations', action: 'edit' });

    const all = await listPermissions(db);
    expect(all.length).toBeGreaterThanOrEqual(2);

    const found = await findPermission('rooms', 'view', db);
    expect(found.length).toBe(1);
    expect(found[0].resource).toBe('rooms');
  });

  it('role-permissions relations can be queried', async () => {
    const [p] = await db
      .insert(permissions)
      .values({ resource: 'housekeeping', action: 'assign' })
      .returning();

    await db.insert(rolePermissions).values({ role: 'housekeeping', permissionId: p.id });

    const roleList = await db.select().from(rolePermissions).where(eq(rolePermissions.role,'housekeeping'));
    expect(roleList.length).toBe(1);
  });
});
