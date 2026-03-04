import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest'

import { eq } from 'drizzle-orm'

import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../setup'

import {
  createTestUser,
  createTestGuest,
  createTestRoomType,
  createTestReservation,
  createTestReservationRoom,
  createTestInvoice,
} from '../factories'

import {
  generateInvoice,
  addCharge,
  removeCharge,
  recordPayment,
  processRefund,
} from '../../services/billing'

import { reservationDailyRates } from '../../schema/reservations'
import { invoices, invoiceItems, payments } from '../../schema/invoices'
import { systemConfig } from '../../schema/system'

describe('Billing services', () => {
  const db = getTestDb()
  let userId: number
  let guestId: string

  // Business date is set to '2026-02-10', which matches the factory's
  // default issueDate. Happy-path tests use invoices dated '2026-02-10'
  // (current day). Unhappy-path tests create invoices with an earlier
  // issueDate to verify the guard rejects past-invoice mutations.
  const TEST_BUSINESS_DATE = '2026-02-10'

  beforeEach(async () => {
    await cleanupTestDb(db)
    const user = await createTestUser(db)
    userId = user.id
    const guest = await createTestGuest(db)
    guestId = guest.id
    await db
      .insert(systemConfig)
      .values({ key: 'business_date', value: TEST_BUSINESS_DATE })
      .onConflictDoUpdate({ target: systemConfig.key, set: { value: TEST_BUSINESS_DATE } })
  })

  afterAll(async () => {
    await cleanupTestDb(db)
    await verifyDbIsEmpty(db)
  })

  describe('generateInvoice', () => {
    it('creates invoice with line items from daily rates', async () => {
      // 1. Create a room type and a 3-night reservation with a room
      const roomType = await createTestRoomType(db)

      const reservation = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-04',
      })

      const rr = await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-04',
      })

      // 2. Seed daily rates: $100, $100, $120 for 3 nights
      await db.insert(reservationDailyRates).values([
        { reservationRoomId: rr.id, date: '2026-03-01', rate: '100.00', createdBy: userId },
        { reservationRoomId: rr.id, date: '2026-03-02', rate: '100.00', createdBy: userId },
        { reservationRoomId: rr.id, date: '2026-03-03', rate: '120.00', createdBy: userId },
      ])

      // 3. Generate the invoice
      const invoice = await generateInvoice(reservation.id, userId, db)

      // Invoice should be issued for this guest with subtotal = $320
      expect(invoice.reservationId).toBe(reservation.id)
      expect(invoice.guestId).toBe(guestId)
      expect(parseFloat(invoice.subtotal)).toBe(320)
      expect(invoice.status).toBe('issued')

      // Should have 3 line items (one per night)
      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoice.id))

      expect(items).toHaveLength(3)
    })

    it('creates empty invoice when no daily rates exist', async () => {
      // 1. Create a reservation with a room but no daily rates
      const roomType = await createTestRoomType(db)

      const reservation = await createTestReservation(db, userId, {
        guestId,
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
      })

      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
      })

      // 2. Generate the invoice
      const invoice = await generateInvoice(reservation.id, userId, db)

      // Subtotal should be $0 with no rates to pull in
      expect(parseFloat(invoice.subtotal)).toBe(0)
    })

    it('rejects when reservation does not exist', async () => {
      // 1. Try to generate an invoice for a non-existent reservation
      const fakeId = '00000000-0000-0000-0000-000000000000'

      // Should throw 'reservation not found'
      await expect(
        generateInvoice(fakeId, userId, db),
      ).rejects.toThrow('reservation not found')
    })
  })

  describe('addCharge', () => {
    it('adds item and recalculates invoice totals', async () => {
      // 1. Create an invoice with $100 subtotal
      const invoice = await createTestInvoice(db, {
        guestId,
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      // 2. Add 2× $5 minibar items
      const item = await addCharge(
        invoice.id,
        {
          itemType: 'minibar',
          description: 'Water bottle',
          unitPrice: '5.00',
          quantity: '2',
        },
        userId,
        db,
      )

      // New item should be 'minibar' with total = $10
      expect(item.itemType).toBe('minibar')
      expect(parseFloat(item.total)).toBe(10)

      // 3. Verify invoice subtotal was recalculated
      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))

      expect(parseFloat(updated.subtotal)).toBe(10)
    })
  })

  describe('removeCharge', () => {
    it('removes item and recalculates invoice totals', async () => {
      // 1. Create an invoice and add two charges: room $150 + food $50
      const invoice = await createTestInvoice(db, {
        guestId,
        subtotal: '200.00',
        totalAmount: '200.00',
        balance: '200.00',
      })

      const item = await addCharge(
        invoice.id,
        {
          itemType: 'room',
          description: 'Room night',
          unitPrice: '150.00',
        },
        userId,
        db,
      )

      const item2 = await addCharge(
        invoice.id,
        {
          itemType: 'food',
          description: 'Dinner',
          unitPrice: '50.00',
        },
        userId,
        db,
      )

      // 2. Remove the food charge
      await removeCharge(item2.id, db)

      // 3. Verify subtotal dropped to $150 (room only)
      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))

      expect(parseFloat(updated.subtotal)).toBe(150)
    })

    it('rejects when item does not exist', async () => {
      // 1. Try to remove a non-existent item ID
      // Should throw 'invoice item not found'
      await expect(
        removeCharge(999999, db),
      ).rejects.toThrow('invoice item not found')
    })
  })

  describe('recordPayment', () => {
    it('records payment and updates invoice balance', async () => {
      // 1. Create a $300 invoice
      const invoice = await createTestInvoice(db, {
        guestId,
        subtotal: '300.00',
        totalAmount: '300.00',
        balance: '300.00',
        status: 'issued',
      })

      // 2. Record a $200 credit-card payment
      const payment = await recordPayment(
        invoice.id,
        {
          amount: '200.00',
          paymentMethod: 'credit_card',
          transactionReference: 'TXN-001',
        },
        userId,
        db,
      )

      // Payment recorded, not a refund
      expect(payment.amount).toBe('200.00')
      expect(payment.isRefund).toBe(false)

      // 3. Verify invoice is partially_paid with $100 remaining
      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))

      expect(parseFloat(updated.paidAmount)).toBe(200)
      expect(parseFloat(updated.balance)).toBe(100)
      expect(updated.status).toBe('partially_paid')
    })

    it('marks invoice as paid when balance reaches zero', async () => {
      // 1. Create a $100 invoice
      const invoice = await createTestInvoice(db, {
        guestId,
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      // 2. Pay the full $100 in cash
      await recordPayment(
        invoice.id,
        {
          amount: '100.00',
          paymentMethod: 'cash',
        },
        userId,
        db,
      )

      // 3. Verify balance is zero and status flipped to 'paid'
      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))

      expect(parseFloat(updated.balance)).toBe(0)
      expect(updated.status).toBe('paid')
    })
  })

  describe('processRefund', () => {
    it('creates refund payment and adjusts invoice balance', async () => {
      // 1. Create a fully-paid $200 invoice
      const invoice = await createTestInvoice(db, {
        guestId,
        subtotal: '200.00',
        totalAmount: '200.00',
        paidAmount: '200.00',
        balance: '0',
        status: 'paid',
      })

      // 2. Insert the original $200 payment record
      const originalPayment = await db
        .insert(payments)
        .values({
          invoiceId: invoice.id,
          amount: '200.00',
          paymentMethod: 'credit_card',
          isRefund: false,
          createdBy: userId,
        })
        .returning()

      // 3. Process a $50 partial refund
      const refund = await processRefund(
        invoice.id,
        originalPayment[0].id,
        '50.00',
        'partial refund for early checkout',
        userId,
        db,
      )

      // Refund should reference the original payment
      expect(refund.isRefund).toBe(true)
      expect(refund.refundedPaymentId).toBe(originalPayment[0].id)
      expect(refund.amount).toBe('50.00')

      // 4. Verify paidAmount dropped to $150, balance reopened to $50
      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))

      expect(parseFloat(updated.paidAmount)).toBe(150)
      expect(parseFloat(updated.balance)).toBe(50)
    })

    it('rejects when original payment does not exist', async () => {
      // 1. Create an invoice with no payments
      const invoice = await createTestInvoice(db, { guestId })

      // 2. Try to refund a non-existent payment ID
      // Should throw 'original payment not found'
      await expect(
        processRefund(invoice.id, 999999, '10.00', 'test', userId, db),
      ).rejects.toThrow('original payment not found')
    })
  })


  describe('guard – rejects past-day operations, allows refunds', () => {
    // An invoice issued before the current business date is "past"
    const PAST_DATE = '2026-01-01'

    it('rejects addCharge on a past invoice (unhappy path)', async () => {
      // 1. Create an invoice dated in the past
      const invoice = await createTestInvoice(db, { guestId, issueDate: PAST_DATE })

      // 2. Attempt to add a charge — should be rejected
      await expect(
        addCharge(invoice.id, { itemType: 'minibar', description: 'Water', unitPrice: '5.00' }, userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('allows addCharge on a current-day invoice (happy path)', async () => {
      // 1. Create an invoice dated today (current business date)
      const invoice = await createTestInvoice(db, { guestId, issueDate: TEST_BUSINESS_DATE })

      // 2. Add a charge — should succeed
      const item = await addCharge(
        invoice.id, { itemType: 'minibar', description: 'Water', unitPrice: '5.00' }, userId, db,
      )
      expect(item.itemType).toBe('minibar')
    })

    it('rejects removeCharge on a past invoice (unhappy path)', async () => {
      // 1. Set business date to the past so the charge can be added
      await db.insert(systemConfig).values({ key: 'business_date', value: PAST_DATE })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: PAST_DATE } })
      const invoice = await createTestInvoice(db, { guestId, issueDate: PAST_DATE })
      const item = await addCharge(invoice.id, { itemType: 'spa', description: 'Massage', unitPrice: '80.00' }, userId, db)

      // 2. Advance business date → invoice is now in the past
      await db.insert(systemConfig).values({ key: 'business_date', value: TEST_BUSINESS_DATE })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: TEST_BUSINESS_DATE } })

      // 3. Attempt to remove the charge — should be rejected
      await expect(removeCharge(item.id, db)).rejects.toThrow('Cannot modify a past invoice')
    })

    it('rejects recordPayment on a past invoice (unhappy path)', async () => {
      // 1. Create an invoice dated in the past with $100 balance
      const invoice = await createTestInvoice(db, { guestId, issueDate: PAST_DATE, status: 'issued', balance: '100.00', totalAmount: '100.00' })

      // 2. Attempt a $50 payment — should be rejected
      await expect(
        recordPayment(invoice.id, { amount: '50.00', paymentMethod: 'cash' }, userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('allows processRefund on a past invoice (refunds are never blocked)', async () => {
      // 1. Create a fully-paid past invoice with a $200 payment
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: PAST_DATE,
        status: 'paid',
        paidAmount: '200.00',
        balance: '0',
        totalAmount: '200.00',
      })
      const [origPayment] = await db.insert(payments).values({
        invoiceId: invoice.id, amount: '200.00', paymentMethod: 'credit_card', isRefund: false, createdBy: userId,
      }).returning()

      // 2. Process a $50 refund — should succeed (refunds bypass the guard)
      const refund = await processRefund(invoice.id, origPayment.id, '50.00', 'guest request', userId, db)

      // Refund recorded successfully
      expect(refund.isRefund).toBe(true)
      expect(refund.amount).toBe('50.00')
    })
  })
})
