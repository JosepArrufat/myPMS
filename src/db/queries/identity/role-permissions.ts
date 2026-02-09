import {
  and,
  asc,
  eq,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  rolePermissions,
  userRoleEnum,
} from '../../schema/users.js';

type DbConnection = typeof defaultDb;
type UserRole = (typeof userRoleEnum.enumValues)[number];

export const listPermissionsForRole = async (role: UserRole, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role))
    .orderBy(asc(rolePermissions.permissionId));

export const listRolesForPermission = async (permissionId: number, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.permissionId, permissionId))
    .orderBy(asc(rolePermissions.role));
