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
import { systemConfig } from '../../schema/system'

// Business date is set to '2026-04-01', which is before all task dates ('2026-05-01')
// so happy-path operations (on future dates) succeed. Unhappy-path tests advance the
// date past the task date to confirm the guard fires.
const BUSINESS_DATE = '2026-04-01'

describe('Housekeeping services', () => {
  const db = getTestDb()
  let userId: number
  let assigneeId: number

  beforeEach(async () => {
    await cleanupTestDb(db)
    await db.insert(systemConfig)
      .values({ key: 'business_date', value: BUSINESS_DATE })
      .onConflictDoUpdate({ target: systemConfig.key, set: { value: BUSINESS_DATE } })
    const user = await createTestUser(db)
    userId = user.id
    const assignee = await createTestUser(db, { role: 'housekeeping' })
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

  describe('guard – rejects past-day operations', () => {
    const PAST_DATE = '2026-03-01' // before BUSINESS_DATE '2026-04-01'

    it('rejects createTask with a past taskDate (unhappy path)', async () => {
      const room = await createTestRoom(db)

      await expect(
        createTask({ roomId: room.id, taskDate: PAST_DATE, taskType: 'inspection' }, userId, db),
      ).rejects.toThrow('Task date')
    })

    it('allows createTask with a future taskDate (happy path)', async () => {
      const room = await createTestRoom(db)

      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'checkout_cleaning' },
        userId,
        db,
      )
      expect(task.taskDate).toBe('2026-05-01')
    })

    it('rejects generateDailyTaskBoard with a past date (unhappy path)', async () => {
      await createTestRoom(db, { cleanlinessStatus: 'dirty' })

      await expect(
        generateDailyTaskBoard(PAST_DATE, userId, db),
      ).rejects.toThrow('Task board date')
    })

    it('allows generateDailyTaskBoard with a future date (happy path)', async () => {
      await createTestRoom(db, { cleanlinessStatus: 'dirty' })

      const tasks = await generateDailyTaskBoard('2026-05-01', userId, db)
      expect(tasks).toHaveLength(1)
    })
  })

  describe('guard – role rejection for assignTask', () => {
    it('rejects assignTask for front_desk role (unhappy path)', async () => {
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      const fdUser = await createTestUser(db, { role: 'front_desk' })

      await expect(assignTask(task.id, fdUser.id, userId, db)).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects assignTask for accountant role (unhappy path)', async () => {
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      const acctUser = await createTestUser(db, { role: 'accountant' })

      await expect(assignTask(task.id, acctUser.id, userId, db)).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects assignTask for maintenance role (cross-dept, unhappy path)', async () => {
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      const maintUser = await createTestUser(db, { role: 'maintenance' })

      await expect(assignTask(task.id, maintUser.id, userId, db)).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('allows assignTask for housekeeping role (happy path)', async () => {
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      const hkUser = await createTestUser(db, { role: 'housekeeping' })

      const assigned = await assignTask(task.id, hkUser.id, userId, db)
      expect(assigned.assignedTo).toBe(hkUser.id)
    })

    it('allows assignTask for admin role (happy path)', async () => {
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      const adminUser = await createTestUser(db, { role: 'admin' })

      const assigned = await assignTask(task.id, adminUser.id, userId, db)
      expect(assigned.assignedTo).toBe(adminUser.id)
    })

    it('allows assignTask for manager role (happy path)', async () => {
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      const mgr = await createTestUser(db, { role: 'manager' })

      const assigned = await assignTask(task.id, mgr.id, userId, db)
      expect(assigned.assignedTo).toBe(mgr.id)
    })
  })
})
