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

      const result = await findInvoiceByNumber('INV-2026-001', db);

      expect(result).toHaveLength(1);
      expect(result[0].totalAmount).toBe('150.00');
    });

    it('should return empty when number not found', async () => {
      const result = await findInvoiceByNumber('INV-9999-999', db);

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
      const results = await listGuestInvoices(baseGuest.id, undefined, db);

      expect(results).toHaveLength(3);
      expect(results[0].invoiceNumber).toBe('INV-003');
      expect(results[2].invoiceNumber).toBe('INV-001');
    });

    it('should filter by issue date when provided', async () => {
      const results = await listGuestInvoices(baseGuest.id, '2026-02-01', db);

      expect(results).toHaveLength(2);
      expect(results[0].invoiceNumber).toBe('INV-003');
      expect(results[1].invoiceNumber).toBe('INV-002');
    });

    it('should return empty when guest has no invoices', async () => {
      const otherGuest = await createTestGuest(db, { email: 'other@test.com' });
      
      const results = await listGuestInvoices(otherGuest.id, undefined, db);

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
      const results = await listOutstandingInvoices(db);

      expect(results).toHaveLength(3);
      const numbers = results.map(r => r.invoiceNumber).sort();
      expect(numbers).toEqual(['INV-001', 'INV-002', 'INV-003']);
    });

    it('should order by due date descending', async () => {
      const results = await listOutstandingInvoices(db);

      expect(results[0].invoiceNumber).toBe('INV-001');
      expect(results[1].invoiceNumber).toBe('INV-002');
      expect(results[2].invoiceNumber).toBe('INV-003');
    });

    it('should return empty when no outstanding invoices', async () => {
      await cleanupTestDb(db);
      baseUser = await createTestUser(db);
      baseGuest = await createTestGuest(db);

      await createTestInvoice(db, {
        guestId: baseGuest.id,
        status: 'paid',
        balance: '0.00',
      });

      const results = await listOutstandingInvoices(db);

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
      const results = await searchInvoices('2026', db);

      expect(results).toHaveLength(2);
      expect(results[0].invoiceNumber).toBe('INV-2026-001');
      expect(results[1].invoiceNumber).toBe('INV-2026-002');
    });

    it('should be case-insensitive', async () => {
      const results = await searchInvoices('inv-2026', db);

      expect(results).toHaveLength(2);
    });

    it('should return empty when no match', async () => {
      const results = await searchInvoices('9999', db);

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
      const results = await listOverdueInvoices(db);

      expect(results).toHaveLength(2);
      const numbers = results.map(r => r.invoiceNumber).sort();
      expect(numbers).toEqual(['INV-001', 'INV-002']);
    });

    it('should order by due date descending', async () => {
      const results = await listOverdueInvoices(db);

      expect(results[0].dueDate).toBe('2026-03-01');
      expect(results[1].dueDate).toBe('2026-02-15');
    });

    it('should return empty when no overdue invoices', async () => {
      await cleanupTestDb(db);
      baseUser = await createTestUser(db);
      baseGuest = await createTestGuest(db);

      await createTestInvoice(db, {
        guestId: baseGuest.id,
        status: 'paid',
      });

      const results = await listOverdueInvoices(db);

      expect(results).toEqual([]);
    });
  });
});
