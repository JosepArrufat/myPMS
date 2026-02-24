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
  createTestReservation,
} from '../factories'

import { checkoutReservation } from '../../services/checkout'
import { canCheckIn, checkInReservation } from '../../services/checkin'
import { inspectRoom } from '../../services/inspection'

import { rooms } from '../../schema/rooms'
import { housekeepingTasks } from '../../schema/housekeeping'
import { systemConfig } from '../../schema/system'

describe('Room lifecycle services', () => {
  const db = getTestDb()
  let userId: number
  let guestId: string

  // The factory default check-in date is '2026-02-10'.
  // Set the business date to match so assertCheckInDate passes.
  const BUSINESS_DATE = '2026-02-10'

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

  afterAll(async () => {
    await cleanupTestDb(db)
    await verifyDbIsEmpty(db)
  })

  describe('checkoutReservation', () => {
    it('sets room to dirty and creates a housekeeping task', async () => {
      const room = await createTestRoom(db, {
        status: 'occupied',
        cleanlinessStatus: 'clean',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'checked_in',
        checkOutDate: '2026-03-15',
      })

      const result = await checkoutReservation(
        reservation.id,
        room.id,
        userId,
        db,
      )

      expect(result.reservation.status).toBe('checked_out')
      expect(result.reservation.actualCheckOutTime).toBeTruthy()

      const [updatedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(updatedRoom.status).toBe('available')
      expect(updatedRoom.cleanlinessStatus).toBe('dirty')

      expect(result.task.roomId).toBe(room.id)
      expect(result.task.taskType).toBe('checkout_cleaning')
      expect(result.task.status).toBe('pending')
      expect(result.task.taskDate).toBe('2026-03-15')
    })

    it('rejects if reservation is not checked in', async () => {
      const room = await createTestRoom(db)
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      await expect(
        checkoutReservation(reservation.id, room.id, userId, db),
      ).rejects.toThrow('not checked in')
    })

    it('does not modify room when reservation is invalid', async () => {
      const room = await createTestRoom(db, {
        status: 'occupied',
        cleanlinessStatus: 'clean',
      })
      const fakeId = '00000000-0000-0000-0000-000000000000'

      await expect(
        checkoutReservation(fakeId, room.id, userId, db),
      ).rejects.toThrow()

      const [unchangedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(unchangedRoom.status).toBe('occupied')
      expect(unchangedRoom.cleanlinessStatus).toBe('clean')
    })
  })

  describe('canCheckIn', () => {
    it('allows when room is available and clean', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'clean',
      })

      const result = await canCheckIn(room.id, db)

      expect(result.allowed).toBe(true)
      expect(result.reason).toBeNull()
    })

    it('allows when room is available and inspected', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'inspected',
      })

      const result = await canCheckIn(room.id, db)

      expect(result.allowed).toBe(true)
    })

    it('rejects when room is dirty', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'dirty',
      })

      const result = await canCheckIn(room.id, db)

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('room not clean')
    })

    it('rejects when room is occupied', async () => {
      const room = await createTestRoom(db, {
        status: 'occupied',
      })

      const result = await canCheckIn(room.id, db)

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('room not available')
    })

    it('rejects when room does not exist', async () => {
      const result = await canCheckIn(999999, db)

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('room not found')
    })
  })

  describe('checkInReservation', () => {
    it('marks reservation checked in and room occupied', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'clean',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      const result = await checkInReservation(
        reservation.id,
        room.id,
        guestId,
        userId,
        db,
      )

      expect(result.reservation.status).toBe('checked_in')
      expect(result.reservation.actualCheckInTime).toBeTruthy()
      expect(result.room.status).toBe('occupied')
    })

    it('rejects check-in to a dirty room', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'dirty',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      await expect(
        checkInReservation(reservation.id, room.id, guestId, userId, db),
      ).rejects.toThrow('not available or not clean')
    })

    it('rejects check-in when reservation is not confirmed', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'clean',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'pending',
      })

      await expect(
        checkInReservation(reservation.id, room.id, guestId, userId, db),
      ).rejects.toThrow('not found or not confirmed')
    })

    it('rolls back room to available when reservation update fails', async () => {
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'inspected',
      })
      const fakeId = '00000000-0000-0000-0000-000000000000'

      await expect(
        checkInReservation(fakeId, room.id, guestId, userId, db),
      ).rejects.toThrow()

      const [unchangedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(unchangedRoom.status).toBe('available')
      expect(unchangedRoom.cleanlinessStatus).toBe('inspected')
    })
  })

  describe('inspectRoom', () => {
    it('marks task inspected and room cleanliness to inspected', async () => {
      const room = await createTestRoom(db, {
        cleanlinessStatus: 'dirty',
      })

      const [task] = await db
        .insert(housekeepingTasks)
        .values({
          roomId: room.id,
          taskDate: '2026-03-15',
          taskType: 'checkout_cleaning',
          status: 'completed',
          createdBy: userId,
        })
        .returning()

      const result = await inspectRoom(task.id, userId, db)

      expect(result.status).toBe('inspected')
      expect(result.inspectedBy).toBe(userId)
      expect(result.inspectedAt).toBeTruthy()

      const [updatedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(updatedRoom.cleanlinessStatus).toBe('inspected')
    })

    it('rejects if task is not completed', async () => {
      const room = await createTestRoom(db)

      const [task] = await db
        .insert(housekeepingTasks)
        .values({
          roomId: room.id,
          taskDate: '2026-03-15',
          taskType: 'checkout_cleaning',
          status: 'in_progress',
          createdBy: userId,
        })
        .returning()

      await expect(
        inspectRoom(task.id, userId, db),
      ).rejects.toThrow('not found or not completed')
    })
  })

  describe('Full lifecycle: check-in → check-out → inspect', () => {
    it('transitions room through the entire flow', async () => {
      // Override business date to match the lifecycle test's check-in date
      const LIFECYCLE_BD = '2026-03-10'
      await db
        .insert(systemConfig)
        .values({ key: 'business_date', value: LIFECYCLE_BD })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: LIFECYCLE_BD } })

      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'inspected',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
        checkInDate: '2026-03-10',
        checkOutDate: '2026-03-15',
      })

      const checkInResult = await checkInReservation(
        reservation.id,
        room.id,
        guestId,
        userId,
        db,
      )

      expect(checkInResult.reservation.status).toBe('checked_in')
      expect(checkInResult.room.status).toBe('occupied')

      const checkoutResult = await checkoutReservation(
        reservation.id,
        room.id,
        userId,
        db,
      )

      expect(checkoutResult.reservation.status).toBe('checked_out')

      const [dirtyRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(dirtyRoom.status).toBe('available')
      expect(dirtyRoom.cleanlinessStatus).toBe('dirty')

      const blocked = await canCheckIn(room.id, db)
      expect(blocked.allowed).toBe(false)
      expect(blocked.reason).toBe('room not clean')

      await db
        .update(housekeepingTasks)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(housekeepingTasks.id, checkoutResult.task.id))

      await inspectRoom(
        checkoutResult.task.id,
        userId,
        db,
      )

      const [readyRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(readyRoom.cleanlinessStatus).toBe('inspected')

      const allowed = await canCheckIn(room.id, db)
      expect(allowed.allowed).toBe(true)
    })
  })
})
