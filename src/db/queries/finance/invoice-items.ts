import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  invoiceItems,
} from '../../schema/invoices.js';

type DbConnection = typeof defaultDb;

export const listInvoiceItems = async (invoiceId: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.id));

export const listItemsInPeriod = async (from: string, to: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(invoiceItems)
    .where(and(
      gte(invoiceItems.dateOfService, from),
      lte(invoiceItems.dateOfService, to),
    ))
    .orderBy(asc(invoiceItems.dateOfService));
