import {
  and,
  asc,
  eq,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  permissions,
} from '../schema/users.js';

export const listPermissions = async () =>
  db
    .select()
    .from(permissions)
    .orderBy(asc(permissions.resource), asc(permissions.action));

export const findPermission = async (resource: string, action: string) =>
  db
    .select()
    .from(permissions)
    .where(and(
      eq(permissions.resource, resource),
      eq(permissions.action, action),
    ))
    .limit(1);
