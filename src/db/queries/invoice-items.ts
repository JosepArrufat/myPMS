import {
  and,
  asc,
  eq,
  gte,
  lte,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  invoiceItems,
} from '../schema/invoices.js';

export const listInvoiceItems = async (invoiceId: string) =>
  db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.id));

export const listItemsInPeriod = async (from: string, to: string) =>
  db
    .select()
    .from(invoiceItems)
    .where(and(
      gte(invoiceItems.dateOfService, from),
      lte(invoiceItems.dateOfService, to),
    ))
    .orderBy(asc(invoiceItems.dateOfService));
