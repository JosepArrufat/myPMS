import { pgTable, serial, varchar, text, boolean, timestamp, pgEnum, index, uniqueIndex, primaryKey, } from 'drizzle-orm/pg-core';
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
    createdBy: serial('created_by').references(() => users.id),
});
export const usersEmailIdx = uniqueIndex('idx_users_email').on(users.email);
export const usersRoleIdx = index('idx_users_role').on(users.role).where(sql `${users.isActive} = true`);
export const usersActiveIdx = index('idx_users_active').on(users.isActive);
export const permissions = pgTable('permissions', {
    id: serial('id').primaryKey(),
    resource: varchar('resource', { length: 50 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    description: text('description'),
});
export const permissionsResourceActionIdx = uniqueIndex('idx_permissions_resource_action').on(permissions.resource, permissions.action);
export const rolePermissions = pgTable('role_permissions', {
    role: userRoleEnum('role').notNull(),
    permissionId: serial('permission_id').notNull().references(() => permissions.id),
});
export const rolePermissionsPk = primaryKey({ columns: [rolePermissions.role, rolePermissions.permissionId] });
export const rolePermissionsRoleIdx = index('idx_role_permissions_role').on(rolePermissions.role);
