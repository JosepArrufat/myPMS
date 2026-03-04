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
  createTestRoomType,
  createTestRatePlan,
  createTestGuest,
  createTestInvoice,
  createTestReservation,
  createTestReservationRoom,
} from '../factories'

import { systemConfig } from '../../schema/system'

import {
  createTask,
  assignTask,
  generateDailyTaskBoard,
} from '../../services/housekeeping'

import {
  createRequest,
  assignRequest,
  putRoomOutOfOrder,
  updateOutOfOrderBlock,
} from '../../services/maintenance'

import {
  addCharge,
  removeCharge,
  recordPayment,
  processRefund,
} from '../../services/billing'

import {
  postCharge,
  transferCharge,
  splitFolio,
} from '../../services/folio'

import {
  setRoomTypeRate,
} from '../../services/rate-management'

import {
  createGroupBlock,
} from '../../services/group-reservation'

import {
  seedInventory,
} from '../../services/inventory'

import { invoiceItems, payments } from '../../schema/invoices'

const setTestBusinessDate = async (db: any, date: string) => {
  await db
    .insert(systemConfig)
    .values({ key: 'business_date', value: date })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: date },
    })
}

describe('Business-date guards', () => {
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


  describe('Housekeeping – past-date rejection', () => {
    it('rejects createTask with task date before business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room
      const room = await createTestRoom(db)

      // 3. Attempt to create a task dated one day before → should throw
      await expect(
        createTask(
          { roomId: room.id, taskDate: '2026-06-14', taskType: 'checkout_cleaning' },
          userId,
          db,
        ),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows createTask on the business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room
      const room = await createTestRoom(db)

      // 3. Create a task dated exactly on business date
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      // Task is accepted and starts as pending
      expect(task.status).toBe('pending')
    })

    it('rejects generateDailyTaskBoard for a past date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')

      // 2. Attempt to generate task board for June 10 → should throw
      await expect(
        generateDailyTaskBoard('2026-06-10', userId, db),
      ).rejects.toThrow('cannot be before the current business date')
    })
  })

  describe('Housekeeping – role rejection', () => {
    it('rejects front_desk user from HK task assignment', async () => {
      // 1. Set business date and create a room
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      // 2. Create a valid HK task
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      // 3. Create a front_desk user
      const frontDesk = await createTestUser(db, { role: 'front_desk' })

      // 4. Attempt to assign → role guard rejects
      await expect(
        assignTask(task.id, frontDesk.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects accountant from HK task assignment', async () => {
      // 1. Set business date and create a room
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      // 2. Create a valid HK task
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      // 3. Create an accountant user
      const accountant = await createTestUser(db, { role: 'accountant' })

      // 4. Attempt to assign → role guard rejects
      await expect(
        assignTask(task.id, accountant.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects sales user from HK task assignment', async () => {
      // 1. Set business date and create a room
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      // 2. Create a valid HK task
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      // 3. Create a sales user
      const sales = await createTestUser(db, { role: 'sales' })

      // 4. Attempt to assign → role guard rejects
      await expect(
        assignTask(task.id, sales.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects guest_services user from HK task assignment', async () => {
      // 1. Set business date and create a room
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      // 2. Create a valid HK task
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      // 3. Create a guest_services user
      const gs = await createTestUser(db, { role: 'guest_services' })

      // 4. Attempt to assign → role guard rejects
      await expect(
        assignTask(task.id, gs.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects maintenance user from HK task assignment', async () => {
      // 1. Set business date and create a room
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      // 2. Create a valid HK task
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      // 3. Create a maintenance user
      const maint = await createTestUser(db, { role: 'maintenance' })

      // 4. Attempt to assign → role guard rejects
      await expect(
        assignTask(task.id, maint.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('allows housekeeping user for HK task assignment', async () => {
      // 1. Set business date and create a room
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      // 2. Create a valid HK task
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      // 3. Create a housekeeping user (correct role)
      const hk = await createTestUser(db, { role: 'housekeeping' })

      // 4. Assign succeeds
      const assigned = await assignTask(task.id, hk.id, userId, db)
      // Status flips to assigned
      expect(assigned.status).toBe('assigned')
    })
  })

  
  describe('Maintenance – past-date rejection', () => {
    it('rejects createRequest with scheduled date before business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room
      const room = await createTestRoom(db)

      // 3. Attempt to create request scheduled for June 10 → should throw
      await expect(
        createRequest(
          { roomId: room.id, description: 'Fix AC', scheduledDate: '2026-06-10' },
          userId,
          db,
        ),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows createRequest without scheduled date (no guard needed)', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room
      const room = await createTestRoom(db)

      // 3. Create request with no scheduled date (guard is bypassed)
      const req = await createRequest(
        { roomId: room.id, description: 'Fix AC' },
        userId,
        db,
      )

      // Request accepted with open status
      expect(req.status).toBe('open')
    })

    it('rejects putRoomOutOfOrder with start date before business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room
      const room = await createTestRoom(db)

      // 3. Attempt OOO block starting June 10 → should throw
      await expect(
        putRoomOutOfOrder(room.id, '2026-06-10', '2026-06-20', 'Renovation', userId, db),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('rejects updateOutOfOrderBlock with new start date before business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room and a valid OOO block
      const room = await createTestRoom(db)
      const block = await putRoomOutOfOrder(
        room.id, '2026-06-15', '2026-06-20', 'Painting', userId, db,
      )

      // 3. Attempt to move block start to June 10 → should throw
      await expect(
        updateOutOfOrderBlock(block.id, { startDate: '2026-06-10' }, userId, db),
      ).rejects.toThrow('cannot be before the current business date')
    })
  })

  describe('Maintenance – role rejection', () => {
    it('rejects front_desk user from maintenance task assignment', async () => {
      // 1. Set business date and create a room
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      // 2. Create a maintenance request
      const req = await createRequest(
        { roomId: room.id, description: 'Fix light' },
        userId,
        db,
      )

      // 3. Create a front_desk user
      const frontDesk = await createTestUser(db, { role: 'front_desk' })

      // 4. Attempt to assign → role guard rejects
      await expect(
        assignRequest(req.id, frontDesk.id, userId, db),
      ).rejects.toThrow("cannot be assigned to maintenance tasks")
    })

    it('rejects housekeeping user from maintenance task assignment', async () => {
      // 1. Set business date and create a room
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      // 2. Create a maintenance request
      const req = await createRequest(
        { roomId: room.id, description: 'Fix light' },
        userId,
        db,
      )

      // 3. Create a housekeeping user
      const hk = await createTestUser(db, { role: 'housekeeping' })

      // 4. Attempt to assign → role guard rejects
      await expect(
        assignRequest(req.id, hk.id, userId, db),
      ).rejects.toThrow("cannot be assigned to maintenance tasks")
    })

    it('allows maintenance user for maintenance task assignment', async () => {
      // 1. Set business date and create a room
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      // 2. Create a maintenance request
      const req = await createRequest(
        { roomId: room.id, description: 'Fix light' },
        userId,
        db,
      )

      // 3. Create a maintenance user (correct role)
      const tech = await createTestUser(db, { role: 'maintenance' })

      // 4. Assign succeeds
      const assigned = await assignRequest(req.id, tech.id, userId, db)
      // Status flips to in_progress
      expect(assigned.status).toBe('in_progress')
    })
  })

  describe('Billing – past-invoice rejection', () => {
    it('rejects addCharge on a past-day invoice', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create an invoice dated June 10 (in the past)
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      // 3. Attempt to add a charge → past-invoice guard rejects
      await expect(
        addCharge(
          invoice.id,
          { itemType: 'minibar', description: 'Water', unitPrice: '5.00' },
          userId,
          db,
        ),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('allows addCharge on current-day invoice', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create an invoice dated today (June 15)
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-15',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      // 3. Add a charge — should succeed
      const item = await addCharge(
        invoice.id,
        { itemType: 'minibar', description: 'Water', unitPrice: '5.00' },
        userId,
        db,
      )

      // Charge recorded with correct type
      expect(item.itemType).toBe('minibar')
    })

    it('rejects removeCharge on a past-day invoice', async () => {
      // 1. Set business date to June 10 (so invoice is current)
      await setTestBusinessDate(db, '2026-06-10')
      // 2. Create invoice on June 10
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      // 3. Add a charge while invoice is still current
      const item = await addCharge(
        invoice.id,
        { itemType: 'minibar', description: 'Water', unitPrice: '5.00' },
        userId,
        db,
      )

      // 4. Advance business date to June 15 (invoice is now past)
      // Move business date forward
      await setTestBusinessDate(db, '2026-06-15')

      // 5. Attempt to remove the charge → past-invoice guard rejects
      await expect(
        removeCharge(item.id, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('rejects recordPayment on a past-day invoice', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create an invoice dated June 10 (in the past)
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      // 3. Attempt to record a payment → past-invoice guard rejects
      await expect(
        recordPayment(
          invoice.id,
          { amount: '50.00', paymentMethod: 'cash' },
          userId,
          db,
        ),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('allows processRefund on a past-day invoice (refunds are never blocked)', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a paid invoice dated June 10 (in the past)
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '200.00',
        totalAmount: '200.00',
        paidAmount: '200.00',
        balance: '0',
        status: 'paid',
      })

      // 3. Insert the original payment to refund against
      const [originalPayment] = await db
        .insert(payments)
        .values({
          invoiceId: invoice.id,
          amount: '200.00',
          paymentMethod: 'credit_card',
          isRefund: false,
          createdBy: userId,
        })
        .returning()

      // 4. Process a refund — refunds bypass the past-invoice guard
      const refund = await processRefund(
        invoice.id,
        originalPayment.id,
        '50.00',
        'late checkout refund',
        userId,
        db,
      )

      // Refund is recorded correctly
      expect(refund.isRefund).toBe(true)
      expect(refund.amount).toBe('50.00')
    })
  })

  describe('Folio – past-invoice rejection', () => {
    it('rejects postCharge on a past-day invoice', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create an invoice dated June 10 (in the past)
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      // 3. Attempt to post a folio charge → past-invoice guard rejects
      await expect(
        postCharge(
          invoice.id,
          { itemType: 'food', description: 'Lunch', unitPrice: '25.00' },
          userId,
          db,
        ),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('rejects transferCharge when source invoice is past', async () => {
      // 1. Set business date to June 10
      await setTestBusinessDate(db, '2026-06-10')

      // 2. Create source invoice on June 10 and add a charge
      const sourceInvoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      const item = await addCharge(
        sourceInvoice.id,
        { itemType: 'minibar', description: 'Snack', unitPrice: '10.00' },
        userId,
        db,
      )

      // 3. Create a future target invoice
      const targetInvoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-15',
        subtotal: '0',
        totalAmount: '0',
        balance: '0',
        status: 'draft',
      })

      // 4. Advance business date to June 15 (source invoice is now past)
      // Move business date forward
      await setTestBusinessDate(db, '2026-06-15')

      // 5. Attempt to transfer charge out of past invoice → should throw
      await expect(
        transferCharge(item.id, targetInvoice.id, userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('rejects splitFolio on a past-day invoice', async () => {
      // 1. Set business date to June 10
      await setTestBusinessDate(db, '2026-06-10')

      // 2. Create an invoice on June 10 and add a charge
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      const item = await addCharge(
        invoice.id,
        { itemType: 'minibar', description: 'Snack', unitPrice: '10.00' },
        userId,
        db,
      )

      // 3. Advance business date to June 15 (invoice is now past)
      // Move business date forward
      await setTestBusinessDate(db, '2026-06-15')

      // 4. Attempt to split the folio → past-invoice guard rejects
      await expect(
        splitFolio(invoice.id, [item.id], userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })
  })

  describe('Rate management – past-date rejection', () => {
    it('rejects setRoomTypeRate with start date before business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create room type and rate plan
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      // 3. Attempt to set rate starting June 10 → should throw
      await expect(
        setRoomTypeRate(roomType.id, ratePlan.id, '2026-06-10', '2026-06-20', '100.00', db as any),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows setRoomTypeRate with start date on business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create room type and rate plan
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      // 3. Set rate starting on business date — should succeed
      const rate = await setRoomTypeRate(
        roomType.id, ratePlan.id, '2026-06-15', '2026-06-20', '100.00', db as any,
      )

      // Rate saved with correct price
      expect(rate.price).toBe('100.00')
    })
  })

  describe('Group block – past-date rejection', () => {
    it('rejects createGroupBlock with start date before business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room type
      const roomType = await createTestRoomType(db)

      // 3. Attempt group block starting June 10 → should throw
      await expect(
        createGroupBlock(
          roomType.id, '2026-06-10', '2026-06-20', 5, 'Conference', userId, db as any,
        ),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows createGroupBlock with start date on business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room type
      const roomType = await createTestRoomType(db)

      // 3. Seed inventory (required for group block creation)
      // Need to seed inventory first for the group block
      const { seedInventory: seedInv } = await import('../../services/inventory')
      await seedInv(roomType.id, '2026-06-15', '2026-06-21', roomType.totalRooms, db as any)

      // 4. Create group block starting on business date — should succeed
      const block = await createGroupBlock(
        roomType.id, '2026-06-15', '2026-06-20', 3, 'Conference', userId, db as any,
      )

      // Block created with correct quantity and type
      expect(block.quantity).toBe(3)
      expect(block.blockType).toBe('group_hold')
    })
  })

  describe('Inventory – past-date rejection', () => {
    it('rejects seedInventory with start date before business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room type
      const roomType = await createTestRoomType(db)

      // 3. Attempt to seed inventory starting June 10 → should throw
      await expect(
        seedInventory(roomType.id, '2026-06-10', '2026-06-20', 25, db as any),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows seedInventory with start date on business date', async () => {
      // 1. Set business date to June 15
      await setTestBusinessDate(db, '2026-06-15')
      // 2. Create a room type
      const roomType = await createTestRoomType(db)

      // 3. Seed inventory starting on business date — should succeed
      const rows = await seedInventory(
        roomType.id, '2026-06-15', '2026-06-20', 25, db as any,
      )

      // 5 rows created (June 15–19, end date exclusive)
      expect(rows.length).toBe(5)
    })
  })
})
