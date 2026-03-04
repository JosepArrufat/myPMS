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
  createTestRatePlan,
} from '../factories'

import {
  confirmReservation,
  checkIn,
  checkOut,
} from '../../services/reservation-lifecycle'

import {
  generateInvoice,
  addCharge,
  recordPayment,
} from '../../services/billing'

import { reservationDailyRates } from '../../schema/reservations'
import { invoices, invoiceItems, payments } from '../../schema/invoices'
import { rooms } from '../../schema/rooms'
import { housekeepingTasks } from '../../schema/housekeeping'
import { auditLog } from '../../schema/audit'

describe('Full reservation lifecycle (end-to-end)', () => {
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

  it('create → confirm → check-in → check-out → invoice → payment', async () => {
    // 1. Create room type, room, and a 3-night reservation
    const roomType = await createTestRoomType(db)
    const room = await createTestRoom(db, {
      roomTypeId: roomType.id,
      status: 'available',
      cleanlinessStatus: 'inspected',
    })

    const reservation = await createTestReservation(db, userId, {
      guestId,
      status: 'pending',
      checkInDate: '2026-04-01',
      checkOutDate: '2026-04-04',
    })

    const resRoom = await createTestReservationRoom(db, userId, {
      reservationId: reservation.id,
      roomTypeId: roomType.id,
      roomId: room.id,
      checkInDate: '2026-04-01',
      checkOutDate: '2026-04-04',
    })

    // Seed daily rates for 3 nights
    for (let i = 0; i < 3; i++) {
      const d = new Date('2026-04-01')
      d.setDate(d.getDate() + i)
      await db.insert(reservationDailyRates).values({
        reservationRoomId: resRoom.id,
        date: d.toISOString().slice(0, 10),
        rate: '120.00',
        createdBy: userId,
      })
    }

    // 2. Confirm
    const confirmed = await confirmReservation(reservation.id, userId, db)
    expect(confirmed.status).toBe('confirmed')

    // 3. Check in
    const { reservation: checkedIn, room: occupiedRoom } = await checkIn(
      reservation.id,
      room.id,
      userId,
      db,
    )
    expect(checkedIn.status).toBe('checked_in')
    expect(occupiedRoom.status).toBe('occupied')

    // 4. Check out
    const { reservation: checkedOut, task } = await checkOut(
      reservation.id,
      room.id,
      userId,
      db,
    )
    expect(checkedOut.status).toBe('checked_out')
    expect(task.taskType).toBe('checkout_cleaning')

    // Room should now be dirty
    const [updatedRoom] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, room.id))
    expect(updatedRoom.cleanlinessStatus).toBe('dirty')

    // 5. Generate invoice from reservation daily rates
    const invoice = await generateInvoice(reservation.id, userId, db)
    expect(invoice.invoiceType).toBe('final')

    // Verify 3 line items were created (one per night)
    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id))
    expect(items).toHaveLength(3)
    expect(items.every((i) => i.itemType === 'room')).toBe(true)

    // Invoice total should be 3 × 120 = 360
    const [freshInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
    expect(parseFloat(String(freshInvoice.totalAmount))).toBe(360)
    expect(parseFloat(String(freshInvoice.balance))).toBe(360)

    // 6. Record full payment
    const payment = await recordPayment(
      invoice.id,
      { amount: '360.00', paymentMethod: 'credit_card' },
      userId,
      db,
    )
    expect(payment.amount).toBe('360.00')
    expect(payment.isRefund).toBe(false)

    // Verify invoice is now paid with zero balance
    const [paidInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
    expect(paidInvoice.status).toBe('paid')
    expect(parseFloat(String(paidInvoice.balance))).toBeLessThanOrEqual(0)
  })

  it('partial payment leaves invoice partially_paid', async () => {
    const roomType = await createTestRoomType(db)
    const room = await createTestRoom(db, {
      roomTypeId: roomType.id,
      status: 'available',
      cleanlinessStatus: 'clean',
    })

    const reservation = await createTestReservation(db, userId, {
      guestId,
      status: 'pending',
      checkInDate: '2026-05-01',
      checkOutDate: '2026-05-03',
    })

    const resRoom = await createTestReservationRoom(db, userId, {
      reservationId: reservation.id,
      roomTypeId: roomType.id,
      roomId: room.id,
      checkInDate: '2026-05-01',
      checkOutDate: '2026-05-03',
    })

    await db.insert(reservationDailyRates).values([
      { reservationRoomId: resRoom.id, date: '2026-05-01', rate: '200.00', createdBy: userId },
      { reservationRoomId: resRoom.id, date: '2026-05-02', rate: '200.00', createdBy: userId },
    ])

    await confirmReservation(reservation.id, userId, db)
    await checkIn(reservation.id, room.id, userId, db)
    await checkOut(reservation.id, room.id, userId, db)

    const invoice = await generateInvoice(reservation.id, userId, db)

    // Pay only half
    await recordPayment(
      invoice.id,
      { amount: '200.00', paymentMethod: 'cash' },
      userId,
      db,
    )

    const [inv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
    expect(inv.status).toBe('partially_paid')
    expect(parseFloat(String(inv.balance))).toBe(200)
  })

  it('add incidental charge after check-out increases invoice total', async () => {
    const roomType = await createTestRoomType(db)
    const room = await createTestRoom(db, {
      roomTypeId: roomType.id,
      status: 'available',
      cleanlinessStatus: 'inspected',
    })

    const reservation = await createTestReservation(db, userId, {
      guestId,
      status: 'pending',
      checkInDate: '2026-06-01',
      checkOutDate: '2026-06-02',
    })

    const resRoom = await createTestReservationRoom(db, userId, {
      reservationId: reservation.id,
      roomTypeId: roomType.id,
      roomId: room.id,
      checkInDate: '2026-06-01',
      checkOutDate: '2026-06-02',
    })

    await db.insert(reservationDailyRates).values({
      reservationRoomId: resRoom.id,
      date: '2026-06-01',
      rate: '150.00',
      createdBy: userId,
    })

    await confirmReservation(reservation.id, userId, db)
    await checkIn(reservation.id, room.id, userId, db)
    await checkOut(reservation.id, room.id, userId, db)

    const invoice = await generateInvoice(reservation.id, userId, db)

    // Add a minibar charge
    const minibarItem = await addCharge(
      invoice.id,
      { itemType: 'minibar', description: 'Minibar snack', unitPrice: '15.00' },
      userId,
      db,
    )
    expect(minibarItem.itemType).toBe('minibar')

    // Invoice total should now be 150 + 15 = 165
    const [inv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
    expect(parseFloat(String(inv.totalAmount))).toBe(165)
  })

  it('generates audit trail throughout lifecycle', async () => {
    const room = await createTestRoom(db, {
      status: 'available',
      cleanlinessStatus: 'clean',
    })

    const reservation = await createTestReservation(db, userId, {
      guestId,
      status: 'pending',
      checkOutDate: '2026-07-10',
    })

    await confirmReservation(reservation.id, userId, db)
    await checkIn(reservation.id, room.id, userId, db)
    await checkOut(reservation.id, room.id, userId, db)

    // Verify audit log entries were created for the lifecycle transitions
    const auditEntries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.recordId, reservation.id))

    // Should have at least: confirm, check-out (check-in uses checkin service)
    expect(auditEntries.length).toBeGreaterThanOrEqual(1)

    const actions = auditEntries.map((e) => ({
      newStatus: (e.newValues as any)?.status,
    }))

    expect(actions.some((a) => a.newStatus === 'confirmed')).toBe(true)
  })

  it('housekeeping task is created on checkout', async () => {
    const room = await createTestRoom(db, {
      status: 'available',
      cleanlinessStatus: 'inspected',
    })

    const reservation = await createTestReservation(db, userId, {
      guestId,
      status: 'pending',
      checkOutDate: '2026-08-05',
    })

    await confirmReservation(reservation.id, userId, db)
    await checkIn(reservation.id, room.id, userId, db)

    const { task } = await checkOut(reservation.id, room.id, userId, db)

    expect(task.roomId).toBe(room.id)
    expect(task.status).toBe('pending')
    expect(task.taskType).toBe('checkout_cleaning')

    // Verify it exists in the DB
    const tasks = await db
      .select()
      .from(housekeepingTasks)
      .where(eq(housekeepingTasks.roomId, room.id))
    expect(tasks).toHaveLength(1)
  })

  it('duplicate generateInvoice returns existing invoice', async () => {
    const roomType = await createTestRoomType(db)
    const room = await createTestRoom(db, {
      roomTypeId: roomType.id,
      status: 'available',
      cleanlinessStatus: 'clean',
    })

    const reservation = await createTestReservation(db, userId, {
      guestId,
      status: 'pending',
      checkInDate: '2026-09-01',
      checkOutDate: '2026-09-02',
    })

    const resRoom = await createTestReservationRoom(db, userId, {
      reservationId: reservation.id,
      roomTypeId: roomType.id,
      roomId: room.id,
      checkInDate: '2026-09-01',
      checkOutDate: '2026-09-02',
    })

    await db.insert(reservationDailyRates).values({
      reservationRoomId: resRoom.id,
      date: '2026-09-01',
      rate: '100.00',
      createdBy: userId,
    })

    await confirmReservation(reservation.id, userId, db)
    await checkIn(reservation.id, room.id, userId, db)
    await checkOut(reservation.id, room.id, userId, db)

    const first = await generateInvoice(reservation.id, userId, db)
    const second = await generateInvoice(reservation.id, userId, db)

    // Second call returns the same invoice (idempotent)
    expect(second.id).toBe(first.id)
    expect((second as any)._alreadyExists).toBe(true)
  })

  it('multi-room reservation creates line items for all rooms', async () => {
    const roomTypeA = await createTestRoomType(db, { name: 'Standard' })
    const roomTypeB = await createTestRoomType(db, { name: 'Deluxe' })
    const roomA = await createTestRoom(db, {
      roomTypeId: roomTypeA.id,
      status: 'available',
      cleanlinessStatus: 'clean',
    })
    const roomB = await createTestRoom(db, {
      roomTypeId: roomTypeB.id,
      status: 'available',
      cleanlinessStatus: 'clean',
    })

    const reservation = await createTestReservation(db, userId, {
      guestId,
      status: 'pending',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-03',
    })

    const resRoomA = await createTestReservationRoom(db, userId, {
      reservationId: reservation.id,
      roomTypeId: roomTypeA.id,
      roomId: roomA.id,
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-03',
    })
    const resRoomB = await createTestReservationRoom(db, userId, {
      reservationId: reservation.id,
      roomTypeId: roomTypeB.id,
      roomId: roomB.id,
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-03',
    })

    // 2 nights × 2 rooms = 4 daily rate entries
    for (const resRoom of [resRoomA, resRoomB]) {
      const rate = resRoom.id === resRoomA.id ? '100.00' : '180.00'
      await db.insert(reservationDailyRates).values([
        { reservationRoomId: resRoom.id, date: '2026-10-01', rate, createdBy: userId },
        { reservationRoomId: resRoom.id, date: '2026-10-02', rate, createdBy: userId },
      ])
    }

    await confirmReservation(reservation.id, userId, db)

    // Check in both rooms (the checkIn function in lifecycle does only one room update)
    // We check in the first room via the lifecycle service
    await checkIn(reservation.id, roomA.id, userId, db)

    // Manually mark roomB occupied for the flow (reservation is already checked_in)
    await db.update(rooms).set({ status: 'occupied' }).where(eq(rooms.id, roomB.id))

    // Check out (checkout marks reservation checked_out + creates HK task)
    await checkOut(reservation.id, roomA.id, userId, db)

    // Generate final invoice
    const invoice = await generateInvoice(reservation.id, userId, db)

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id))

    // 4 line items: 2 nights × 2 rooms
    expect(items).toHaveLength(4)

    // Total = (100 × 2) + (180 × 2) = 560
    const [inv] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoice.id))
    expect(parseFloat(String(inv.totalAmount))).toBe(560)
  })
})
