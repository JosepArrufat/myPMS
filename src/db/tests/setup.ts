import postgres from 'postgres';
import type { Sql } from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from '../schema/index';

// ─── Types ──────────────────────────────────────────────────────────
export type TestDb = PostgresJsDatabase<typeof schema> & { $client: Sql };

// ─── Singleton connection ───────────────────────────────────────────
// max:1 → one TCP connection to Postgres, one query at a time.
// Combined with Vitest singleFork mode this guarantees that only ONE
// PostgreSQL backend is ever active, making deadlocks impossible.
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

// ─── Concurrent pool (for race-condition tests only) ────────────────
// Returns a SEPARATE drizzle instance backed by a pool with max:2,
// so two transactions can truly run in parallel.  The caller MUST
// call the returned `close()` function in afterAll to release the
// connections and avoid leaked handles.
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

// ─── Table list (leaf tables first, root tables last) ───────────────
// Order doesn't matter for a single TRUNCATE … CASCADE statement, but
// keeping it organised from leaves → roots makes the dependency chain
// easier to read.
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
] as const;

// ─── Cleanup (called in every beforeEach) ───────────────────────────
// One single TRUNCATE statement listing every table.
// • Atomic — Postgres acquires all AccessExclusiveLocks at once,
//   so there is no window for another backend to interleave.
// • RESTART IDENTITY resets every serial / bigserial sequence to 1,
//   so auto-generated IDs are predictable across tests.
// • CASCADE automatically handles child rows via foreign keys.
const TABLE_LIST = ALL_TABLES.map((t) => `"${t}"`).join(', ');

export const cleanupTestDb = async (db: TestDb): Promise<void> => {
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${TABLE_LIST} RESTART IDENTITY CASCADE`),
  );
};

// ─── Verification (called in afterAll as a safety net) ──────────────
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
