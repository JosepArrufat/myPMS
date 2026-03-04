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
  createTestRoom,
  createTestRoomType,
  createTestReservation,
  createTestReservationRoom,
  createTestInvoice,
} from '../factories'

import { systemConfig } from '../../schema/system'

import {
  getBusinessDate,
  setBusinessDate,
  advanceBusinessDate,
} from '../../services/business-date'

import {
  getBusinessDateTx,
  assertNotPastDate,
  assertCheckInDate,
  assertInvoiceModifiable,
} from '../../guards'

import { checkInReservation } from '../../services/checkin'

import {
  addCharge,
  recordPayment,
} from '../../services/billing'

describe('Business-date guard edge cases', () => {
  const db = getTestDb()
  let userId: number
  let guestId: string

  const setBizDate = async (date: string) => {
    await db
      .insert(systemConfig)
      .values({ key: 'business_date', value: date })
      .onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: date },
      })
  }

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

  describe('getBusinessDateTx / getBusinessDate fallback', () => {
    it('returns persisted business date when set', async () => {
      // 1. Seed a known business date
      await setBizDate('2026-03-15')
      // 2. Retrieve it via the transactional helper
      const date = await getBusinessDateTx(db)
      // Returns the exact persisted value
      expect(date).toBe('2026-03-15')
    })

    it('falls back to today when no business date is configured', async () => {
      // 1. Start with an empty systemConfig (cleanup already ran)
      // systemConfig is empty after cleanup
      const date = await getBusinessDate(db as any)
      // 2. Compute today's date for comparison
      const today = new Date().toISOString().slice(0, 10)
      // Falls back to the current calendar date
      expect(date).toBe(today)
    })

    it('persists the fallback date in system_config', async () => {
      // 1. Trigger fallback by calling getBusinessDate with no row present
      await getBusinessDate(db as any)
      // 2. Read the system_config table directly
      const [row] = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, 'business_date'))
      // Row was auto-created
      expect(row).toBeTruthy()
      // Persisted value matches today
      expect(row.value).toBe(new Date().toISOString().slice(0, 10))
    })
  })

  describe('advanceBusinessDate', () => {
    it('increments the business date by one day', async () => {
      // 1. Set business date to year-end
      await setBizDate('2026-12-31')
      // 2. Advance by one day
      const next = await advanceBusinessDate(db as any)
      // Rolls over into the new year
      expect(next).toBe('2027-01-01')
    })

    it('handles month boundaries correctly', async () => {
      // 1. Set business date to last day of Feb (non-leap year)
      await setBizDate('2026-02-28')
      // 2. Advance by one day
      const next = await advanceBusinessDate(db as any)
      // Rolls into March
      expect(next).toBe('2026-03-01')
    })

    it('handles leap-year Feb 28→29 (2028 is a leap year)', async () => {
      // 1. Set business date to Feb 28 of a leap year
      await setBizDate('2028-02-28')
      // 2. Advance by one day
      const next = await advanceBusinessDate(db as any)
      // Correctly lands on Feb 29
      expect(next).toBe('2028-02-29')
    })
  })

  describe('assertNotPastDate', () => {
    it('allows a date equal to business date', async () => {
      // 1. Set business date
      await setBizDate('2026-06-15')
      // 2. Assert the same date is accepted
      await expect(
        assertNotPastDate('2026-06-15', db),
      ).resolves.toBe('2026-06-15')
    })

    it('allows a date after business date', async () => {
      // 1. Set business date
      await setBizDate('2026-06-15')
      // 2. Assert a future date is accepted
      await expect(
        assertNotPastDate('2026-06-20', db),
      ).resolves.toBe('2026-06-15')
    })

    it('rejects a date before business date', async () => {
      // 1. Set business date
      await setBizDate('2026-06-15')
      // 2. Try a past date – should throw
      await expect(
        assertNotPastDate('2026-06-14', db),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('rejects with custom label in error message', async () => {
      // 1. Set business date
      await setBizDate('2026-06-15')
      // 2. Pass a custom label and a past date
      await expect(
        assertNotPastDate('2026-06-01', db, 'Task date'),
      // Error message includes the custom label
      ).rejects.toThrow('Task date')
    })

    it('rejects one day before business date', async () => {
      // 1. Set business date to Jan 1
      await setBizDate('2026-01-01')
      // 2. Try the previous day (year boundary)
      await expect(
        assertNotPastDate('2025-12-31', db),
      ).rejects.toThrow('cannot be before')
    })
  })

  describe('assertCheckInDate', () => {
    it('allows check-in when reservation date matches business date', async () => {
      // 1. Set business date
      await setBizDate('2026-06-15')
      // 2. Assert matching check-in date is allowed
      await expect(
        assertCheckInDate('2026-06-15', db),
      ).resolves.toBeUndefined()
    })

    it('rejects check-in when reservation date is before business date (late arrival)', async () => {
      // 1. Set business date one day after the reservation
      await setBizDate('2026-06-16')
      // 2. Attempt check-in for yesterday's reservation – late arrival
      await expect(
        assertCheckInDate('2026-06-15', db),
      ).rejects.toThrow('Check-in is only allowed on the reservation\'s check-in date')
    })

    it('rejects check-in when reservation date is after business date (early arrival)', async () => {
      // 1. Set business date one day before the reservation
      await setBizDate('2026-06-14')
      // 2. Attempt check-in for tomorrow's reservation – early arrival
      await expect(
        assertCheckInDate('2026-06-15', db),
      ).rejects.toThrow('Check-in is only allowed on the reservation\'s check-in date')
    })

    it('includes both dates in the error message', async () => {
      // 1. Set business date far from the reservation date
      await setBizDate('2026-06-20')
      try {
        // 2. Attempt check-in – expect failure
        await assertCheckInDate('2026-06-15', db)
        expect.unreachable('should have thrown')
      } catch (e: any) {
        // Error mentions the reservation date
        expect(e.message).toContain('2026-06-15')
        // Error also mentions the current business date
        expect(e.message).toContain('2026-06-20')
      }
    })
  })

  describe('assertCheckInDate – integration with checkInReservation', () => {
    it('allows check-in when business date matches reservation check-in date', async () => {
      // 1. Set business date to the reservation's check-in day
      await setBizDate('2026-07-01')

      // 2. Create an available, clean room
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'clean',
      })
      // 3. Create a confirmed reservation starting today
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-03',
      })

      // 4. Perform the check-in
      const result = await checkInReservation(
        reservation.id,
        room.id,
        guestId,
        userId,
        db,
      )

      // Reservation flips to checked_in
      expect(result.reservation.status).toBe('checked_in')
      // Room becomes occupied
      expect(result.room.status).toBe('occupied')
    })

    it('rejects check-in when business date does not match', async () => {
      // 1. Set business date one day after the reservation's check-in
      await setBizDate('2026-07-02')

      // 2. Create an available, clean room
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'clean',
      })
      // 3. Create a confirmed reservation that started yesterday
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-03',
      })

      // 4. Attempt check-in – should be rejected
      await expect(
        checkInReservation(reservation.id, room.id, guestId, userId, db),
      ).rejects.toThrow('Check-in is only allowed on the reservation\'s check-in date')
    })
  })

  describe('assertInvoiceModifiable – date boundary', () => {
    it('allows modification when issue date equals business date', async () => {
      // 1. Set business date
      await setBizDate('2026-06-15')
      // 2. Create an invoice issued on the same day
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-15',
        status: 'issued',
        totalAmount: '100.00',
        balance: '100.00',
      })

      // 3. Verify the invoice is still modifiable
      // Should not throw
      await expect(
        assertInvoiceModifiable(invoice.id, db),
      ).resolves.toBeUndefined()
    })

    it('allows modification when issue date is after business date', async () => {
      // 1. Set business date to one day before the invoice
      await setBizDate('2026-06-14')
      // 2. Create an invoice issued in the future
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-15',
        status: 'issued',
        totalAmount: '100.00',
        balance: '100.00',
      })

      // Future-dated invoice is modifiable
      await expect(
        assertInvoiceModifiable(invoice.id, db),
      ).resolves.toBeUndefined()
    })

    it('rejects modification when issue date is before business date', async () => {
      // 1. Set business date one day after the invoice
      await setBizDate('2026-06-16')
      // 2. Create an invoice issued yesterday
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-15',
        status: 'issued',
        totalAmount: '100.00',
        balance: '100.00',
      })

      // Past invoice cannot be modified
      await expect(
        assertInvoiceModifiable(invoice.id, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })
  })

  describe('Date advancement makes previously-valid operations invalid', () => {
    it('addCharge succeeds on current date but fails after business date advances', async () => {
      // 1. Set business date and create a same-day invoice
      await setBizDate('2026-08-01')
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-08-01',
        status: 'issued',
        totalAmount: '100.00',
        balance: '100.00',
      })

      // 2. Add a charge while the invoice is current
      // Charge is allowed today
      const item = await addCharge(
        invoice.id,
        { itemType: 'minibar', description: 'Water', unitPrice: '5.00' },
        userId,
        db,
      )
      // Charge recorded successfully
      expect(item.itemType).toBe('minibar')

      // 3. Advance business date to the next day
      // Advance to next day
      await setBizDate('2026-08-02')

      // 4. Attempt the same operation – now the invoice is in the past
      // Same charge now rejected
      await expect(
        addCharge(
          invoice.id,
          { itemType: 'food', description: 'Snack', unitPrice: '10.00' },
          userId,
          db,
        ),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('recordPayment succeeds on current date but fails after date advances', async () => {
      // 1. Set business date and create a same-day invoice
      await setBizDate('2026-08-01')
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-08-01',
        status: 'issued',
        subtotal: '200.00',
        totalAmount: '200.00',
        balance: '200.00',
      })

      // 2. Record a partial payment while the invoice is current
      // Payment is allowed today
      const payment = await recordPayment(
        invoice.id,
        { amount: '100.00', paymentMethod: 'cash' },
        userId,
        db,
      )
      // Payment recorded successfully
      expect(payment.amount).toBe('100.00')

      // 3. Advance business date to the next day
      // Advance date
      await setBizDate('2026-08-02')

      // 4. Attempt another payment – now the invoice is in the past
      // Payment now rejected
      await expect(
        recordPayment(
          invoice.id,
          { amount: '100.00', paymentMethod: 'cash' },
          userId,
          db,
        ),
      ).rejects.toThrow('Cannot modify a past invoice')
    })
  })

  describe('setBusinessDate', () => {
    it('can set date forward', async () => {
      // 1. Set an initial business date
      await setBusinessDate('2026-01-01', db as any)
      // 2. Move it forward
      await setBusinessDate('2026-06-15', db as any)
      // 3. Verify the new date is persisted
      const date = await getBusinessDate(db as any)
      expect(date).toBe('2026-06-15')
    })

    it('can set date backward (e.g., corrections)', async () => {
      // 1. Set business date
      await setBusinessDate('2026-06-15', db as any)
      // 2. Move it backward (correction scenario)
      await setBusinessDate('2026-06-14', db as any)
      // 3. Verify the corrected date is persisted
      const date = await getBusinessDate(db as any)
      expect(date).toBe('2026-06-14')
    })

    it('is idempotent when setting same date', async () => {
      // 1. Set business date
      await setBusinessDate('2026-03-01', db as any)
      // 2. Set the same date again
      await setBusinessDate('2026-03-01', db as any)
      // 3. Verify no conflict or change
      const date = await getBusinessDate(db as any)
      expect(date).toBe('2026-03-01')
    })
  })
})
