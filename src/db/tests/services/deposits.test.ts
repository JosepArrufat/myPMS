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
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      const result = await collectDeposit(
        reservation.id,
        '200.00',
        'credit_card',
        user.id,
        'TXN-001',
        db,
      )

      expect(result.totalDeposit).toBe('200.00')
      expect(result.payment.amount).toBe('200.00')
      expect(result.payment.paymentMethod).toBe('credit_card')
      expect(result.depositInvoiceId).toBeTruthy()
    })

    it('adds to existing deposit', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      await collectDeposit(reservation.id, '100.00', 'cash', user.id, undefined, db)
      const result = await collectDeposit(reservation.id, '150.00', 'credit_card', user.id, undefined, db)

      expect(result.totalDeposit).toBe('250.00')
    })
  })

  describe('applyDepositToInvoice', () => {
    it('applies deposit to final invoice', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      await collectDeposit(reservation.id, '200.00', 'cash', user.id, undefined, db)

      const finalInvoice = await createTestInvoice(db, {
        guestId: guest.id,
        reservationId: reservation.id,
        invoiceType: 'final',
        totalAmount: '500.00',
        balance: '500.00',
        status: 'issued',
      })

      const result = await applyDepositToInvoice(
        reservation.id,
        finalInvoice.id,
        user.id,
        db,
      )

      expect(result.appliedAmount).toBe('200.00')
    })

    it('throws when no deposit exists', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })
      const invoice = await createTestInvoice(db, {
        guestId: guest.id,
        reservationId: reservation.id,
      })

      await expect(
        applyDepositToInvoice(reservation.id, invoice.id, user.id, db),
      ).rejects.toThrow('no deposit found')
    })
  })

  describe('refundDeposit', () => {
    it('refunds all deposits and resets reservation deposit', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      await collectDeposit(reservation.id, '300.00', 'cash', user.id, undefined, db)

      const result = await refundDeposit(reservation.id, 'Guest cancelled', user.id, db)

      expect(result.totalRefunded).toBe('300.00')
      expect(result.refunds).toHaveLength(1)
    })
  })

  describe('getDepositHistory', () => {
    it('returns deposit and refund history with totals', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const reservation = await createTestReservation(db, user.id, {
        guestId: guest.id,
      })

      await collectDeposit(reservation.id, '200.00', 'cash', user.id, undefined, db)
      await collectDeposit(reservation.id, '100.00', 'credit_card', user.id, undefined, db)

      const history = await getDepositHistory(reservation.id, db)

      expect(history.deposits).toHaveLength(2)
      expect(history.totalDeposited).toBe('300.00')
      expect(history.totalRefunded).toBe('0.00')
      expect(history.netDeposit).toBe('300.00')
    })
  })
})
