import {
  and,
  asc,
  eq,
  ilike,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  userRoleEnum,
  users,
} from '../schema/users.js';

type UserRole = (typeof userRoleEnum.enumValues)[number];

export const findUserByEmail = async (email: string) =>
  db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

export const listActiveUsersByRole = async (role: UserRole) =>
  db
    .select()
    .from(users)
    .where(and(eq(users.role, role), eq(users.isActive, true)))
    .orderBy(asc(users.lastName), asc(users.firstName));

export const searchUsers = async (term: string) =>
  db
    .select()
    .from(users)
    .where(ilike(users.email, `%${term}%`))
    .orderBy(asc(users.email));
