import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest'

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
  createTask,
  assignTask,
  startTask,
  completeTask,
  generateDailyTaskBoard,
} from '../../services/housekeeping'

import { housekeepingTasks } from '../../schema/housekeeping'
import { rooms } from '../../schema/rooms'

describe('Housekeeping services', () => {
  const db = getTestDb()
  let userId: number
  let assigneeId: number

  beforeEach(async () => {
    await cleanupTestDb(db)
    const user = await createTestUser(db)
    userId = user.id
    const assignee = await createTestUser(db)
    assigneeId = assignee.id
  })

  afterAll(async () => {
    await cleanupTestDb(db)
    await verifyDbIsEmpty(db)
  })

  describe('createTask', () => {
    it('creates a pending housekeeping task', async () => {
      const room = await createTestRoom(db)

      const task = await createTask(
        {
          roomId: room.id,
          taskDate: '2026-05-01',
          taskType: 'checkout_cleaning',
          priority: 3,
        },
        userId,
        db,
      )

      expect(task.status).toBe('pending')
      expect(task.roomId).toBe(room.id)
      expect(task.taskType).toBe('checkout_cleaning')
      expect(task.priority).toBe(3)
      expect(task.createdBy).toBe(userId)
    })
  })

  describe('assignTask', () => {
    it('assigns task to a user', async () => {
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' },
        userId,
        db,
      )

      const assigned = await assignTask(task.id, assigneeId, userId, db)

      expect(assigned.status).toBe('assigned')
      expect(assigned.assignedTo).toBe(assigneeId)
    })

    it('rejects if task is not pending', async () => {
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' },
        userId,
        db,
      )

      await assignTask(task.id, assigneeId, userId, db)

      await expect(
        assignTask(task.id, assigneeId, userId, db),
      ).rejects.toThrow('not pending')
    })
  })

  describe('startTask', () => {
    it('transitions assigned task to in_progress', async () => {
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'deep_cleaning' },
        userId,
        db,
      )
      await assignTask(task.id, assigneeId, userId, db)

      const started = await startTask(task.id, assigneeId, db)

      expect(started.status).toBe('in_progress')
      expect(started.startedAt).toBeTruthy()
    })

    it('rejects if task is not assigned', async () => {
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'deep_cleaning' },
        userId,
        db,
      )

      await expect(
        startTask(task.id, userId, db),
      ).rejects.toThrow('not assigned')
    })
  })

  describe('completeTask', () => {
    it('transitions in_progress task to completed', async () => {
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'inspection' },
        userId,
        db,
      )
      await assignTask(task.id, assigneeId, userId, db)
      await startTask(task.id, assigneeId, db)

      const completed = await completeTask(task.id, assigneeId, db)

      expect(completed.status).toBe('completed')
      expect(completed.completedAt).toBeTruthy()
    })

    it('rejects if task is not in progress', async () => {
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'inspection' },
        userId,
        db,
      )

      await expect(
        completeTask(task.id, userId, db),
      ).rejects.toThrow('not in progress')
    })
  })

  describe('generateDailyTaskBoard', () => {
    it('creates tasks for all dirty rooms', async () => {
      await createTestRoom(db, { cleanlinessStatus: 'dirty' })
      await createTestRoom(db, { cleanlinessStatus: 'dirty' })
      await createTestRoom(db, { cleanlinessStatus: 'clean' })

      const tasks = await generateDailyTaskBoard('2026-05-01', userId, db)

      expect(tasks).toHaveLength(2)
      tasks.forEach((t: any) => {
        expect(t.taskType).toBe('checkout_cleaning')
        expect(t.status).toBe('pending')
        expect(t.taskDate).toBe('2026-05-01')
      })
    })

    it('returns empty when no dirty rooms', async () => {
      await createTestRoom(db, { cleanlinessStatus: 'clean' })

      const tasks = await generateDailyTaskBoard('2026-05-01', userId, db)

      expect(tasks).toHaveLength(0)
    })
  })
})
