import postgres from 'postgres';
import type { Sql } from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from '../schema/index';

export type TestDb = PostgresJsDatabase<typeof schema> & { $client: Sql };

// Single connection — one query at a time, no deadlocks with singleFork
let testConnection: ReturnType<typeof postgres> | null = null;
let testDb: TestDb | null = null;

export const getTestDb = (): TestDb => {
  if (testDb) return testDb;

  const connectionString =
    process.env.TEST_DATABASE_URL ||
    'postgresql://hotel_user:hotel_pass@localhost:5433/hotel_pms_test';

  testConnection = postgres(connectionString, { max: 1 });
  testDb = drizzle(testConnection, { schema });
  return testDb;
};

// Separate pool (max:2) for race-condition tests; caller must close() in afterAll
export const getConcurrentTestDb = () => {
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    'postgresql://hotel_user:hotel_pass@localhost:5433/hotel_pms_test';

  const pool = postgres(connectionString, { max: 2 });
  const db = drizzle(pool, { schema }) as TestDb;

  return {
    db,
    close: async () => { await pool.end(); },
  };
};

const ALL_TABLES = [
  'audit_log',
  'daily_rate_revenue',
  'daily_room_type_revenue',
  'daily_revenue',
  'monthly_revenue',
  'yearly_revenue',
  'invoice_items',
  'payments',
  'invoices',
  'reservation_daily_rates',
  'reservation_rooms',
  'room_assignments',
  'reservations',
  'room_blocks',
  'housekeeping_tasks',
  'maintenance_requests',
  'overbooking_policies',
  'room_inventory',
  'room_type_rate_adjustments',
  'room_type_rates',
  'rooms',
  'room_types',
  'promotions',
  'rate_plans',
  'guests',
  'agencies',
  'role_permissions',
  'users',
  'permissions',
  'system_config',
] as const;

const TABLE_LIST = ALL_TABLES.map((t) => `"${t}"`).join(', ');

export const cleanupTestDb = async (db: TestDb): Promise<void> => {
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${TABLE_LIST} RESTART IDENTITY CASCADE`),
  );
};

export const verifyDbIsEmpty = async (db: TestDb): Promise<void> => {
  const nonEmpty: string[] = [];

  for (const table of ALL_TABLES) {
    const rows = await db.execute(
      sql.raw(`SELECT COUNT(*)::int AS n FROM "${table}"`),
    );
    const count = (rows[0] as Record<string, unknown>)?.n ?? 0;
    if (Number(count) > 0) nonEmpty.push(`${table} (${count})`);
  }

  if (nonEmpty.length > 0) {
    throw new Error(
      `DB not empty after cleanup – ${nonEmpty.join(', ')}`,
    );
  }
};
