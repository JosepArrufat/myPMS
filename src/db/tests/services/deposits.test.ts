import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTestDb, cleanupTestDb, type TestDb } from '../setup'
import {
  createTestUser,
  createTestGuest,
  createTestReservation,
  createTestInvoice,
} from '../factories'
import {
  collectDeposit,
  applyDepositToInvoice,
  refundDeposit,
  getDepositHistory,
} from '../../services/deposits'

let db: TestDb

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => { await cleanupTestDb(db) })

describe('deposits service', () => {
  describe('collectDeposit', () => {
    it('records a deposit and updates the reservation', async () => {
      // 1. Create a user, guest, and reservation as baseline
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      // 2. Collect a credit-card deposit against the reservation
      const result = await collectDeposit(
        reservation.id,
        '200.00',
        'credit_card',
        user.id,
        'TXN-001',
        db,
      )

      // deposit total matches the collected amount
      expect(result.totalDeposit).toBe('200.00')
      // payment record stores correct amount and method
      expect(result.payment.amount).toBe('200.00')
      expect(result.payment.paymentMethod).toBe('credit_card')
      // a deposit invoice was created
      expect(result.depositInvoiceId).toBeTruthy()
    })

    it('adds to existing deposit', async () => {
      // 1. Create baseline user, guest, and reservation
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      // 2. Collect an initial cash deposit of 100
      await collectDeposit(reservation.id, '100.00', 'cash', user.id, undefined, db)
      // 3. Collect a second deposit of 150 via credit card
      const result = await collectDeposit(reservation.id, '150.00', 'credit_card', user.id, undefined, db)

      // total should be the sum of both deposits
      expect(result.totalDeposit).toBe('250.00')
    })
  })

  describe('applyDepositToInvoice', () => {
    it('applies deposit to final invoice', async () => {
      // 1. Create baseline user, guest, and reservation
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      // 2. Collect a 200 cash deposit
      await collectDeposit(reservation.id, '200.00', 'cash', user.id, undefined, db)

      // 3. Issue a final invoice with a 500 balance
      const finalInvoice = await createTestInvoice(db, {
        guestId: guest.id,
        reservationId: reservation.id,
        invoiceType: 'final',
        totalAmount: '500.00',
        balance: '500.00',
        status: 'issued',
      })

      // 4. Apply the deposit to the final invoice
      const result = await applyDepositToInvoice(
        reservation.id,
        finalInvoice.id,
        user.id,
        db,
      )

      // full deposit amount was applied
      expect(result.appliedAmount).toBe('200.00')
    })

    it('throws when no deposit exists', async () => {
      // 1. Create reservation and invoice but skip collecting a deposit
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })
      const invoice = await createTestInvoice(db, {
        guestId: guest.id,
        reservationId: reservation.id,
      })

      // 2. Attempt to apply a non-existent deposit
      // should reject with a clear error
      await expect(
        applyDepositToInvoice(reservation.id, invoice.id, user.id, db),
      ).rejects.toThrow('no deposit found')
    })
  })

  describe('refundDeposit', () => {
    it('refunds all deposits and resets reservation deposit', async () => {
      // 1. Create baseline user, guest, and reservation
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      // 2. Collect a 300 cash deposit
      await collectDeposit(reservation.id, '300.00', 'cash', user.id, undefined, db)

      // 3. Refund the deposit due to cancellation
      const result = await refundDeposit(reservation.id, 'Guest cancelled', user.id, db)

      // full amount was refunded
      expect(result.totalRefunded).toBe('300.00')
      // exactly one refund record created
      expect(result.refunds).toHaveLength(1)
    })
  })

  describe('getDepositHistory', () => {
    it('returns deposit and refund history with totals', async () => {
      // 1. Create baseline user, guest, and reservation
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      // 2. Collect two deposits via different methods
      await collectDeposit(reservation.id, '200.00', 'cash', user.id, undefined, db)
      await collectDeposit(reservation.id, '100.00', 'credit_card', user.id, undefined, db)

      // 3. Retrieve the full deposit history
      const history = await getDepositHistory(reservation.id, db)

      // both deposits are listed
      expect(history.deposits).toHaveLength(2)
      // totals are calculated correctly
      expect(history.totalDeposited).toBe('300.00')
      expect(history.totalRefunded).toBe('0.00')
      // net = deposited - refunded
      expect(history.netDeposit).toBe('300.00')
    })
  })
})
