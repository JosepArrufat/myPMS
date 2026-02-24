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
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)

      await expect(
        createTask(
          { roomId: room.id, taskDate: '2026-06-14', taskType: 'checkout_cleaning' },
          userId,
          db,
        ),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows createTask on the business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)

      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      expect(task.status).toBe('pending')
    })

    it('rejects generateDailyTaskBoard for a past date', async () => {
      await setTestBusinessDate(db, '2026-06-15')

      await expect(
        generateDailyTaskBoard('2026-06-10', userId, db),
      ).rejects.toThrow('cannot be before the current business date')
    })
  })

  describe('Housekeeping – role rejection', () => {
    it('rejects front_desk user from HK task assignment', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      const frontDesk = await createTestUser(db, { role: 'front_desk' })

      await expect(
        assignTask(task.id, frontDesk.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects accountant from HK task assignment', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      const accountant = await createTestUser(db, { role: 'accountant' })

      await expect(
        assignTask(task.id, accountant.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects sales user from HK task assignment', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      const sales = await createTestUser(db, { role: 'sales' })

      await expect(
        assignTask(task.id, sales.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects guest_services user from HK task assignment', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      const gs = await createTestUser(db, { role: 'guest_services' })

      await expect(
        assignTask(task.id, gs.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('rejects maintenance user from HK task assignment', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      const maint = await createTestUser(db, { role: 'maintenance' })

      await expect(
        assignTask(task.id, maint.id, userId, db),
      ).rejects.toThrow("cannot be assigned to housekeeping tasks")
    })

    it('allows housekeeping user for HK task assignment', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const task = await createTask(
        { roomId: room.id, taskDate: '2026-06-15', taskType: 'checkout_cleaning' },
        userId,
        db,
      )

      const hk = await createTestUser(db, { role: 'housekeeping' })

      const assigned = await assignTask(task.id, hk.id, userId, db)
      expect(assigned.status).toBe('assigned')
    })
  })

  
  describe('Maintenance – past-date rejection', () => {
    it('rejects createRequest with scheduled date before business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)

      await expect(
        createRequest(
          { roomId: room.id, description: 'Fix AC', scheduledDate: '2026-06-10' },
          userId,
          db,
        ),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows createRequest without scheduled date (no guard needed)', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)

      const req = await createRequest(
        { roomId: room.id, description: 'Fix AC' },
        userId,
        db,
      )

      expect(req.status).toBe('open')
    })

    it('rejects putRoomOutOfOrder with start date before business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)

      await expect(
        putRoomOutOfOrder(room.id, '2026-06-10', '2026-06-20', 'Renovation', userId, db),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('rejects updateOutOfOrderBlock with new start date before business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const block = await putRoomOutOfOrder(
        room.id, '2026-06-15', '2026-06-20', 'Painting', userId, db,
      )

      await expect(
        updateOutOfOrderBlock(block.id, { startDate: '2026-06-10' }, userId, db),
      ).rejects.toThrow('cannot be before the current business date')
    })
  })

  describe('Maintenance – role rejection', () => {
    it('rejects front_desk user from maintenance task assignment', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const req = await createRequest(
        { roomId: room.id, description: 'Fix light' },
        userId,
        db,
      )

      const frontDesk = await createTestUser(db, { role: 'front_desk' })

      await expect(
        assignRequest(req.id, frontDesk.id, userId, db),
      ).rejects.toThrow("cannot be assigned to maintenance tasks")
    })

    it('rejects housekeeping user from maintenance task assignment', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const req = await createRequest(
        { roomId: room.id, description: 'Fix light' },
        userId,
        db,
      )

      const hk = await createTestUser(db, { role: 'housekeeping' })

      await expect(
        assignRequest(req.id, hk.id, userId, db),
      ).rejects.toThrow("cannot be assigned to maintenance tasks")
    })

    it('allows maintenance user for maintenance task assignment', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const room = await createTestRoom(db)
      const req = await createRequest(
        { roomId: room.id, description: 'Fix light' },
        userId,
        db,
      )

      const tech = await createTestUser(db, { role: 'maintenance' })

      const assigned = await assignRequest(req.id, tech.id, userId, db)
      expect(assigned.status).toBe('in_progress')
    })
  })

  describe('Billing – past-invoice rejection', () => {
    it('rejects addCharge on a past-day invoice', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

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
      await setTestBusinessDate(db, '2026-06-15')
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-15',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

      const item = await addCharge(
        invoice.id,
        { itemType: 'minibar', description: 'Water', unitPrice: '5.00' },
        userId,
        db,
      )

      expect(item.itemType).toBe('minibar')
    })

    it('rejects removeCharge on a past-day invoice', async () => {
      await setTestBusinessDate(db, '2026-06-10')
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
        { itemType: 'minibar', description: 'Water', unitPrice: '5.00' },
        userId,
        db,
      )

      // Move business date forward
      await setTestBusinessDate(db, '2026-06-15')

      await expect(
        removeCharge(item.id, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('rejects recordPayment on a past-day invoice', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

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
      await setTestBusinessDate(db, '2026-06-15')
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '200.00',
        totalAmount: '200.00',
        paidAmount: '200.00',
        balance: '0',
        status: 'paid',
      })

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

      const refund = await processRefund(
        invoice.id,
        originalPayment.id,
        '50.00',
        'late checkout refund',
        userId,
        db,
      )

      expect(refund.isRefund).toBe(true)
      expect(refund.amount).toBe('50.00')
    })
  })

  describe('Folio – past-invoice rejection', () => {
    it('rejects postCharge on a past-day invoice', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const invoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-10',
        subtotal: '100.00',
        totalAmount: '100.00',
        balance: '100.00',
        status: 'issued',
      })

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
      await setTestBusinessDate(db, '2026-06-10')

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

      const targetInvoice = await createTestInvoice(db, {
        guestId,
        issueDate: '2026-06-15',
        subtotal: '0',
        totalAmount: '0',
        balance: '0',
        status: 'draft',
      })

      // Move business date forward
      await setTestBusinessDate(db, '2026-06-15')

      await expect(
        transferCharge(item.id, targetInvoice.id, userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })

    it('rejects splitFolio on a past-day invoice', async () => {
      await setTestBusinessDate(db, '2026-06-10')

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

      // Move business date forward
      await setTestBusinessDate(db, '2026-06-15')

      await expect(
        splitFolio(invoice.id, [item.id], userId, db),
      ).rejects.toThrow('Cannot modify a past invoice')
    })
  })

  describe('Rate management – past-date rejection', () => {
    it('rejects setRoomTypeRate with start date before business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      await expect(
        setRoomTypeRate(roomType.id, ratePlan.id, '2026-06-10', '2026-06-20', '100.00', db as any),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows setRoomTypeRate with start date on business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const roomType = await createTestRoomType(db)
      const ratePlan = await createTestRatePlan(db)

      const rate = await setRoomTypeRate(
        roomType.id, ratePlan.id, '2026-06-15', '2026-06-20', '100.00', db as any,
      )

      expect(rate.price).toBe('100.00')
    })
  })

  describe('Group block – past-date rejection', () => {
    it('rejects createGroupBlock with start date before business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const roomType = await createTestRoomType(db)

      await expect(
        createGroupBlock(
          roomType.id, '2026-06-10', '2026-06-20', 5, 'Conference', userId, db as any,
        ),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows createGroupBlock with start date on business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const roomType = await createTestRoomType(db)

      // Need to seed inventory first for the group block
      const { seedInventory: seedInv } = await import('../../services/inventory')
      await seedInv(roomType.id, '2026-06-15', '2026-06-21', roomType.totalRooms, db as any)

      const block = await createGroupBlock(
        roomType.id, '2026-06-15', '2026-06-20', 3, 'Conference', userId, db as any,
      )

      expect(block.quantity).toBe(3)
      expect(block.blockType).toBe('group_hold')
    })
  })

  describe('Inventory – past-date rejection', () => {
    it('rejects seedInventory with start date before business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const roomType = await createTestRoomType(db)

      await expect(
        seedInventory(roomType.id, '2026-06-10', '2026-06-20', 25, db as any),
      ).rejects.toThrow('cannot be before the current business date')
    })

    it('allows seedInventory with start date on business date', async () => {
      await setTestBusinessDate(db, '2026-06-15')
      const roomType = await createTestRoomType(db)

      const rows = await seedInventory(
        roomType.id, '2026-06-15', '2026-06-20', 25, db as any,
      )

      expect(rows.length).toBe(5)
    })
  })
})
