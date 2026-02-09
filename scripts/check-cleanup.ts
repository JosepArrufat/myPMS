import { getTestDb, cleanupTestDb, verifyDbIsEmpty } from '../src/db/tests/setup';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getTestDb();
  await cleanupTestDb(db);
  const rows = await db.execute(sql`SELECT id FROM users`);
  console.log('user rows after cleanup:', rows);
  await verifyDbIsEmpty(db);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
