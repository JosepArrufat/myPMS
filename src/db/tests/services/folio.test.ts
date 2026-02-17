import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTestDb, cleanupTestDb, type TestDb } from '../setup'
import {
  createTestUser,
  createTestGuest,
  createTestInvoice,
} from '../factories'
import {
  postCharge,
  getFolioBalance,
  transferCharge,
  splitFolio,
} from '../../services/folio'

let db: TestDb

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => { await cleanupTestDb(db) })

describe('folio service', () => {
  describe('postCharge', () => {
    it('posts a charge and recalculates the invoice', async () => {
      const user = await createTestUser(db)
      const invoice = await createTestInvoice(db)

      const item = await postCharge(
        invoice.id,
        {
          itemType: 'minibar',
          description: 'Minibar snacks',
          unitPrice: '15.00',
          quantity: '2',
        },
        user.id,
        db,
      )

      expect(item.itemType).toBe('minibar')
      expect(item.total).toBe('30.00')

      const folio = await getFolioBalance(invoice.id, db)
      expect(folio.invoice.subtotal).toBe('30.00')
      expect(folio.charges).toHaveLength(1)
    })
  })

  describe('getFolioBalance', () => {
    it('returns invoice, charges, and payments', async () => {
      const user = await createTestUser(db)
      const invoice = await createTestInvoice(db)

      await postCharge(
        invoice.id,
        { itemType: 'room', description: 'Room night', unitPrice: '100.00' },
        user.id,
        db,
      )
      await postCharge(
        invoice.id,
        { itemType: 'food', description: 'Room service', unitPrice: '25.00' },
        user.id,
        db,
      )

      const folio = await getFolioBalance(invoice.id, db)

      expect(folio.charges).toHaveLength(2)
      expect(folio.invoice.subtotal).toBe('125.00')
    })

    it('throws for non-existent invoice', async () => {
      await expect(
        getFolioBalance('00000000-0000-0000-0000-000000000000', db),
      ).rejects.toThrow('invoice not found')
    })
  })

  describe('transferCharge', () => {
    it('moves a charge from one invoice to another', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const invoiceA = await createTestInvoice(db, { guestId: guest.id })
      const invoiceB = await createTestInvoice(db, { guestId: guest.id })

      const item = await postCharge(
        invoiceA.id,
        { itemType: 'spa', description: 'Spa treatment', unitPrice: '80.00' },
        user.id,
        db,
      )

      const result = await transferCharge(item.id, invoiceB.id, user.id, db)

      expect(result.sourceInvoiceId).toBe(invoiceA.id)
      expect(result.targetInvoiceId).toBe(invoiceB.id)

      const folioA = await getFolioBalance(invoiceA.id, db)
      expect(folioA.charges).toHaveLength(0)
      expect(folioA.invoice.subtotal).toBe('0.00')

      const folioB = await getFolioBalance(invoiceB.id, db)
      expect(folioB.charges).toHaveLength(1)
      expect(folioB.invoice.subtotal).toBe('80.00')
    })

    it('throws for non-existent item', async () => {
      const invoice = await createTestInvoice(db)
      const user = await createTestUser(db)

      await expect(
        transferCharge(999999, invoice.id, user.id, db),
      ).rejects.toThrow('invoice item not found')
    })
  })

  describe('splitFolio', () => {
    it('creates a new invoice and moves selected items', async () => {
      const user = await createTestUser(db)
      const invoice = await createTestInvoice(db)

      const item1 = await postCharge(
        invoice.id,
        { itemType: 'room', description: 'Room night 1', unitPrice: '100.00' },
        user.id,
        db,
      )
      const item2 = await postCharge(
        invoice.id,
        { itemType: 'room', description: 'Room night 2', unitPrice: '100.00' },
        user.id,
        db,
      )
      const item3 = await postCharge(
        invoice.id,
        { itemType: 'food', description: 'Dinner', unitPrice: '50.00' },
        user.id,
        db,
      )

      const result = await splitFolio(
        invoice.id,
        [item2.id, item3.id],
        user.id,
        db,
      )

      expect(result.sourceInvoice.subtotal).toBe('100.00')
      expect(result.newInvoice.subtotal).toBe('150.00')
    })

    it('throws for non-existent source invoice', async () => {
      const user = await createTestUser(db)

      await expect(
        splitFolio('00000000-0000-0000-0000-000000000000', [1], user.id, db),
      ).rejects.toThrow('source invoice not found')
    })
  })
})
