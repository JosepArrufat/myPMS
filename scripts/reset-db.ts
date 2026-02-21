/**
 * Reset Database Script
 *
 * Truncates all tables in the correct FK-safe order using CASCADE.
 * This preserves the schema (enums, indexes, constraints) but removes all rows.
 *
 * Usage:  npx tsx scripts/reset-db.ts
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import 'dotenv/config'

async function resetDb() {
  const dbUrl = process.env.DB_URL
  if (!dbUrl) throw new Error('DB_URL env var required')

  const conn = postgres(dbUrl)
  const db = drizzle(conn)

  console.log('🗑️  Resetting database (truncating all tables)...\n')

  // Single TRUNCATE … CASCADE wipes everything in one shot,
  // regardless of FK ordering.
  await db.execute(sql`
    TRUNCATE TABLE
      payments,
      invoice_items,
      invoices,
      reservation_daily_rates,
      room_assignments,
      reservation_rooms,
      reservations,
      room_blocks,
      room_type_rates,
      room_type_rate_adjustments,
      room_inventory,
      housekeeping_tasks,
      maintenance_requests,
      rooms,
      room_types,
      rate_plans,
      guests,
      agencies,
      overbooking_policies,
      promotions,
      audit_log,
      role_permissions,
      permissions,
      users,
      daily_revenue,
      monthly_revenue,
      yearly_revenue
    RESTART IDENTITY CASCADE
  `)

  console.log('✅ All tables truncated and identity sequences reset.\n')

  await conn.end()
  process.exit(0)
}

resetDb().catch((err) => {
  console.error('❌ Reset failed:', err)
  process.exit(1)
})
