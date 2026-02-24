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
  createTestRoom,
} from '../factories'

import {
  createRequest,
  assignRequest,
  completeRequest,
  putRoomOutOfOrder,
  returnRoomToService,
} from '../../services/maintenance'

import { rooms } from '../../schema/rooms'
import { roomBlocks } from '../../schema/reservations'
import { systemConfig } from '../../schema/system'

// Business date is '2026-05-01', before all future test dates (2026-06-xx).
// Unhappy-path tests use past dates or wrong roles.
const BUSINESS_DATE = '2026-05-01'

describe('Maintenance services', () => {
  const db = getTestDb()
  let userId: number
  let techId: number

  beforeEach(async () => {
    await cleanupTestDb(db)
    await db.insert(systemConfig)
      .values({ key: 'business_date', value: BUSINESS_DATE })
      .onConflictDoUpdate({ target: systemConfig.key, set: { value: BUSINESS_DATE } })
    const user = await createTestUser(db)
    userId = user.id
    const tech = await createTestUser(db, { role: 'maintenance' })
    techId = tech.id
  })

  afterAll(async () => {
    await cleanupTestDb(db)
    await verifyDbIsEmpty(db)
  })

  describe('createRequest', () => {
    it('creates an open maintenance request', async () => {
      const room = await createTestRoom(db)

      const request = await createRequest(
        {
          roomId: room.id,
          category: 'plumbing',
          priority: 'high',
          description: 'Leaking faucet in bathroom',
        },
        userId,
        db,
      )

      expect(request.status).toBe('open')
      expect(request.category).toBe('plumbing')
      expect(request.priority).toBe('high')
      expect(request.roomId).toBe(room.id)
    })
  })

  describe('assignRequest', () => {
    it('assigns request and sets in_progress', async () => {
      const room = await createTestRoom(db)
      const request = await createRequest(
        { roomId: room.id, description: 'Broken AC' },
        userId,
        db,
      )

      const assigned = await assignRequest(request.id, techId, userId, db)

      expect(assigned.status).toBe('in_progress')
      expect(assigned.assignedTo).toBe(techId)
      expect(assigned.startedAt).toBeTruthy()
    })

    it('rejects if request is not open', async () => {
      const room = await createTestRoom(db)
      const request = await createRequest(
        { roomId: room.id, description: 'Broken AC' },
        userId,
        db,
      )

      await assignRequest(request.id, techId, userId, db)

      await expect(
        assignRequest(request.id, techId, userId, db),
      ).rejects.toThrow('not open')
    })
  })

  describe('completeRequest', () => {
    it('completes request with resolution notes', async () => {
      const room = await createTestRoom(db)
      const request = await createRequest(
        { roomId: room.id, description: 'Light bulb out' },
        userId,
        db,
      )
      await assignRequest(request.id, techId, userId, db)

      const completed = await completeRequest(
        request.id,
        'Replaced bulb with LED',
        '15.00',
        techId,
        db,
      )

      expect(completed.status).toBe('completed')
      expect(completed.resolutionNotes).toBe('Replaced bulb with LED')
      expect(completed.cost).toBe('15.00')
      expect(completed.completedAt).toBeTruthy()
    })

    it('rejects if request is not in progress', async () => {
      const room = await createTestRoom(db)
      const request = await createRequest(
        { roomId: room.id, description: 'Test' },
        userId,
        db,
      )

      await expect(
        completeRequest(request.id, 'done', undefined, userId, db),
      ).rejects.toThrow('not in progress')
    })
  })

  describe('putRoomOutOfOrder', () => {
    it('sets room status to out_of_order and creates block', async () => {
      const room = await createTestRoom(db, { status: 'available' })

      const block = await putRoomOutOfOrder(
        room.id,
        '2026-06-01',
        '2026-06-05',
        'Bathroom renovation',
        userId,
        db,
      )

      expect(block.roomId).toBe(room.id)
      expect(block.blockType).toBe('maintenance')
      expect(block.reason).toBe('Bathroom renovation')

      const [updatedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(updatedRoom.status).toBe('out_of_order')
    })
  })

  describe('returnRoomToService', () => {
    it('sets room available/dirty and releases block', async () => {
      const room = await createTestRoom(db, { status: 'available' })

      // Use dates on or after the business date so the guard passes
      const startDate = BUSINESS_DATE // '2026-05-01'
      const nextWeek = '2026-05-08'

      await putRoomOutOfOrder(
        room.id,
        startDate,
        nextWeek,
        'Painting',
        userId,
        db,
      )

      await returnRoomToService(room.id, userId, db)

      const [updatedRoom] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, room.id))

      expect(updatedRoom.status).toBe('available')
      expect(updatedRoom.cleanlinessStatus).toBe('dirty')

      const blocks = await db
        .select()
        .from(roomBlocks)
        .where(eq(roomBlocks.roomId, room.id))

      expect(blocks[0].releasedAt).toBeTruthy()
      expect(blocks[0].releasedBy).toBe(userId)
    })
  })

  describe('guard – rejects past-day operations', () => {
    const PAST_DATE = '2026-04-01' // before BUSINESS_DATE '2026-05-01'

    it('rejects createRequest with a past scheduledDate (unhappy path)', async () => {
      const room = await createTestRoom(db)

      await expect(
        createRequest({ roomId: room.id, description: 'Leak', scheduledDate: PAST_DATE }, userId, db),
      ).rejects.toThrow('Scheduled date')
    })

    it('allows createRequest with a future scheduledDate (happy path)', async () => {
      const room = await createTestRoom(db)

      const req = await createRequest(
        { roomId: room.id, description: 'AC broken', scheduledDate: '2026-06-01' },
        userId,
        db,
      )
      expect(req.scheduledDate).toBe('2026-06-01')
    })

    it('allows createRequest with no scheduledDate (guard is skipped)', async () => {
      const room = await createTestRoom(db)

      const req = await createRequest({ roomId: room.id, description: 'General issue' }, userId, db)
      expect(req.status).toBe('open')
    })

    it('rejects putRoomOutOfOrder with a past startDate (unhappy path)', async () => {
      const room = await createTestRoom(db, { status: 'available' })

      await expect(
        putRoomOutOfOrder(room.id, PAST_DATE, '2026-06-15', 'Renovation', userId, db),
      ).rejects.toThrow('Out-of-order start date')
    })

    it('allows putRoomOutOfOrder with a future startDate (happy path)', async () => {
      const room = await createTestRoom(db, { status: 'available' })

      const block = await putRoomOutOfOrder(room.id, '2026-06-01', '2026-06-05', 'Renovation', userId, db)
      expect(block.blockType).toBe('maintenance')
    })
  })

  describe('guard – role rejection for assignRequest', () => {
    it('rejects assignRequest for housekeeping role (cross-dept, unhappy path)', async () => {
      const room = await createTestRoom(db)
      const req = await createRequest({ roomId: room.id, description: 'Fix AC' }, userId, db)
      const hkUser = await createTestUser(db, { role: 'housekeeping' })

      await expect(assignRequest(req.id, hkUser.id, userId, db)).rejects.toThrow("cannot be assigned to maintenance tasks")
    })

    it('rejects assignRequest for front_desk role (unhappy path)', async () => {
      const room = await createTestRoom(db)
      const req = await createRequest({ roomId: room.id, description: 'Fix AC' }, userId, db)
      const fdUser = await createTestUser(db, { role: 'front_desk' })

      await expect(assignRequest(req.id, fdUser.id, userId, db)).rejects.toThrow("cannot be assigned to maintenance tasks")
    })

    it('allows assignRequest for maintenance role (happy path)', async () => {
      const room = await createTestRoom(db)
      const req = await createRequest({ roomId: room.id, description: 'Fix AC' }, userId, db)

      const assigned = await assignRequest(req.id, techId, userId, db)
      expect(assigned.assignedTo).toBe(techId)
    })

    it('allows assignRequest for admin role (happy path)', async () => {
      const room = await createTestRoom(db)
      const req = await createRequest({ roomId: room.id, description: 'Fix AC' }, userId, db)
      const adminUser = await createTestUser(db, { role: 'admin' })

      const assigned = await assignRequest(req.id, adminUser.id, userId, db)
      expect(assigned.assignedTo).toBe(adminUser.id)
    })
  })
})
