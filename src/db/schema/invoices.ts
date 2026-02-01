import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  decimal,
  date,
  timestamp,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { reservations } from './reservations';
import { guests } from './guests';
import { rooms } from './rooms';
import { users } from './users';
import { sql } from 'drizzle-orm';

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'issued',
  'paid',
  'partially_paid',
  'overdue',
  'void',
  'refunded'
]);

export const invoiceTypeEnum = pgEnum('invoice_type', [
  'final',
  'deposit',
  'adjustment',
  'cancellation'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'credit_card',
  'debit_card',
  'bank_transfer',
  'cheque',
  'online_payment',
  'corporate_account'
]);

export const invoiceItemTypeEnum = pgEnum('invoice_item_type', [
  'room',
  'food',
  'beverage',
  'minibar',
  'laundry',
  'spa',
  'parking',
  'telephone',
  'internet',
  'other'
]);

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),

  invoiceType: invoiceTypeEnum('invoice_type').notNull().default('final'),
  
  reservationId: uuid('reservation_id').references(() => reservations.id),
  guestId: uuid('guest_id').notNull().references(() => guests.id),
  
  issueDate: date('issue_date').notNull().defaultNow(),
  dueDate: date('due_date'),
  
  status: invoiceStatusEnum('status').notNull().default('draft'),
  
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  balance: decimal('balance', { precision: 10, scale: 2 }).notNull().default('0'), // Can be negative for credits
  
  currency: varchar('currency', { length: 3 }).default('USD'),
  
  taxRate: decimal('tax_rate', { precision: 5, scale: 4 }),
  taxNumber: varchar('tax_number', { length: 50 }),
  
  notes: text('notes'),
  internalNotes: text('internal_notes'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
  createdBy: integer('created_by').references(() => users.id),
});

export const invoicesNumberIdx = uniqueIndex('idx_invoices_number').on(invoices.invoiceNumber);
export const invoicesGuestIdx = index('idx_invoices_guest').on(invoices.guestId);
export const invoicesReservationIdx = index('idx_invoices_reservation').on(invoices.reservationId);
export const invoicesIssueDateIdx = index('idx_invoices_issue_date').on(invoices.issueDate);
export const invoicesUnpaidIdx = index('idx_invoices_unpaid')
  .on(invoices.status, invoices.dueDate)
  .where(sql`${invoices.status} IN ('issued', 'partially_paid', 'overdue')`);
export const invoicesOverdueIdx = index('idx_invoices_overdue')
  .on(invoices.dueDate)
  .where(sql`${invoices.status} = 'overdue'`);

export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  
  itemType: invoiceItemTypeEnum('item_type').notNull(),
  description: text('description').notNull(),
  dateOfService: date('date_of_service'),
  
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  
  taxRate: decimal('tax_rate', { precision: 5, scale: 4 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
  
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  
  roomId: integer('room_id').references(() => rooms.id),
  
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
});

export const invoiceItemsInvoiceIdx = index('idx_invoice_items_invoice').on(invoiceItems.invoiceId);
export const invoiceItemsDateIdx = index('idx_invoice_items_date').on(invoiceItems.dateOfService);

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
  
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentDate: timestamp('payment_date').notNull().defaultNow(),
  
  transactionReference: varchar('transaction_reference', { length: 255 }),
  cardType: varchar('card_type', { length: 50 }),
  authorizationCode: varchar('authorization_code', { length: 50 }),
  
  currency: varchar('currency', { length: 3 }).default('USD'),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 6 }).default('1'),
  
  isRefund: boolean('is_refund').default(false),
  refundedPaymentId: integer('refunded_payment_id').references((): AnyPgColumn => payments.id),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
});

export const paymentsInvoiceIdx = index('idx_payments_invoice').on(payments.invoiceId);
export const paymentsDateIdx = index('idx_payments_date').on(payments.paymentDate);
export const paymentsMethodIdx = index('idx_payments_method').on(payments.paymentMethod);
export const paymentsRefundIdx = index('idx_payments_refund').on(payments.isRefund).where(sql`${payments.isRefund} = true`);

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;