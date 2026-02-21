// Quick test: show the real error shape from a duplicate insert
import 'dotenv/config';
import { db } from '../src/db/index.js';
import { rooms } from '../src/db/schema/rooms.js';

async function run() {
  try {
    await db.insert(rooms).values({ roomNumber: '501', roomTypeId: 1, floor: 5, status: 'available' });
  } catch (err: any) {
    console.log('err.constructor.name:', err?.constructor?.name);
    console.log('err.code:', err?.code);
    console.log('err.detail:', err?.detail);
    console.log('err.cause?.constructor.name:', err?.cause?.constructor?.name);
    console.log('err.cause?.code:', err?.cause?.code);
    console.log('err.cause?.detail:', err?.cause?.detail);
    console.log('err.cause?.cause?.code:', err?.cause?.cause?.code);
    console.log('err.cause?.cause?.detail:', err?.cause?.cause?.detail);
    const keys = Object.keys(err ?? {});
    console.log('top-level keys:', keys);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
