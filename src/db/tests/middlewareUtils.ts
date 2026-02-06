import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://hotel_user:hotel_pass@localhost:5433/hotel_pms_test';

let testConnection: ReturnType<typeof postgres> | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

export const setupTestDatabase = async () => {
  if (testDb) return testDb;
  
  testConnection = postgres(TEST_DATABASE_URL, { max: 1 });
  testDb = drizzle(testConnection);
  
  try {
    await migrate(testDb, { migrationsFolder: './drizzle' });
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
  
  return testDb;
};

export const teardownTestDatabase = async () => {
  if (testConnection) {
    await testConnection.end();
    testConnection = null;
    testDb = null;
  }
};

export const cleanDatabase = async (db: ReturnType<typeof drizzle>) => {
  try {
    await db.execute(sql`SET session_replication_role = 'replica'`);
    
    await db.execute(sql`TRUNCATE TABLE invoice_items CASCADE`);
    await db.execute(sql`TRUNCATE TABLE payments CASCADE`);
    await db.execute(sql`TRUNCATE TABLE invoices CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE reservation_daily_rates CASCADE`);
    await db.execute(sql`TRUNCATE TABLE reservation_rooms CASCADE`);
    await db.execute(sql`TRUNCATE TABLE reservations CASCADE`);
    await db.execute(sql`TRUNCATE TABLE room_blocks CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE housekeeping_tasks CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE maintenance_requests CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE room_inventory CASCADE`);
    await db.execute(sql`TRUNCATE TABLE room_type_rate_adjustments CASCADE`);
    await db.execute(sql`TRUNCATE TABLE room_type_rates CASCADE`);
    await db.execute(sql`TRUNCATE TABLE rooms CASCADE`);
    await db.execute(sql`TRUNCATE TABLE room_types CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE promotion_room_types CASCADE`);
    await db.execute(sql`TRUNCATE TABLE promotions CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE rate_plans CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE guests CASCADE`);
    await db.execute(sql`TRUNCATE TABLE agencies CASCADE`);
    await db.execute(sql`TRUNCATE TABLE companies CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE role_permissions CASCADE`);
    await db.execute(sql`TRUNCATE TABLE user_roles CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
    await db.execute(sql`TRUNCATE TABLE roles CASCADE`);
    await db.execute(sql`TRUNCATE TABLE permissions CASCADE`);
    
    await db.execute(sql`TRUNCATE TABLE audit_logs CASCADE`);
    
    await db.execute(sql`SET session_replication_role = 'origin'`);
  } catch (error) {
    await db.execute(sql`SET session_replication_role = 'origin'`);
    throw error;
  }
};

export const getTestDb = () => {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
};

export const resetSequences = async (db: ReturnType<typeof drizzle>) => {
  const tables = [
    'guests',
    'agencies',
    'companies',
    'room_types',
    'rooms',
    'rate_plans',
    'reservations',
    'reservation_rooms',
    'invoices',
    'users',
    'roles',
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