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
      // 1. Create a room for the task
      const room = await createTestRoom(db)

      // 2. Create a pending checkout-cleaning task on 2026-05-01
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

      // Task should be pending and assigned to the correct room
      expect(task.status).toBe('pending')
      expect(task.roomId).toBe(room.id)
      expect(task.taskType).toBe('checkout_cleaning')
      expect(task.priority).toBe(3)
      expect(task.createdBy).toBe(userId)
    })
  })

  describe('assignTask', () => {
    it('assigns task to a user', async () => {
      // 1. Create a room and a pending linen-change task
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' },
        userId,
        db,
      )

      // 2. Assign the task to the housekeeping user
      const assigned = await assignTask(task.id, assigneeId, userId, db)

      // Task should now be assigned to the correct user
      expect(assigned.status).toBe('assigned')
      expect(assigned.assignedTo).toBe(assigneeId)
    })

    it('rejects if task is not pending', async () => {
      // 1. Create a room and a pending linen-change task
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' },
        userId,
        db,
      )

      // 2. Assign the task once (moves it out of pending)
      await assignTask(task.id, assigneeId, userId, db)

      // 3. Try assigning again — should reject because it's no longer pending
      await expect(
        assignTask(task.id, assigneeId, userId, db),
      ).rejects.toThrow('not pending')
    })
  })

  describe('startTask', () => {
    it('transitions assigned task to in_progress', async () => {
      // 1. Create a room and a pending deep-cleaning task
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'deep_cleaning' },
        userId,
        db,
      )
      // 2. Assign the task to the housekeeping user
      await assignTask(task.id, assigneeId, userId, db)

      // 3. Start the task
      const started = await startTask(task.id, assigneeId, db)

      // Task should be in_progress with a startedAt timestamp
      expect(started.status).toBe('in_progress')
      expect(started.startedAt).toBeTruthy()
    })

    it('rejects if task is not assigned', async () => {
      // 1. Create a room and a pending deep-cleaning task (skip assignment)
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'deep_cleaning' },
        userId,
        db,
      )

      // 2. Try starting the unassigned task — should reject
      await expect(
        startTask(task.id, userId, db),
      ).rejects.toThrow('not assigned')
    })
  })

  describe('completeTask', () => {
    it('transitions in_progress task to completed', async () => {
      // 1. Create a room and a pending inspection task
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'inspection' },
        userId,
        db,
      )
      // 2. Assign and start the task
      await assignTask(task.id, assigneeId, userId, db)
      await startTask(task.id, assigneeId, db)

      // 3. Complete the task
      const completed = await completeTask(task.id, assigneeId, db)

      // Task should be completed with a completedAt timestamp
      expect(completed.status).toBe('completed')
      expect(completed.completedAt).toBeTruthy()
    })

    it('rejects if task is not in progress', async () => {
      // 1. Create a room and a pending inspection task (skip assign/start)
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'inspection' },
        userId,
        db,
      )

      // 2. Try completing directly — should reject
      await expect(
        completeTask(task.id, userId, db),
      ).rejects.toThrow('not in progress')
    })
  })

  describe('generateDailyTaskBoard', () => {
    it('creates tasks for all dirty rooms', async () => {
      // 1. Create 2 dirty rooms and 1 clean room
      await createTestRoom(db, { cleanlinessStatus: 'dirty' })
      await createTestRoom(db, { cleanlinessStatus: 'dirty' })
      await createTestRoom(db, { cleanlinessStatus: 'clean' })

      // 2. Generate the daily task board for 2026-05-01
      const tasks = await generateDailyTaskBoard('2026-05-01', userId, db)

      // Should create exactly 2 pending checkout-cleaning tasks (one per dirty room)
      expect(tasks).toHaveLength(2)
      tasks.forEach((t: any) => {
        expect(t.taskType).toBe('checkout_cleaning')
        expect(t.status).toBe('pending')
        expect(t.taskDate).toBe('2026-05-01')
      })
    })

    it('returns empty when no dirty rooms', async () => {
      // 1. Create a single clean room
      await createTestRoom(db, { cleanlinessStatus: 'clean' })

      // 2. Generate the daily task board
      const tasks = await generateDailyTaskBoard('2026-05-01', userId, db)

      // No tasks should be created
      expect(tasks).toHaveLength(0)
    })
  })

  describe('guard – rejects past-day operations', () => {
    const PAST_DATE = '2026-03-01' // before BUSINESS_DATE '2026-04-01'

    it('rejects createTask with a past taskDate (unhappy path)', async () => {
      // 1. Create a room
      const room = await createTestRoom(db)

      // 2. Try creating a task with a past date — should reject
      await expect(
        createTask({ roomId: room.id, taskDate: PAST_DATE, taskType: 'inspection' }, userId, db),
      ).rejects.toThrow('Task date')
    })

    it('allows createTask with a future taskDate (happy path)', async () => {
      // 1. Create a room
      const room = await createTestRoom(db)

      // 2. Create a task with a future date — should succeed
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-05-01', taskType: 'checkout_cleaning' },
        userId,
        db,
      )
      expect(task.taskDate).toBe('2026-05-01')
    })

    it('rejects generateDailyTaskBoard with a past date (unhappy path)', async () => {
      // 1. Create a dirty room
      await createTestRoom(db, { cleanlinessStatus: 'dirty' })

      // 2. Try generating the task board for a past date — should reject
      await expect(
        generateDailyTaskBoard(PAST_DATE, userId, db),
      ).rejects.toThrow('Task board date')
    })

    it('allows generateDailyTaskBoard with a future date (happy path)', async () => {
      // 1. Create a dirty room
      await createTestRoom(db, { cleanlinessStatus: 'dirty' })

      // 2. Generate the task board for a future date — should succeed
      const tasks = await generateDailyTaskBoard('2026-05-01', userId, db)
      expect(tasks).toHaveLength(1)
    })
  })

  describe('guard – role rejection for assignTask', () => {
    it('rejects assignTask for front_desk role (unhappy path)', async () => {
      // 1. Create a room and a pending linen-change task
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      // 2. Create a front_desk user
      const fdUser = await createTestUser(db, { role: 'front_desk' })

      // 3. Try assigning to front_desk user — should reject (wrong role)
      await expect(assignTask(task.id, fdUser.id, userId, db)).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects assignTask for accountant role (unhappy path)', async () => {
      // 1. Create a room and a pending linen-change task
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      // 2. Create an accountant user
      const acctUser = await createTestUser(db, { role: 'accountant' })

      // 3. Try assigning to accountant user — should reject (wrong role)
      await expect(assignTask(task.id, acctUser.id, userId, db)).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects assignTask for maintenance role (cross-dept, unhappy path)', async () => {
      // 1. Create a room and a pending linen-change task
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      // 2. Create a maintenance user (different department)
      const maintUser = await createTestUser(db, { role: 'maintenance' })

      // 3. Try assigning to maintenance user — should reject (cross-department)
      await expect(assignTask(task.id, maintUser.id, userId, db)).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('allows assignTask for housekeeping role (happy path)', async () => {
      // 1. Create a room and a pending linen-change task
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      // 2. Create a housekeeping user
      const hkUser = await createTestUser(db, { role: 'housekeeping' })

      // 3. Assign the task — should succeed (matching department)
      const assigned = await assignTask(task.id, hkUser.id, userId, db)
      expect(assigned.assignedTo).toBe(hkUser.id)
    })

    it('allows assignTask for admin role (happy path)', async () => {
      // 1. Create a room and a pending linen-change task
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      // 2. Create an admin user
      const adminUser = await createTestUser(db, { role: 'admin' })

      // 3. Assign the task — should succeed (admin has full access)
      const assigned = await assignTask(task.id, adminUser.id, userId, db)
      expect(assigned.assignedTo).toBe(adminUser.id)
    })

    it('allows assignTask for manager role (happy path)', async () => {
      // 1. Create a room and a pending linen-change task
      const room = await createTestRoom(db)
      const task = await createTask({ roomId: room.id, taskDate: '2026-05-01', taskType: 'linen_change' }, userId, db)
      // 2. Create a manager user
      const mgr = await createTestUser(db, { role: 'manager' })

      // 3. Assign the task — should succeed (manager has full access)
      const assigned = await assignTask(task.id, mgr.id, userId, db)
      expect(assigned.assignedTo).toBe(mgr.id)
    })
  })
})
