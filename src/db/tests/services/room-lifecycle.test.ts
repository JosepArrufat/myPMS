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
      // 1. Create an occupied room with a checked-in reservation
      const room = await createTestRoom(db, {
        status: 'occupied',
        cleanlinessStatus: 'clean',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'checked_in',
        checkOutDate: '2026-03-15',
      })

      // 2. Check out the guest
      const result = await checkoutReservation(
        reservation.id,
        room.id,
        userId,
        db,
      )

      // Reservation should be checked_out with a timestamp
      expect(result.reservation.status).toBe('checked_out')
      expect(result.reservation.actualCheckOutTime).toBeTruthy()

      // 3. Re-read the room from DB
      const [updatedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      // Room should now be available but dirty
      expect(updatedRoom.status).toBe('available')
      expect(updatedRoom.cleanlinessStatus).toBe('dirty')

      // A pending checkout_cleaning HK task should exist
      expect(result.task.roomId).toBe(room.id)
      expect(result.task.taskType).toBe('checkout_cleaning')
      expect(result.task.status).toBe('pending')
      expect(result.task.taskDate).toBe('2026-03-15')
    })

    it('rejects if reservation is not checked in', async () => {
      // 1. Create a room and a confirmed (not checked-in) reservation
      const room = await createTestRoom(db)
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      // 2. Attempt checkout — should reject because status is confirmed
      await expect(
        checkoutReservation(reservation.id, room.id, userId, db),
      ).rejects.toThrow('not checked in')
    })

    it('does not modify room when reservation is invalid', async () => {
      // 1. Create an occupied, clean room
      const room = await createTestRoom(db, {
        status: 'occupied',
        cleanlinessStatus: 'clean',
      })
      const fakeId = '00000000-0000-0000-0000-000000000000'

      // 2. Attempt checkout with a non-existent reservation ID
      await expect(
        checkoutReservation(fakeId, room.id, userId, db),
      ).rejects.toThrow()

      // 3. Re-read the room from DB
      const [unchangedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      // Room should remain occupied and clean (no side effects)
      expect(unchangedRoom.status).toBe('occupied')
      expect(unchangedRoom.cleanlinessStatus).toBe('clean')
    })
  })

  describe('canCheckIn', () => {
    it('allows when room is available and clean', async () => {
      // 1. Create an available, clean room
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'clean',
      })

      // 2. Ask if check-in is allowed
      const result = await canCheckIn(room.id, db)

      // Should be allowed with no rejection reason
      expect(result.allowed).toBe(true)
      expect(result.reason).toBeNull()
    })

    it('allows when room is available and inspected', async () => {
      // 1. Create an available, inspected room
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'inspected',
      })

      // 2. Ask if check-in is allowed
      const result = await canCheckIn(room.id, db)

      // Inspected counts as clean — should be allowed
      expect(result.allowed).toBe(true)
    })

    it('rejects when room is dirty', async () => {
      // 1. Create an available but dirty room
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'dirty',
      })

      // 2. Ask if check-in is allowed
      const result = await canCheckIn(room.id, db)

      // Should be rejected — room needs cleaning first
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('room not clean')
    })

    it('rejects when room is occupied', async () => {
      // 1. Create an occupied room
      const room = await createTestRoom(db, {
        status: 'occupied',
      })

      // 2. Ask if check-in is allowed
      const result = await canCheckIn(room.id, db)

      // Should be rejected — room is already occupied
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('room not available')
    })

    it('rejects when room does not exist', async () => {
      // 1. Query canCheckIn with a non-existent room ID
      const result = await canCheckIn(999999, db)

      // Should be rejected — room not found
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('room not found')
    })
  })

  describe('checkInReservation', () => {
    it('marks reservation checked in and room occupied', async () => {
      // 1. Create an available, clean room and a confirmed reservation
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'clean',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      // 2. Check in the guest
      const result = await checkInReservation(
        reservation.id,
        room.id,
        guestId,
        userId,
        db,
      )

      // Reservation should be checked_in with a timestamp
      expect(result.reservation.status).toBe('checked_in')
      expect(result.reservation.actualCheckInTime).toBeTruthy()
      // Room should now be occupied
      expect(result.room.status).toBe('occupied')
    })

    it('rejects check-in to a dirty room', async () => {
      // 1. Create an available but dirty room and a confirmed reservation
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'dirty',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'confirmed',
      })

      // 2. Attempt check-in — should reject because room is dirty
      await expect(
        checkInReservation(reservation.id, room.id, guestId, userId, db),
      ).rejects.toThrow('not available or not clean')
    })

    it('rejects check-in when reservation is not confirmed', async () => {
      // 1. Create a clean room and a pending (not confirmed) reservation
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'clean',
      })
      const reservation = await createTestReservation(db, userId, {
        guestId,
        status: 'pending',
      })

      // 2. Attempt check-in — should reject because reservation is not confirmed
      await expect(
        checkInReservation(reservation.id, room.id, guestId, userId, db),
      ).rejects.toThrow('not found or not confirmed')
    })

    it('rolls back room to available when reservation update fails', async () => {
      // 1. Create an available, inspected room
      const room = await createTestRoom(db, {
        status: 'available',
        cleanlinessStatus: 'inspected',
      })
      const fakeId = '00000000-0000-0000-0000-000000000000'

      // 2. Attempt check-in with a non-existent reservation ID
      await expect(
        checkInReservation(fakeId, room.id, guestId, userId, db),
      ).rejects.toThrow()

      // 3. Re-read the room from DB
      const [unchangedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      // Room should roll back to its original state
      expect(unchangedRoom.status).toBe('available')
      expect(unchangedRoom.cleanlinessStatus).toBe('inspected')
    })
  })

  describe('inspectRoom', () => {
    it('marks task inspected and room cleanliness to inspected', async () => {
      // 1. Create a dirty room with a completed HK task
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

      // 2. Inspect the room
      const result = await inspectRoom(task.id, userId, db)

      // Task should be marked inspected with inspector info
      expect(result.status).toBe('inspected')
      expect(result.inspectedBy).toBe(userId)
      expect(result.inspectedAt).toBeTruthy()

      // 3. Re-read the room from DB
      const [updatedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      // Room cleanliness should now be inspected
      expect(updatedRoom.cleanlinessStatus).toBe('inspected')
    })

    it('rejects if task is not completed', async () => {
      // 1. Create a room with an in-progress HK task
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

      // 2. Attempt inspection — should reject because task is still in progress
      await expect(
        inspectRoom(task.id, userId, db),
      ).rejects.toThrow('not found or not completed')
    })
  })

  describe('Full lifecycle: check-in → check-out → inspect', () => {
    it('transitions room through the entire flow', async () => {
      // 1. Set up business date, an inspected room, and a confirmed reservation
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

      // 2. Check in the guest
      const checkInResult = await checkInReservation(
        reservation.id,
        room.id,
        guestId,
        userId,
        db,
      )

      // Reservation is checked_in, room is occupied
      expect(checkInResult.reservation.status).toBe('checked_in')
      expect(checkInResult.room.status).toBe('occupied')

      // 3. Check out the guest
      const checkoutResult = await checkoutReservation(
        reservation.id,
        room.id,
        userId,
        db,
      )

      expect(checkoutResult.reservation.status).toBe('checked_out')

      // 4. Verify room is now dirty
      const [dirtyRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(dirtyRoom.status).toBe('available')
      expect(dirtyRoom.cleanlinessStatus).toBe('dirty')

      // 5. Confirm check-in is blocked while room is dirty
      const blocked = await canCheckIn(room.id, db)
      expect(blocked.allowed).toBe(false)
      expect(blocked.reason).toBe('room not clean')

      // 6. Complete the housekeeping task
      await db
        .update(housekeepingTasks)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(housekeepingTasks.id, checkoutResult.task.id))

      // 7. Inspect the room
      await inspectRoom(
        checkoutResult.task.id,
        userId,
        db,
      )

      // 8. Verify room is ready for the next guest
      const [readyRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(readyRoom.cleanlinessStatus).toBe('inspected')

      // Check-in should now be allowed again
      const allowed = await canCheckIn(room.id, db)
      expect(allowed.allowed).toBe(true)
    })
  })
})
