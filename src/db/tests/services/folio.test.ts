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
      // 1. Create an invoice
      const invoice = await createTestInvoice(db)

      // 2. Post 2× minibar @ $15
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

      // item type is correct and total = 2 × 15 = 30
      expect(item.itemType).toBe('minibar')
      expect(item.total).toBe('30.00')

      // folio subtotal matches and only 1 charge exists
      const folio = await getFolioBalance(invoice.id, db)
      expect(folio.invoice.subtotal).toBe('30.00')
      expect(folio.charges).toHaveLength(1)
    })
  })

  describe('getFolioBalance', () => {
    it('returns invoice, charges, and payments', async () => {
      // 1. Create an invoice
      const invoice = await createTestInvoice(db)

      // 2. Post a room charge ($100)
      await postCharge(
        invoice.id,
        { itemType: 'room', description: 'Room night', unitPrice: '100.00' },
        userId,
        db,
      )
      // 3. Post a food charge ($25)
      await postCharge(
        invoice.id,
        { itemType: 'food', description: 'Room service', unitPrice: '25.00' },
        userId,
        db,
      )

      // 4. Fetch folio balance
      const folio = await getFolioBalance(invoice.id, db)

      // 2 charges present and subtotal = 100 + 25 = 125
      expect(folio.charges).toHaveLength(2)
      expect(folio.invoice.subtotal).toBe('125.00')
    })

    it('throws for non-existent invoice', async () => {
      // 1. Request folio for a non-existent invoice
      // throws "invoice not found"
      await expect(
        getFolioBalance('00000000-0000-0000-0000-000000000000', db),
      ).rejects.toThrow('invoice not found')
    })
  })

  describe('transferCharge', () => {
    it('moves a charge from one invoice to another', async () => {
      // 1. Create two invoices (A and B)
      const invoiceA = await createTestInvoice(db, { guestId })
      const invoiceB = await createTestInvoice(db, { guestId })

      // 2. Post a spa charge ($80) to invoice A
      const item = await postCharge(
        invoiceA.id,
        { itemType: 'spa', description: 'Spa treatment', unitPrice: '80.00' },
        userId,
        db,
      )

      // 3. Transfer the charge from A → B
      const result = await transferCharge(item.id, invoiceB.id, userId, db)

      expect(result.sourceInvoiceId).toBe(invoiceA.id)
      expect(result.targetInvoiceId).toBe(invoiceB.id)

      // invoice A now has 0 charges, subtotal = 0
      const folioA = await getFolioBalance(invoiceA.id, db)
      expect(folioA.charges).toHaveLength(0)
      expect(folioA.invoice.subtotal).toBe('0.00')

      // invoice B now has 1 charge, subtotal = 80
      const folioB = await getFolioBalance(invoiceB.id, db)
      expect(folioB.charges).toHaveLength(1)
      expect(folioB.invoice.subtotal).toBe('80.00')
    })

    it('throws for non-existent item', async () => {
      // 1. Create an invoice (target exists but item does not)
      const invoice = await createTestInvoice(db)

      // 2. Attempt transfer of a non-existent item
      // throws "invoice item not found"
      await expect(
        transferCharge(999999, invoice.id, userId, db),
      ).rejects.toThrow('invoice item not found')
    })
  })

  describe('splitFolio', () => {
    it('creates a new invoice and moves selected items', async () => {
      // 1. Create an invoice
      const invoice = await createTestInvoice(db)

      // 2. Post 3 charges: room $100, room $100, food $50
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

      // 3. Split item2 + item3 into a new invoice
      const result = await splitFolio(
        invoice.id,
        [item2.id, item3.id],
        userId,
        db,
      )

      // source keeps item1 → subtotal = 100
      expect(result.sourceInvoice.subtotal).toBe('100.00')
      // new invoice gets item2 + item3 → subtotal = 150
      expect(result.newInvoice.subtotal).toBe('150.00')
    })

    it('throws for non-existent source invoice', async () => {
      // 1. Attempt split on a non-existent invoice
      // throws "source invoice not found"
      await expect(
        splitFolio('00000000-0000-0000-0000-000000000000', [1], userId, db),
      ).rejects.toThrow('source invoice not found')
    })
  })
  describe('guard – rejects past-day operations', () => {
    // Advance business date so the factory default invoice (2026-02-10) becomes past
    const FUTURE_BD = '2026-03-01'

    it('rejects postCharge on a past-day invoice', async () => {
      // 1. Create an invoice dated 2026-02-10
      const invoice = await createTestInvoice(db, { issueDate: '2026-02-10' })
      // 2. Advance business date so the invoice is now in the past
      await db.insert(systemConfig).values({ key: 'business_date', value: FUTURE_BD })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: FUTURE_BD } })

      // 3. postCharge rejects with past-invoice guard
      await expect(
        postCharge(invoice.id, { itemType: 'minibar', description: 'Water', unitPrice: '5.00' }, userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('allows postCharge on a current-day invoice', async () => {
      // 1. Create an invoice whose date matches business date
      const invoice = await createTestInvoice(db, { issueDate: BUSINESS_DATE })
      // 2. postCharge succeeds on a current-day invoice
      const item = await postCharge(
        invoice.id, { itemType: 'minibar', description: 'Water', unitPrice: '5.00' }, userId, db,
      )
      // item was created successfully
      expect(item.itemType).toBe('minibar')
    })

    it('rejects transferCharge when source invoice is past', async () => {
      // 1. Create a past-dated invoice and a current-dated invoice
      const past = await createTestInvoice(db, { guestId, issueDate: '2026-01-01' })
      const current = await createTestInvoice(db, { guestId, issueDate: BUSINESS_DATE })

      // 2. Set business date to match the past invoice so we can post a charge
      await db.insert(systemConfig).values({ key: 'business_date', value: '2026-01-01' })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: '2026-01-01' } })
      const item = await postCharge(
        past.id, { itemType: 'spa', description: 'Spa', unitPrice: '50.00' }, userId, db,
      )

      // 3. Advance business date so the source invoice is now in the past
      await db.insert(systemConfig).values({ key: 'business_date', value: FUTURE_BD })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: FUTURE_BD } })

      // 4. transferCharge rejects with past-invoice guard
      await expect(
        transferCharge(item.id, current.id, userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('rejects splitFolio on a past-day invoice', async () => {
      // 1. Set business date to 2026-01-01 and create an invoice + charge
      await db.insert(systemConfig).values({ key: 'business_date', value: '2026-01-01' })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: '2026-01-01' } })
      const invoice = await createTestInvoice(db, { guestId, issueDate: '2026-01-01' })
      const item = await postCharge(
        invoice.id, { itemType: 'room', description: 'Night', unitPrice: '100.00' }, userId, db,
      )

      // 2. Advance business date so the invoice is now in the past
      await db.insert(systemConfig).values({ key: 'business_date', value: FUTURE_BD })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: FUTURE_BD } })

      // 3. splitFolio rejects with past-invoice guard
      await expect(
        splitFolio(invoice.id, [item.id], userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })
  })
})
