import {
  and,
  desc,
  eq,
  gte,
  ilike,
  sql,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  invoices,
} from '../schema/invoices.js';

export const findInvoiceByNumber = async (invoiceNumber: string) =>
  db
    .select()
    .from(invoices)
    .where(eq(invoices.invoiceNumber, invoiceNumber))
    .limit(1);

export const listGuestInvoices = async (guestId: string, from?: string) =>
  db
    .select()
    .from(invoices)
    .where(from
      ? and(eq(invoices.guestId, guestId), gte(invoices.issueDate, from))
      : eq(invoices.guestId, guestId))
    .orderBy(desc(invoices.issueDate));

export const listOutstandingInvoices = async () =>
  db
    .select()
    .from(invoices)
    .where(sql`${invoices.status} IN ('issued', 'partially_paid', 'overdue') AND ${invoices.balance} > 0`)
    .orderBy(desc(invoices.dueDate));

export const searchInvoices = async (term: string) =>
  db
    .select()
    .from(invoices)
    .where(ilike(invoices.invoiceNumber, `%${term}%`))
    .orderBy(desc(invoices.issueDate));
