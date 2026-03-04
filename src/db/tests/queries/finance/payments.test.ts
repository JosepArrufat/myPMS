import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest';

import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../../setup';

import {
  createTestInvoice,
  createTestPayment,
} from '../../factories';

import {
  listPaymentsForInvoice,
  listPaymentsSince,
  listRefunds,
} from '../../../../db/queries/finance/payments';

describe('Finance - payments', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('listPaymentsForInvoice', () => {
    it('lists payments for the given invoice, newest first', async () => {
      // 1. Create two invoices
      const inv = await createTestInvoice(db);
      const otherInv = await createTestInvoice(db);

      // 2. Add two payments to the first invoice, one to the second
      await createTestPayment(db, {
        invoiceId: inv.id,
        amount: '50.00',
        paymentDate: new Date('2026-03-01'),
      });
      await createTestPayment(db, {
        invoiceId: inv.id,
        amount: '75.00',
        paymentDate: new Date('2026-03-05'),
      });
      await createTestPayment(db, {
        invoiceId: otherInv.id,
        amount: '100.00',
      });

      // 3. List payments for the first invoice
      const result = await listPaymentsForInvoice(inv.id, db);

      // Two payments returned, newest first
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe('75.00');
      expect(result[1].amount).toBe('50.00');
    });

    it('returns empty when invoice has no payments', async () => {
      // 1. Create an invoice with no payments
      const inv = await createTestInvoice(db);

      // 2. List payments for that invoice
      const result = await listPaymentsForInvoice(inv.id, db);
      // No payments recorded
      expect(result).toEqual([]);
    });
  });

  describe('listPaymentsSince', () => {
    it('returns payments made on or after the given date', async () => {
      // 1. Create an invoice and three payments across different months
      const inv = await createTestInvoice(db);

      await createTestPayment(db, {
        invoiceId: inv.id,
        paymentDate: new Date('2026-02-01'),
        amount: '10.00',
      });
      await createTestPayment(db, {
        invoiceId: inv.id,
        paymentDate: new Date('2026-03-15'),
        amount: '20.00',
      });
      await createTestPayment(db, {
        invoiceId: inv.id,
        paymentDate: new Date('2026-04-01'),
        amount: '30.00',
      });

      // 2. Query payments since March 1
      const result = await listPaymentsSince(new Date('2026-03-01'), db);

      // Only the March and April payments qualify
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe('30.00');
      expect(result[1].amount).toBe('20.00');
    });
  });

  describe('listRefunds', () => {
    it('returns only payments marked as refunds', async () => {
      // 1. Create one normal payment and one refund
      const inv = await createTestInvoice(db);

      await createTestPayment(db, {
        invoiceId: inv.id,
        isRefund: false,
        amount: '100.00',
      });
      await createTestPayment(db, {
        invoiceId: inv.id,
        isRefund: true,
        amount: '25.00',
      });

      // 2. List refunds only
      const result = await listRefunds(db);

      // Only the refund payment returned
      expect(result).toHaveLength(1);
      expect(result[0].isRefund).toBe(true);
      expect(result[0].amount).toBe('25.00');
    });

    it('returns empty when no refunds exist', async () => {
      // 1. Create only a non-refund payment
      const inv = await createTestInvoice(db);
      await createTestPayment(db, { invoiceId: inv.id, isRefund: false });

      // 2. List refunds
      const result = await listRefunds(db);
      // None exist
      expect(result).toEqual([]);
    });
  });

  describe('FK constraints', () => {
    it('rejects payment with non-existent invoiceId', async () => {
      const { payments } = await import('../../../../db/schema/invoices');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      // 1. Attempt to insert a payment with an invalid FK
      await expect(
        db.insert(payments).values({
          invoiceId: fakeId,
          amount: '50.00',
          paymentMethod: 'cash',
        }),
      // DB should reject the FK violation
      ).rejects.toThrow();
    });
  });
});
