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

describe('Billing services', () => {
  const db = getTestDb()
  let userId: number
  let guestId: string

  beforeEach(async () => {
    await cleanupTestDb(db)
    const user = await createTestUser(db)
    userId = user.id
    const guest = await createTestGuest(db)
    guestId = guest.id
  })

  afterAll(async () => {
    await cleanupTestDb(db)
    await verifyDbIsEmpty(db)
  })

  describe('generateInvoice', () => {
    it('creates invoice with line items from daily rates', async () => {
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

      await db.insert(reservationDailyRates).values([
        { reservationRoomId: rr.id, date: '2026-03-01', rate: '100.00', createdBy: userId },
        { reservationRoomId: rr.id, date: '2026-03-02', rate: '100.00', createdBy: userId },
        { reservationRoomId: rr.id, date: '2026-03-03', rate: '120.00', createdBy: userId },
      ])

      const invoice = await generateInvoice(reservation.id, userId, db)

      expect(invoice.reservationId).toBe(reservation.id)
      expect(invoice.guestId).toBe(guestId)
      expect(parseFloat(invoice.subtotal)).toBe(320)
      expect(invoice.status).toBe('issued')

      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoice.id))

      expect(items).toHaveLength(3)
    })

    it('creates empty invoice when no daily rates exist', async () => {
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

      const invoice = await generateInvoice(reservation.id, userId, db)

      expect(parseFloat(invoice.subtotal)).toBe(0)
    })

    it('rejects when reservation does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'

      await expect(
        generateInvoice(fakeId, userId, db),
      ).rejects.toThrow('reservation not found')
    })
  })

  describe('addCharge', () => {
    it('adds item and recalculates invoice totals', async () => {
      const invoice = await createTestInvoice(db, {
        guestId,
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

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

      expect(item.itemType).toBe('minibar')
      expect(parseFloat(item.total)).toBe(10)

      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))

      expect(parseFloat(updated.subtotal)).toBe(10)
    })
  })

  describe('removeCharge', () => {
    it('removes item and recalculates invoice totals', async () => {
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

      await removeCharge(item2.id, db)

      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))

      expect(parseFloat(updated.subtotal)).toBe(150)
    })

    it('rejects when item does not exist', async () => {
      await expect(
        removeCharge(999999, db),
      ).rejects.toThrow('invoice item not found')
    })
  })

  describe('recordPayment', () => {
    it('records payment and updates invoice balance', async () => {
      const invoice = await createTestInvoice(db, {
        guestId,
        subtotal: '300.00',
        totalAmount: '300.00',
        balance: '300.00',
        status: 'issued',
      })

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

      expect(payment.amount).toBe('200.00')
      expect(payment.isRefund).toBe(false)

      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))

      expect(parseFloat(updated.paidAmount)).toBe(200)
      expect(parseFloat(updated.balance)).toBe(100)
      expect(updated.status).toBe('partially_paid')
    })

    it('marks invoice as paid when balance reaches zero', async () => {
      const invoice = await createTestInvoice(db, {
        guestId,
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      await recordPayment(
        invoice.id,
        {
          amount: '100.00',
          paymentMethod: 'cash',
        },
        userId,
        db,
      )

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
      const invoice = await createTestInvoice(db, {
        guestId,
        subtotal: '200.00',
        totalAmount: '200.00',
        paidAmount: '200.00',
        balance: '0',
        status: 'paid',
      })

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

      const refund = await processRefund(
        invoice.id,
        originalPayment[0].id,
        '50.00',
        'partial refund for early checkout',
        userId,
        db,
      )

      expect(refund.isRefund).toBe(true)
      expect(refund.refundedPaymentId).toBe(originalPayment[0].id)
      expect(refund.amount).toBe('50.00')

      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))

      expect(parseFloat(updated.paidAmount)).toBe(150)
      expect(parseFloat(updated.balance)).toBe(50)
    })

    it('rejects when original payment does not exist', async () => {
      const invoice = await createTestInvoice(db, { guestId })

      await expect(
        processRefund(invoice.id, 999999, '10.00', 'test', userId, db),
      ).rejects.toThrow('original payment not found')
    })
  })
})
