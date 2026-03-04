import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from 'vitest';
import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../../setup';
import {
  createTestUser,
  createTestGuest,
  createTestInvoice,
} from '../../factories';
import {
  findInvoiceByNumber,
  listGuestInvoices,
  listOutstandingInvoices,
  searchInvoices,
  listOverdueInvoices,
} from '../../../queries/finance/invoices';
import type { BaseUser, BaseGuest } from '../../utils';

describe('Invoice Queries', () => {
  const db = getTestDb();
  let baseUser: BaseUser;
  let baseGuest: BaseGuest;

  beforeAll(() => {
    // DB client ready
  });

  beforeEach(async () => {
    await cleanupTestDb(db);

    baseUser = await createTestUser(db);
    baseGuest = await createTestGuest(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('findInvoiceByNumber', () => {
    it('should find invoice by exact number', async () => {
      // 1. Create two invoices with distinct numbers
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-2026-001',
        totalAmount: '150.00',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-2026-002',
        totalAmount: '200.00',
      });

      // 2. Search for the first invoice by its exact number
      const result = await findInvoiceByNumber('INV-2026-001', db);

      // Should return only the matching invoice
      expect(result).toHaveLength(1);
      expect(result[0].totalAmount).toBe('150.00');
    });

    it('should return empty when number not found', async () => {
      // 1. Query for a non-existent invoice number
      const result = await findInvoiceByNumber('INV-9999-999', db);

      // No rows should match
      expect(result).toEqual([]);
    });
  });

  describe('listGuestInvoices', () => {
    beforeEach(async () => {
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-001',
        issueDate: '2026-01-10',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-002',
        issueDate: '2026-02-15',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-003',
        issueDate: '2026-03-20',
      });
    });

    it('should list all invoices for guest when no date filter', async () => {
      // 1. Query all invoices for the guest (no date filter)
      const results = await listGuestInvoices(baseGuest.id, undefined, db);

      // All three seeded invoices returned, newest first
      expect(results).toHaveLength(3);
      expect(results[0].invoiceNumber).toBe('INV-003');
      expect(results[2].invoiceNumber).toBe('INV-001');
    });

    it('should filter by issue date when provided', async () => {
      // 1. List invoices issued on or after 2026-02-01
      const results = await listGuestInvoices(baseGuest.id, '2026-02-01', db);

      // Only Feb and Mar invoices qualify
      expect(results).toHaveLength(2);
      expect(results[0].invoiceNumber).toBe('INV-003');
      expect(results[1].invoiceNumber).toBe('INV-002');
    });

    it('should return empty when guest has no invoices', async () => {
      // 1. Create a different guest with no invoices
      const otherGuest = await createTestGuest(db, { email: 'other@test.com' });
      
      // 2. Query invoices for that guest
      const results = await listGuestInvoices(otherGuest.id, undefined, db);

      // No invoices exist for the new guest
      expect(results).toEqual([]);
    });
  });

  describe('listOutstandingInvoices', () => {
    beforeEach(async () => {
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-001',
        status: 'issued',
        balance: '100.00',
        dueDate: '2026-03-01',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-002',
        status: 'partially_paid',
        balance: '50.00',
        dueDate: '2026-02-15',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-003',
        status: 'overdue',
        balance: '200.00',
        dueDate: '2026-01-10',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-004',
        status: 'paid',
        balance: '0.00',
        dueDate: '2026-02-01',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-005',
        status: 'issued',
        balance: '0.00',
        dueDate: '2026-03-05',
      });
    });

    it('should include issued, partially_paid, and overdue with balance > 0', async () => {
      // 1. Query all outstanding invoices
      const results = await listOutstandingInvoices(db);

      // Only INV-001, INV-002, INV-003 have unpaid balances
      expect(results).toHaveLength(3);
      const numbers = results.map(r => r.invoiceNumber).sort();
      expect(numbers).toEqual(['INV-001', 'INV-002', 'INV-003']);
    });

    it('should order by due date descending', async () => {
      // 1. Query outstanding invoices
      const results = await listOutstandingInvoices(db);

      // Newest due date first
      expect(results[0].invoiceNumber).toBe('INV-001');
      expect(results[1].invoiceNumber).toBe('INV-002');
      expect(results[2].invoiceNumber).toBe('INV-003');
    });

    it('should return empty when no outstanding invoices', async () => {
      // 1. Reset and create only a paid invoice with zero balance
      await cleanupTestDb(db);
      baseUser = await createTestUser(db);
      baseGuest = await createTestGuest(db);

      await createTestInvoice(db, {
        guestId: baseGuest.id,
        status: 'paid',
        balance: '0.00',
      });

      // 2. Query outstanding invoices
      const results = await listOutstandingInvoices(db);

      // Nothing outstanding
      expect(results).toEqual([]);
    });
  });

  describe('searchInvoices', () => {
    beforeEach(async () => {
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-2026-001',
        issueDate: '2026-03-01',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-2026-002',
        issueDate: '2026-02-15',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-2025-100',
        issueDate: '2026-01-10',
      });
    });

    it('should find invoices by partial number match', async () => {
      // 1. Search invoices containing "2026"
      const results = await searchInvoices('2026', db);

      // Two of three seeded invoices have "2026" in their number
      expect(results).toHaveLength(2);
      expect(results[0].invoiceNumber).toBe('INV-2026-001');
      expect(results[1].invoiceNumber).toBe('INV-2026-002');
    });

    it('should be case-insensitive', async () => {
      // 1. Search with lowercase term
      const results = await searchInvoices('inv-2026', db);

      // Should still match the uppercase invoice numbers
      expect(results).toHaveLength(2);
    });

    it('should return empty when no match', async () => {
      // 1. Search for a term that doesn't appear in any invoice number
      const results = await searchInvoices('9999', db);

      // No results expected
      expect(results).toEqual([]);
    });
  });

  describe('listOverdueInvoices', () => {
    beforeEach(async () => {
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-001',
        status: 'overdue',
        dueDate: '2026-03-01',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-002',
        status: 'overdue',
        dueDate: '2026-02-15',
      });
      await createTestInvoice(db, {
        guestId: baseGuest.id,
        invoiceNumber: 'INV-003',
        status: 'issued',
        dueDate: '2026-01-10',
      });
    });

    it('should list only invoices with overdue status', async () => {
      // 1. Query overdue invoices
      const results = await listOverdueInvoices(db);

      // Only INV-001 and INV-002 have status 'overdue'
      expect(results).toHaveLength(2);
      const numbers = results.map(r => r.invoiceNumber).sort();
      expect(numbers).toEqual(['INV-001', 'INV-002']);
    });

    it('should order by due date descending', async () => {
      // 1. Query overdue invoices
      const results = await listOverdueInvoices(db);

      // Newest due date first
      expect(results[0].dueDate).toBe('2026-03-01');
      expect(results[1].dueDate).toBe('2026-02-15');
    });

    it('should return empty when no overdue invoices', async () => {
      // 1. Reset and create only a paid invoice
      await cleanupTestDb(db);
      baseUser = await createTestUser(db);
      baseGuest = await createTestGuest(db);

      await createTestInvoice(db, {
        guestId: baseGuest.id,
        status: 'paid',
      });

      // 2. Query overdue invoices
      const results = await listOverdueInvoices(db);

      // Nothing overdue
      expect(results).toEqual([]);
    });
  });
});
