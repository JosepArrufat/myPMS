import type { 
  Invoice, 
  NewInvoice,
  InvoiceItem,
  NewInvoiceItem,
  Payment,
  NewPayment
} from '../../schema/invoices';
import { 
  invoices, 
  invoiceItems,
  payments 
} from '../../schema/invoices';
import type { TestDb } from '../setup';

export const createTestInvoice = async (
  db: TestDb,
  overrides: Partial<NewInvoice> = {},
  tx?: any
): Promise<Invoice> => {
  const conn = tx ?? db;
  const timestamp = Date.now();
  
  let guestId = overrides.guestId;
  if (!guestId) {
    const { createTestGuest } = await import('./guests');
    const guest = await createTestGuest(db, {}, tx);
    guestId = guest.id;
  }
  
  const [invoice] = await conn.insert(invoices).values({
    invoiceNumber: `INV${timestamp}`,
    guestId,
    issueDate: '2026-02-10',
    status: 'draft',
    subtotal: '0',
    taxAmount: '0',
    totalAmount: '0',
    paidAmount: '0',
    balance: '0',
    ...overrides,
  }).returning();
  
  return invoice;
};

export const createTestInvoiceItem = async (
  db: TestDb,
  overrides: Partial<NewInvoiceItem> = {},
  tx?: any
): Promise<InvoiceItem> => {
  const conn = tx ?? db;
  
  let invoiceId = overrides.invoiceId;
  if (!invoiceId) {
    const invoice = await createTestInvoice(db, {}, tx);
    invoiceId = invoice.id;
  }
  
  const [item] = await conn.insert(invoiceItems).values({
    invoiceId,
    itemType: 'room',
    description: 'Room charge',
    quantity: '1',
    unitPrice: '100.00',
    total: '100.00',
    ...overrides,
  }).returning();
  
  return item;
};

export const createTestPayment = async (
  db: TestDb,
  overrides: Partial<NewPayment> = {},
  tx?: any
): Promise<Payment> => {
  const conn = tx ?? db;
  
  let invoiceId = overrides.invoiceId;
  if (!invoiceId) {
    const invoice = await createTestInvoice(db, {}, tx);
    invoiceId = invoice.id;
  }
  
  const [payment] = await conn.insert(payments).values({
    invoiceId,
    amount: '100.00',
    paymentMethod: 'cash',
    ...overrides,
  }).returning();
  
  return payment;
};
