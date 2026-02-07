import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from '../schema/index';

type TestDb = ReturnType<typeof drizzle>;

let testConnection: ReturnType<typeof postgres> | null = null;
let testDb: TestDb | null = null;

export const getTestDb = (): TestDb => {
  if (testDb) return testDb;

  const connectionString = process.env.TEST_DATABASE_URL ||
    'postgresql://hotel_user:hotel_pass@localhost:5433/hotel_pms_test';

  if (!testConnection) {
    testConnection = postgres(connectionString);
  }

  testDb = drizzle(testConnection, { schema });
  return testDb;
};


export const cleanupTestDb = async (db: TestDb): Promise<void> => {
  try {
    await db.execute(sql`SET session_replication_role = 'replica'`);
    
    await db.execute(sql`TRUNCATE TABLE invoice_items CASCADE`);
    await db.execute(sql`TRUNCATE TABLE payments CASCADE`);
    await db.execute(sql`TRUNCATE TABLE invoices CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE reservation_daily_rates CASCADE`);
    await db.execute(sql`TRUNCATE TABLE reservation_rooms CASCADE`);
    await db.execute(sql`TRUNCATE TABLE room_assignments CASCADE`);
    await db.execute(sql`TRUNCATE TABLE reservations CASCADE`);
    await db.execute(sql`TRUNCATE TABLE room_blocks CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE housekeeping_tasks CASCADE`);
    await db.execute(sql`TRUNCATE TABLE maintenance_requests CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE room_inventory CASCADE`);
    await db.execute(sql`TRUNCATE TABLE room_type_rate_adjustments CASCADE`);
    await db.execute(sql`TRUNCATE TABLE room_type_rates CASCADE`);
    await db.execute(sql`TRUNCATE TABLE rooms CASCADE`);
    await db.execute(sql`TRUNCATE TABLE room_types CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE promotions CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE rate_plans CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE guests CASCADE`);
    await db.execute(sql`TRUNCATE TABLE agencies CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE role_permissions CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
    await db.execute(sql`TRUNCATE TABLE permissions CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE daily_rate_revenue CASCADE`);
    await db.execute(sql`TRUNCATE TABLE daily_room_type_revenue CASCADE`);
    await db.execute(sql`TRUNCATE TABLE daily_revenue CASCADE`);
    await db.execute(sql`TRUNCATE TABLE monthly_revenue CASCADE`);
    await db.execute(sql`TRUNCATE TABLE yearly_revenue CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE audit_log CASCADE`);
    
    await db.execute(sql`SET session_replication_role = 'origin'`);
  } catch (error) {
        await db.execute(sql`SET session_replication_role = 'origin'`);
        throw error;
  }
};

export const verifyDbIsEmpty = async (db: TestDb): Promise<void> => {
  const tables = [
    'invoice_items', 'payments', 'invoices',
    'reservation_daily_rates', 'reservation_rooms', 'room_assignments', 'reservations', 'room_blocks',
    'housekeeping_tasks', 'maintenance_requests',
    'room_inventory', 'room_type_rate_adjustments', 'room_type_rates', 'rooms', 'room_types',
    'promotions', 'rate_plans',
    'guests', 'agencies',
    'role_permissions', 'users', 'permissions',
    'daily_rate_revenue', 'daily_room_type_revenue', 'daily_revenue', 'monthly_revenue', 'yearly_revenue',
    'audit_log'
  ];
  
  const nonEmptyTables: string[] = [];
  
  for (const table of tables) {
    try {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
      const count = (result[0] as Record<string, unknown> | undefined)?.count;
      if (count && parseInt(count as string) > 0) {
        nonEmptyTables.push(`${table} (${count} rows)`);
      }
    } catch (error) {
      // Table might not exist, skip
    }
  }
  
  if (nonEmptyTables.length > 0) {
    throw new Error(`Database cleanup incomplete. Non-empty tables: ${nonEmptyTables.join(', ')}`);
  }
};

export const resetSequences = async (db: TestDb): Promise<void> => {
  const tables = [
    'guests',
    'agencies',
    'room_types',
    'rooms',
    'rate_plans',
    'reservations',
    'reservation_rooms',
    'invoices',
    'users',
    'permissions',
  ];
  for (const table of tables) {
    try {
      await db.execute(sql.raw(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1`));
    } catch (error) {
      // Ignore if sequence doesn't exist
    }
  }
};
