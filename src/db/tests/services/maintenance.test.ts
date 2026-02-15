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

describe('Maintenance services', () => {
  const db = getTestDb()
  let userId: number
  let techId: number

  beforeEach(async () => {
    await cleanupTestDb(db)
    const user = await createTestUser(db)
    userId = user.id
    const tech = await createTestUser(db)
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

      await putRoomOutOfOrder(
        room.id,
        '2026-07-01',
        '2026-07-05',
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
})
