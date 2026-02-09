import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  AnyPgColumn,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'manager',
  'front_desk',
  'housekeeping',
  'accountant',
  'sales',
  'guest_services'
]);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  role: userRoleEnum('role').notNull().default('front_desk'),
  isActive: boolean('is_active').default(true),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  resource: varchar('resource', { length: 50 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  description: text('description'),
}, (table) => ({
  resourceActionIdx: uniqueIndex('idx_permissions_resource_action').on(table.resource, table.action),
}));

export const rolePermissions = pgTable('role_permissions', {
  role: userRoleEnum('role').notNull(),
  permissionId: serial('permission_id').notNull().references(() => permissions.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.role, table.permissionId] }),
  roleIdx: index('idx_role_permissions_role').on(table.role),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;