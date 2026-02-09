import {
  and,
  asc,
  eq,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  permissions,
} from '../../schema/users.js';

type DbConnection = typeof defaultDb;

export const listPermissions = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(permissions)
    .orderBy(asc(permissions.resource), asc(permissions.action));

export const findPermission = async (resource: string, action: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(permissions)
    .where(and(
      eq(permissions.resource, resource),
      eq(permissions.action, action),
    ))
    .limit(1);
