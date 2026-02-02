import {
  and,
  desc,
  eq,
  gte,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  payments,
} from '../../schema/invoices.js';

export const listPaymentsForInvoice = async (invoiceId: string) =>
  db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.paymentDate));

export const listPaymentsSince = async (from: Date) =>
  db
    .select()
    .from(payments)
    .where(gte(payments.paymentDate, from))
    .orderBy(desc(payments.paymentDate));

export const listRefunds = async () =>
  db
    .select()
    .from(payments)
    .where(eq(payments.isRefund, true))
    .orderBy(desc(payments.paymentDate));
