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
      const inv = await createTestInvoice(db);
      const otherInv = await createTestInvoice(db);

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

      const result = await listPaymentsForInvoice(inv.id, db);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe('75.00');
      expect(result[1].amount).toBe('50.00');
    });

    it('returns empty when invoice has no payments', async () => {
      const inv = await createTestInvoice(db);

      const result = await listPaymentsForInvoice(inv.id, db);
      expect(result).toEqual([]);
    });
  });

  describe('listPaymentsSince', () => {
    it('returns payments made on or after the given date', async () => {
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

      const result = await listPaymentsSince(new Date('2026-03-01'), db);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe('30.00');
      expect(result[1].amount).toBe('20.00');
    });
  });

  describe('listRefunds', () => {
    it('returns only payments marked as refunds', async () => {
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

      const result = await listRefunds(db);

      expect(result).toHaveLength(1);
      expect(result[0].isRefund).toBe(true);
      expect(result[0].amount).toBe('25.00');
    });

    it('returns empty when no refunds exist', async () => {
      const inv = await createTestInvoice(db);
      await createTestPayment(db, { invoiceId: inv.id, isRefund: false });

      const result = await listRefunds(db);
      expect(result).toEqual([]);
    });
  });

  describe('FK constraints', () => {
    it('rejects payment with non-existent invoiceId', async () => {
      const { payments } = await import('../../../../db/schema/invoices');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        db.insert(payments).values({
          invoiceId: fakeId,
          amount: '50.00',
          paymentMethod: 'cash',
        }),
      ).rejects.toThrow();
    });
  });
});
