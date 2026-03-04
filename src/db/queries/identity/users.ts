import {
  and,
  asc,
  eq,
  ilike,
  isNull,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  userRoleEnum,
  users,
} from '../../schema/users.js';

type DbConnection = typeof defaultDb;
type UserRole = (typeof userRoleEnum.enumValues)[number];

export const findUserByEmail = async (email: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

export const listActiveUsersByRole = async (role: UserRole, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(users)
    .where(and(eq(users.role, role), eq(users.isActive, true), isNull(users.deletedAt)))
    .orderBy(asc(users.lastName), asc(users.firstName));

export const searchUsers = async (term: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(users)
    .where(and(ilike(users.email, `%${term}%`), isNull(users.deletedAt)))
    .orderBy(asc(users.email));

export const softDeleteUser = async (userId: number, db: DbConnection = defaultDb) => {
  const [user] = await db
    .update(users)
    .set({ deletedAt: new Date(), isActive: false })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning()
  return user
}

export const restoreUser = async (userId: number, db: DbConnection = defaultDb) => {
  const [user] = await db
    .update(users)
    .set({ deletedAt: null, isActive: true })
    .where(eq(users.id, userId))
    .returning()
  return user
}
