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
  createTestInvoiceItem,
} from '../../factories';

import {
  listInvoiceItems,
  listItemsInPeriod,
} from '../../../../db/queries/finance/invoice-items';

describe('Finance - invoice items', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('listInvoiceItems', () => {
    it('lists items belonging to the given invoice', async () => {
      // 1. Create two invoices
      const inv = await createTestInvoice(db);
      const otherInv = await createTestInvoice(db);

      // 2. Add two items to the first invoice, one to the second
      await createTestInvoiceItem(db, {
        invoiceId: inv.id,
        description: 'Room A',
      });
      await createTestInvoiceItem(db, {
        invoiceId: inv.id,
        description: 'Minibar',
      });
      await createTestInvoiceItem(db, {
        invoiceId: otherInv.id,
        description: 'Other',
      });

      // 3. List items for the first invoice
      const result = await listInvoiceItems(inv.id, db);

      // Only the two items belonging to inv returned
      expect(result).toHaveLength(2);
      expect(result.every((i) => i.invoiceId === inv.id)).toBe(true);
    });

    it('returns empty when invoice has no items', async () => {
      // 1. Create an invoice with no items
      const inv = await createTestInvoice(db);

      // 2. List items for that invoice
      const result = await listInvoiceItems(inv.id, db);
      // No items exist
      expect(result).toEqual([]);
    });
  });

  describe('listItemsInPeriod', () => {
    it('returns items with dateOfService within the range', async () => {
      // 1. Create an invoice and three items spanning different months
      const inv = await createTestInvoice(db);

      await createTestInvoiceItem(db, {
        invoiceId: inv.id,
        dateOfService: '2026-03-01',
        description: 'March item',
      });
      await createTestInvoiceItem(db, {
        invoiceId: inv.id,
        dateOfService: '2026-04-15',
        description: 'April item',
      });
      await createTestInvoiceItem(db, {
        invoiceId: inv.id,
        dateOfService: '2026-06-01',
        description: 'June item',
      });

      // 2. Query items in the March–April window
      const result = await listItemsInPeriod(
        '2026-03-01',
        '2026-04-30',
        db,
      );

      // Only March and April items fall within the range
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.description)).toContain('March item');
      expect(result.map((i) => i.description)).toContain('April item');
    });

    it('returns empty when no items in the range', async () => {
      // 1. Query a date range with no seeded items
      const result = await listItemsInPeriod(
        '2026-01-01',
        '2026-01-31',
        db,
      );
      // No items in January
      expect(result).toEqual([]);
    });
  });

  describe('FK constraints', () => {
    it('rejects item with non-existent invoiceId', async () => {
      const { invoiceItems } = await import('../../../../db/schema/invoices');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      // 1. Attempt to insert an item with an invalid FK
      await expect(
        db.insert(invoiceItems).values({
          invoiceId: fakeId,
          itemType: 'room',
          description: 'Orphan item',
          unitPrice: '50.00',
          total: '50.00',
        }),
      // DB should reject the FK violation
      ).rejects.toThrow();
    });
  });
});
