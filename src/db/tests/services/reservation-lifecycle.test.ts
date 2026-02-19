import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest'

import { eq, and } from 'drizzle-orm'

import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../setup'

import {
  createTestUser,
  createTestGuest,
  createTestRoom,
  createTestReservation,
  createTestReservationRoom,
  createTestRoomType,
  createTestRoomInventory,
  createTestInvoice,
  createTestPayment,
  createTestRatePlan,
} from '../factories'

import {
  canTransition,
  confirmReservation,
  checkIn,
  checkOut,
  cancelReservation,
  markNoShow,
  detectNoShows,
  getReservationStatus,
} from '../../services/reservation-lifecycle'

import { rooms } from '../../schema/rooms'
import { roomInventory } from '../../schema/roomInventory'
import { payments } from '../../schema/invoices'
import { dateHelpers } from '../utils'

describe('Reservation lifecycle service', () => {
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

  describe('canTransition', () => {
    it('allows pending → confirmed', () => {
      expect(canTransition('pending', 'confirmed')).toBe(true)
    })

    it('allows pending → cancelled', () => {
      expect(canTransition('pending', 'cancelled')).toBe(true)
    })

    it('allows confirmed → checked_in', () => {
      expect(canTransition('confirmed', 'checked_in')).toBe(true)
    })

    it('allows confirmed → no_show', () => {
      expect(canTransition('confirmed', 'no_show')).toBe(true)
    })

    it('blocks pending → checked_in (must confirm first)', () => {
      expect(canTransition('pending', 'checked_in')).toBe(false)
    })

    it('blocks checked_out → checked_in (terminal state)', () => {
      expect(canTransition('checked_out', 'checked_in')).toBe(false)
    })

    it('blocks cancelled → confirmed (terminal state)', () => {
      expect(canTransition('cancelled', 'confirmed')).toBe(false)
    })
  })

  describe('confirmReservation', () => {
    it('transitions pending → confirmed', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'pending',
      })

      const result = await confirmReservation(reservation.id, userId, db)

      expect(result.status).toBe('confirmed')
    })

    it('rejects if not pending', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      await expect(
        confirmReservation(reservation.id, userId, db),
      ).rejects.toThrow('cannot be confirmed')
    })
  })

  describe('checkIn', () => {
    it('transitions confirmed → checked_in and marks room occupied', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'inspected',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      const result = await checkIn(reservation.id, room.id, userId, db)

      expect(result.reservation.status).toBe('checked_in')
      expect(result.room.status).toBe('occupied')
    })

    it('rejects if room is dirty', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'dirty',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      await expect(
        checkIn(reservation.id, room.id, userId, db),
      ).rejects.toThrow('not available or not clean')
    })

    it('rejects if reservation is pending (not confirmed)', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'clean',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'pending',
      })

      await expect(
        checkIn(reservation.id, room.id, userId, db),
      ).rejects.toThrow('not found or not confirmed')
    })
  })

  describe('checkOut', () => {
    it('transitions checked_in → checked_out, creates housekeeping task', async () => {
      const room = await createTestRoom(db, {
        status: 'occupied',
        cleanlinessStatus: 'clean',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'checked_in',
        checkOutDate: '2026-03-15',
      })

      const result = await checkOut(reservation.id, room.id, userId, db)

      expect(result.reservation.status).toBe('checked_out')
      expect(result.task.taskType).toBe('checkout_cleaning')
      expect(result.task.status).toBe('pending')

      const [updatedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(updatedRoom.cleanlinessStatus).toBe('dirty')
    })

    it('rejects if not checked in', async () => {
      const room = await createTestRoom(db)
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      await expect(
        checkOut(reservation.id, room.id, userId, db),
      ).rejects.toThrow('not checked in')
    })
  })

  describe('cancelReservation', () => {
    it('cancels and releases inventory', async () => {
      const roomType = await createTestRoomType(db)
      await createTestRoomInventory(db, {
        roomTypeId: roomType.id,
        date: '2026-03-01',
        capacity: 10,
        available: 9,
      })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-02',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-02',
      })

      const result = await cancelReservation(
        reservation.id,
        userId,
        'guest request',
        '0',
        db,
      )

      expect(result.status).toBe('cancelled')
      expect(result.cancellationReason).toBe('guest request')
    })

    it('issues refund minus cancellation fee', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      const invoice = await createTestInvoice(db, {
        reservationId: reservation.id,
        guestId,
        totalAmount: '200.00',
        paidAmount: '200.00',
        balance: '0',
        status: 'paid',
      })

      await createTestPayment(db, {
        invoiceId: invoice.id,
        amount: '200.00',
        paymentMethod: 'credit_card',
      })

      const result = await cancelReservation(
        reservation.id,
        userId,
        'change of plans',
        '50.00',
        db,
      )

      expect(result.status).toBe('cancelled')

      const refunds = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoice.id))

      const refundRow = refunds.find((p) => p.isRefund)
      expect(refundRow).toBeTruthy()
      expect(parseFloat(String(refundRow!.amount))).toBe(150)
    })

    it('rejects if already cancelled', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'cancelled',
      })

      await expect(
        cancelReservation(reservation.id, userId, 'too late', '0', db),
      ).rejects.toThrow('cannot be cancelled')
    })
  })

  describe('markNoShow', () => {
    it('marks confirmed reservation as no_show', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      const result = await markNoShow(reservation.id, userId, db)

      expect(result.status).toBe('no_show')
    })

    it('rejects if not confirmed', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'pending',
      })

      await expect(
        markNoShow(reservation.id, userId, db),
      ).rejects.toThrow('not confirmed')
    })
  })

  describe('detectNoShows', () => {
    it('auto-detects overdue confirmed reservations', async () => {
      const pastDate = dateHelpers.daysAgo(2)
      await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: pastDate,
        checkOutDate: dateHelpers.tomorrow(),
      })

      const results = await detectNoShows(dateHelpers.today(), userId, db)

      expect(results.length).toBe(1)
      expect(results[0].status).toBe('no_show')
    })

    it('ignores reservations with future check-in', async () => {
      await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: dateHelpers.daysFromNow(5),
        checkOutDate: dateHelpers.daysFromNow(8),
      })

      const results = await detectNoShows(dateHelpers.today(), userId, db)

      expect(results.length).toBe(0)
    })
  })

  describe('getReservationStatus', () => {
    it('returns status with allowed transitions', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      const result = await getReservationStatus(reservation.id, db)

      expect(result.status).toBe('confirmed')
      expect(result.allowedTransitions).toContain('checked_in')
      expect(result.allowedTransitions).toContain('cancelled')
      expect(result.allowedTransitions).toContain('no_show')
      expect(result.allowedTransitions).not.toContain('checked_out')
    })

    it('returns empty transitions for terminal states', async () => {
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'checked_out',
      })

      const result = await getReservationStatus(reservation.id, db)

      expect(result.allowedTransitions).toHaveLength(0)
    })
  })

  describe('Full orchestrated flow', () => {
    it('pending → confirmed → checked_in → checked_out', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'inspected',
      })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'pending',
        checkOutDate: '2026-04-10',
      })

      const confirmed = await confirmReservation(reservation.id, userId, db)
      expect(confirmed.status).toBe('confirmed')

      const { reservation: checkedIn } = await checkIn(
        reservation.id,
        room.id,
        userId,
        db,
      )
      expect(checkedIn.status).toBe('checked_in')

      const { reservation: checkedOut } = await checkOut(
        reservation.id,
        room.id,
        userId,
        db,
      )
      expect(checkedOut.status).toBe('checked_out')
    })
  })

  describe('cancelReservation – cancellation policy', () => {
    it('refundable rate within deadline → releases inventory & refunds', async () => {
      const ratePlan = await createTestRatePlan(db, {
        isNonRefundable: false,
        cancellationDeadlineHours: null,
        cancellationFeePercent: '0.00',
      })
      const roomType = await createTestRoomType(db)
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-01', capacity: 10, available: 9 })
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-02', capacity: 10, available: 9 })
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-03', capacity: 10, available: 9 })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        ratePlanId: ratePlan.id,
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-04',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-04',
      })

      const invoice = await createTestInvoice(db, {
        reservationId: reservation.id,
        guestId,
        totalAmount: '300.00',
        paidAmount: '300.00',
        balance: '0',
        status: 'paid',
      })
      await createTestPayment(db, { invoiceId: invoice.id, amount: '300.00', paymentMethod: 'credit_card' })

      const result = await cancelReservation(reservation.id, userId, 'plans changed', '0', db)
      expect(result.status).toBe('cancelled')

      const inv = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, '2026-06-01'))
      )
      expect(inv[0].available).toBe(10)

      const refunds = await db.select().from(payments).where(eq(payments.invoiceId, invoice.id))
      const refund = refunds.find((p) => p.isRefund)
      expect(refund).toBeTruthy()
      expect(parseFloat(String(refund!.amount))).toBe(300)
    })

    it('non-refundable rate → does NOT release inventory, no refund', async () => {
      const ratePlan = await createTestRatePlan(db, {
        isNonRefundable: true,
        cancellationDeadlineHours: null,
        cancellationFeePercent: '100.00',
      })
      const roomType = await createTestRoomType(db)
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-07-01', capacity: 10, available: 9 })
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-07-02', capacity: 10, available: 9 })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        ratePlanId: ratePlan.id,
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-03',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-03',
      })

      const invoice = await createTestInvoice(db, {
        reservationId: reservation.id,
        guestId,
        totalAmount: '200.00',
        paidAmount: '200.00',
        balance: '0',
        status: 'paid',
      })
      await createTestPayment(db, { invoiceId: invoice.id, amount: '200.00', paymentMethod: 'credit_card' })

      const result = await cancelReservation(reservation.id, userId, 'NRF cancel', '0', db)
      expect(result.status).toBe('cancelled')

      const inv = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, '2026-07-01'))
      )
      expect(inv[0].available).toBe(9)

      const refunds = await db.select().from(payments).where(eq(payments.invoiceId, invoice.id))
      const refund = refunds.find((p) => p.isRefund)
      expect(refund).toBeUndefined()
    })

    it('refundable rate past deadline → no release, no refund', async () => {
      const ratePlan = await createTestRatePlan(db, {
        isNonRefundable: false,
        cancellationDeadlineHours: 168,
        cancellationFeePercent: '100.00',
      })
      const roomType = await createTestRoomType(db)
      const checkIn = dateHelpers.tomorrow()
      const checkOut = dateHelpers.daysFromNow(3)

      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: checkIn, capacity: 10, available: 9 })
      await createTestRoomInventory(db, {
        roomTypeId: roomType.id,
        date: dateHelpers.daysFromNow(2),
        capacity: 10,
        available: 9,
      })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        ratePlanId: ratePlan.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      })
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      })

      const invoice = await createTestInvoice(db, {
        reservationId: reservation.id,
        guestId,
        totalAmount: '200.00',
        paidAmount: '200.00',
        balance: '0',
        status: 'paid',
      })
      await createTestPayment(db, { invoiceId: invoice.id, amount: '200.00', paymentMethod: 'credit_card' })

      const result = await cancelReservation(reservation.id, userId, 'too late', '0', db)
      expect(result.status).toBe('cancelled')

      const inv = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, checkIn))
      )
      expect(inv[0].available).toBe(9)

      const refunds = await db.select().from(payments).where(eq(payments.invoiceId, invoice.id))
      const refund = refunds.find((p) => p.isRefund)
      expect(refund).toBeUndefined()
    })

    it('no rate plan linked → fully refundable (releases inventory)', async () => {
      const roomType = await createTestRoomType(db)
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-08-01', capacity: 10, available: 9 })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        ratePlanId: null,
        checkInDate: '2026-08-01',
        checkOutDate: '2026-08-02',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-08-01',
        checkOutDate: '2026-08-02',
      })

      await cancelReservation(reservation.id, userId, 'no rate plan', '0', db)

      const inv = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, '2026-08-01'))
      )
      expect(inv[0].available).toBe(10) // released
    })
  })


  describe('markNoShow – cancellation policy', () => {
    it('refundable multi-night → releases nights 2+ only (first night penalty)', async () => {
      const ratePlan = await createTestRatePlan(db, {
        isNonRefundable: false,
        cancellationDeadlineHours: null,
      })
      const roomType = await createTestRoomType(db)
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-10', capacity: 10, available: 9 })
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-11', capacity: 10, available: 9 })
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-12', capacity: 10, available: 9 })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        ratePlanId: ratePlan.id,
        checkInDate: '2026-06-10',
        checkOutDate: '2026-06-13',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-06-10',
        checkOutDate: '2026-06-13',
      })

      const result = await markNoShow(reservation.id, userId, db)
      expect(result.status).toBe('no_show')

      const inv1 = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, '2026-06-10'))
      )
      expect(inv1[0].available).toBe(9)

      const inv2 = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, '2026-06-11'))
      )
      expect(inv2[0].available).toBe(10)

      const inv3 = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, '2026-06-12'))
      )
      expect(inv3[0].available).toBe(10)
    })

    it('refundable 1-night stay → no inventory released (first night = only night)', async () => {
      const ratePlan = await createTestRatePlan(db, {
        isNonRefundable: false,
        cancellationDeadlineHours: null,
      })
      const roomType = await createTestRoomType(db)
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-20', capacity: 10, available: 9 })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        ratePlanId: ratePlan.id,
        checkInDate: '2026-06-20',
        checkOutDate: '2026-06-21',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-06-20',
        checkOutDate: '2026-06-21',
      })

      const result = await markNoShow(reservation.id, userId, db)
      expect(result.status).toBe('no_show')

      // 1-night stay: first night IS the only night, so nothing released
      const inv = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, '2026-06-20'))
      )
      expect(inv[0].available).toBe(9)
    })

    it('non-refundable rate → NO inventory released at all', async () => {
      const ratePlan = await createTestRatePlan(db, {
        isNonRefundable: true,
        cancellationDeadlineHours: null,
        cancellationFeePercent: '100.00',
      })
      const roomType = await createTestRoomType(db)
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-07-10', capacity: 10, available: 9 })
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-07-11', capacity: 10, available: 9 })
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-07-12', capacity: 10, available: 9 })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        ratePlanId: ratePlan.id,
        checkInDate: '2026-07-10',
        checkOutDate: '2026-07-13',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-07-10',
        checkOutDate: '2026-07-13',
      })

      const result = await markNoShow(reservation.id, userId, db)
      expect(result.status).toBe('no_show')

      for (const date of ['2026-07-10', '2026-07-11', '2026-07-12']) {
        const inv = await db.select().from(roomInventory).where(
          and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, date))
        )
        expect(inv[0].available).toBe(9)
      }
    })

    it('NRF with deadline (NRF7) → no release when within deadline window', async () => {
      const ratePlan = await createTestRatePlan(db, {
        isNonRefundable: true,
        cancellationDeadlineHours: 168, // 7 days
        cancellationFeePercent: '100.00',
      })
      const roomType = await createTestRoomType(db)
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-09-01', capacity: 10, available: 9 })
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-09-02', capacity: 10, available: 9 })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        ratePlanId: ratePlan.id,
        checkInDate: '2026-09-01',
        checkOutDate: '2026-09-03',
      })
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: roomType.id,
        checkInDate: '2026-09-01',
        checkOutDate: '2026-09-03',
      })

      const result = await markNoShow(reservation.id, userId, db)
      expect(result.status).toBe('no_show')

      const inv = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, '2026-09-01'))
      )
      expect(inv[0].available).toBe(9)
      const inv2 = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomType.id), eq(roomInventory.date, '2026-09-02'))
      )
      expect(inv2[0].available).toBe(9)
    })

    it('multi-room no-show refundable → releases nights 2+ for each room type', async () => {
      const ratePlan = await createTestRatePlan(db, {
        isNonRefundable: false,
        cancellationDeadlineHours: null,
      })
      const roomTypeA = await createTestRoomType(db, { name: 'Standard' })
      const roomTypeB = await createTestRoomType(db, { name: 'Deluxe' })

      await createTestRoomInventory(db, { roomTypeId: roomTypeA.id, date: '2026-08-10', capacity: 10, available: 8 })
      await createTestRoomInventory(db, { roomTypeId: roomTypeA.id, date: '2026-08-11', capacity: 10, available: 8 })
      await createTestRoomInventory(db, { roomTypeId: roomTypeB.id, date: '2026-08-10', capacity: 5, available: 4 })
      await createTestRoomInventory(db, { roomTypeId: roomTypeB.id, date: '2026-08-11', capacity: 5, available: 4 })

      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        ratePlanId: ratePlan.id,
        checkInDate: '2026-08-10',
        checkOutDate: '2026-08-12',
      })
      await createTestReservationRoom(db, userId, { reservationId: reservation.id, roomTypeId: roomTypeA.id, checkInDate: '2026-08-10', checkOutDate: '2026-08-12' })
      await createTestReservationRoom(db, userId, { reservationId: reservation.id, roomTypeId: roomTypeA.id, checkInDate: '2026-08-10', checkOutDate: '2026-08-12' })
      await createTestReservationRoom(db, userId, { reservationId: reservation.id, roomTypeId: roomTypeB.id, checkInDate: '2026-08-10', checkOutDate: '2026-08-12' })

      const result = await markNoShow(reservation.id, userId, db)
      expect(result.status).toBe('no_show')

      const invA1 = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomTypeA.id), eq(roomInventory.date, '2026-08-10'))
      )
      expect(invA1[0].available).toBe(8) 
      const invB1 = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomTypeB.id), eq(roomInventory.date, '2026-08-10'))
      )
      expect(invB1[0].available).toBe(4) 

      const invA2 = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomTypeA.id), eq(roomInventory.date, '2026-08-11'))
      )
      expect(invA2[0].available).toBe(10)
      const invB2 = await db.select().from(roomInventory).where(
        and(eq(roomInventory.roomTypeId, roomTypeB.id), eq(roomInventory.date, '2026-08-11'))
      )
      expect(invB2[0].available).toBe(5) 
    })
  })
})
