import {
  and,
  desc,
  eq,
  gte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  payments,
} from '../../schema/invoices.js';

type DbConnection = typeof defaultDb;

export const listPaymentsForInvoice = async (invoiceId: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.paymentDate));

export const listPaymentsSince = async (from: Date, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(payments)
    .where(gte(payments.paymentDate, from))
    .orderBy(desc(payments.paymentDate));

export const listRefunds = async (db: DbConnection = defaultDb) =>
  db
    .select()
    .from(payments)
    .where(eq(payments.isRefund, true))
    .orderBy(desc(payments.paymentDate));
