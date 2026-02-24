import { eq } from 'drizzle-orm'

import { db as defaultDb } from './index.js'
import { systemConfig } from './schema/system.js'
import { invoices } from './schema/invoices.js'
import type { TxOrDb } from './utils.js'

const BUSINESS_DATE_KEY = 'business_date'

export const getBusinessDateTx = async (db: TxOrDb = defaultDb): Promise<string> => {
  const [row] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, BUSINESS_DATE_KEY))
    .limit(1)

  if (row) return row.value

  // Fallback: insert today
  const today = new Date().toISOString().slice(0, 10)
  await (defaultDb as any)
    .insert(systemConfig)
    .values({ key: BUSINESS_DATE_KEY, value: today })
    .onConflictDoNothing()
  return today
}

export const assertNotPastDate = async (
  targetDate: string,
  db: TxOrDb = defaultDb,
  label: string = 'Date',
): Promise<string> => {
  const businessDate = await getBusinessDateTx(db)
  if (targetDate < businessDate) {
    throw new Error(
      `${label} (${targetDate}) cannot be before the current business date (${businessDate})`,
    )
  }
  return businessDate
}

export const assertInvoiceModifiable = async (
  invoiceId: string,
  db: TxOrDb = defaultDb,
): Promise<void> => {
  const [inv] = await db
    .select({ issueDate: invoices.issueDate, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (!inv) throw new Error('invoice not found')

  const businessDate = await getBusinessDateTx(db)
  if (inv.issueDate < businessDate) {
    throw new Error(
      `Cannot modify a past invoice (issued ${inv.issueDate}, business date ${businessDate}). Only invoice number changes and refunds are allowed.`,
    )
  }
}

export const assertCheckInDate = async (
  reservationCheckInDate: string,
  db: TxOrDb = defaultDb,
): Promise<void> => {
  const businessDate = await getBusinessDateTx(db)
  if (reservationCheckInDate !== businessDate) {
    throw new Error(
      `Check-in is only allowed on the reservation's check-in date. ` +
      `Reservation check-in: ${reservationCheckInDate}, business date: ${businessDate}`,
    )
  }
}

const OPERATIONAL_ROLES = new Set([
  'housekeeping',
  'maintenance',
  'admin',
  'manager',
])

export const assertOperationalRole = (
  role: string,
  department: 'housekeeping' | 'maintenance',
): void => {
  if (!OPERATIONAL_ROLES.has(role)) {
    throw new Error(
      `User with role '${role}' cannot be assigned to ${department} tasks`,
    )
  }
  // department-specific: housekeeping users can't do maintenance and vice-versa
  if (role === 'housekeeping' && department === 'maintenance') {
    throw new Error(
      `User with role 'housekeeping' cannot be assigned to maintenance tasks`,
    )
  }
  if (role === 'maintenance' && department === 'housekeeping') {
    throw new Error(
      `User with role 'maintenance' cannot be assigned to housekeeping tasks`,
    )
  }
}
