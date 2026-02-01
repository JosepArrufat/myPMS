import {
  and,
  asc,
  eq,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  rolePermissions,
  userRoleEnum,
} from '../schema/users.js';

type UserRole = (typeof userRoleEnum.enumValues)[number];

export const listPermissionsForRole = async (role: UserRole) =>
  db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role))
    .orderBy(asc(rolePermissions.permissionId));

export const listRolesForPermission = async (permissionId: number) =>
  db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.permissionId, permissionId))
    .orderBy(asc(rolePermissions.role));
