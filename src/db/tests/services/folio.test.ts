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
import { systemConfig } from '../../schema/system'

let db: TestDb
let userId: number
let guestId: string

// The factory default issueDate is '2026-02-10'.
// Business date is set to the same value so happy-path tests use
// current-day invoices. Unhappy-path tests explicitly use a past date.
const BUSINESS_DATE = '2026-02-10'

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => {
  await cleanupTestDb(db)
  const user = await createTestUser(db)
  userId = user.id
  const guest = await createTestGuest(db)
  guestId = guest.id
  await db
    .insert(systemConfig)
    .values({ key: 'business_date', value: BUSINESS_DATE })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value: BUSINESS_DATE } })
})

describe('folio service', () => {
  describe('postCharge', () => {
    it('posts a charge and recalculates the invoice', async () => {
      const invoice = await createTestInvoice(db)

      const item = await postCharge(
        invoice.id,
        {
          itemType: 'minibar',
          description: 'Minibar snacks',
          unitPrice: '15.00',
          quantity: '2',
        },
        userId,
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
      const invoice = await createTestInvoice(db)

      await postCharge(
        invoice.id,
        { itemType: 'room', description: 'Room night', unitPrice: '100.00' },
        userId,
        db,
      )
      await postCharge(
        invoice.id,
        { itemType: 'food', description: 'Room service', unitPrice: '25.00' },
        userId,
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
      const invoiceA = await createTestInvoice(db, { guestId })
      const invoiceB = await createTestInvoice(db, { guestId })

      const item = await postCharge(
        invoiceA.id,
        { itemType: 'spa', description: 'Spa treatment', unitPrice: '80.00' },
        userId,
        db,
      )

      const result = await transferCharge(item.id, invoiceB.id, userId, db)

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

      await expect(
        transferCharge(999999, invoice.id, userId, db),
      ).rejects.toThrow('invoice item not found')
    })
  })

  describe('splitFolio', () => {
    it('creates a new invoice and moves selected items', async () => {
      const invoice = await createTestInvoice(db)

      const item1 = await postCharge(
        invoice.id,
        { itemType: 'room', description: 'Room night 1', unitPrice: '100.00' },
        userId,
        db,
      )
      const item2 = await postCharge(
        invoice.id,
        { itemType: 'room', description: 'Room night 2', unitPrice: '100.00' },
        userId,
        db,
      )
      const item3 = await postCharge(
        invoice.id,
        { itemType: 'food', description: 'Dinner', unitPrice: '50.00' },
        userId,
        db,
      )

      const result = await splitFolio(
        invoice.id,
        [item2.id, item3.id],
        userId,
        db,
      )

      expect(result.sourceInvoice.subtotal).toBe('100.00')
      expect(result.newInvoice.subtotal).toBe('150.00')
    })

    it('throws for non-existent source invoice', async () => {
      await expect(
        splitFolio('00000000-0000-0000-0000-000000000000', [1], userId, db),
      ).rejects.toThrow('source invoice not found')
    })
  })
  describe('guard – rejects past-day operations', () => {
    // Advance business date so the factory default invoice (2026-02-10) becomes past
    const FUTURE_BD = '2026-03-01'

    it('rejects postCharge on a past-day invoice', async () => {
      const invoice = await createTestInvoice(db, { issueDate: '2026-02-10' })
      await db.insert(systemConfig).values({ key: 'business_date', value: FUTURE_BD })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: FUTURE_BD } })

      await expect(
        postCharge(invoice.id, { itemType: 'minibar', description: 'Water', unitPrice: '5.00' }, userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('allows postCharge on a current-day invoice', async () => {
      // Invoice date equals business date → allowed
      const invoice = await createTestInvoice(db, { issueDate: BUSINESS_DATE })
      const item = await postCharge(
        invoice.id, { itemType: 'minibar', description: 'Water', unitPrice: '5.00' }, userId, db,
      )
      expect(item.itemType).toBe('minibar')
    })

    it('rejects transferCharge when source invoice is past', async () => {
      const past = await createTestInvoice(db, { guestId, issueDate: '2026-01-01' })
      const current = await createTestInvoice(db, { guestId, issueDate: BUSINESS_DATE })

      // Post charge while business date still matches the past invoice…
      await db.insert(systemConfig).values({ key: 'business_date', value: '2026-01-01' })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: '2026-01-01' } })
      const item = await postCharge(
        past.id, { itemType: 'spa', description: 'Spa', unitPrice: '50.00' }, userId, db,
      )

      // …then advance business date so the source invoice is now past
      await db.insert(systemConfig).values({ key: 'business_date', value: FUTURE_BD })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: FUTURE_BD } })

      await expect(
        transferCharge(item.id, current.id, userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('rejects splitFolio on a past-day invoice', async () => {
      // Create invoice while business date is 2026-01-01
      await db.insert(systemConfig).values({ key: 'business_date', value: '2026-01-01' })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: '2026-01-01' } })
      const invoice = await createTestInvoice(db, { guestId, issueDate: '2026-01-01' })
      const item = await postCharge(
        invoice.id, { itemType: 'room', description: 'Night', unitPrice: '100.00' }, userId, db,
      )

      // Advance business date → invoice becomes past
      await db.insert(systemConfig).values({ key: 'business_date', value: FUTURE_BD })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: FUTURE_BD } })

      await expect(
        splitFolio(invoice.id, [item.id], userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })
  })
})
