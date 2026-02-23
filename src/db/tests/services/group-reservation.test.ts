import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTestDb, cleanupTestDb, type TestDb } from '../setup'
import {
  createTestUser,
  createTestGuest,
  createTestRoomType,
  createTestRoomInventory,
} from '../factories'
import { dateHelpers } from '../utils'
import {
  createGroupReservation,
  getGroupRoomingList,
  createGroupBlock,
  getBlockPickup,
  releaseGroupBlock,
} from '../../services/group-reservation'

let db: TestDb

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => { await cleanupTestDb(db) })

describe('group reservation service', () => {
  describe('createGroupReservation', () => {
    it('creates a reservation with multiple rooms and correct pax counts', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db) // contact person
      const rt1 = await createTestRoomType(db, {
        name: 'Standard',
        code: 'GRP_STD',
        maxOccupancy: 2,
      })
      const rt2 = await createTestRoomType(db, {
        name: 'Deluxe',
        code: 'GRP_DLX',
        maxOccupancy: 3,
      })

      const checkIn = dateHelpers.daysFromNow(10)
        const checkOut = dateHelpers.daysFromNow(13)

      for (let i = 10; i <= 12; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt1.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 10,
        })
        await createTestRoomInventory(db, {
          roomTypeId: rt2.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 5,
          available: 5,
        })
      }

      const result = await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Acme Corp Annual Retreat',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          rooms: [
            { roomTypeId: rt1.id, adultsCount: 1, dailyRate: '100.00' },
            { roomTypeId: rt1.id, adultsCount: 2, dailyRate: '100.00' },
            { roomTypeId: rt2.id, adultsCount: 3, dailyRate: '200.00' },
          ],
        },
        user.id,
        db,
      )

      expect((result as any).rooms).toHaveLength(3)
      expect((result as any).reservation.status).toBe('pending')
      expect((result as any).reservation.guestNameSnapshot).toBe('Acme Corp Annual Retreat')
        expect((result as any).reservation.adultsCount).toBe(6)
        expect((result as any).reservation.totalAmount).toBe('1200.00')
    })

    it('defaults adultsCount to room type maxOccupancy when not specified', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db, { maxOccupancy: 4 })

      const checkIn = dateHelpers.daysFromNow(20)
        const checkOut = dateHelpers.daysFromNow(21)

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 10,
      })

      const result = await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Wedding Party',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          rooms: [
            { roomTypeId: rt.id, dailyRate: '150.00' },
            { roomTypeId: rt.id, dailyRate: '150.00' },
          ],
        },
        user.id,
        db,
      )

      
      expect((result as any).reservation.adultsCount).toBe(8)
    })

    it('rejects when availability is insufficient', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)

      const checkIn = dateHelpers.daysFromNow(30)
      const checkOut = dateHelpers.daysFromNow(31)

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 2,
          available: 1,
      })

      await expect(
        createGroupReservation(
          {
            contactGuestId: guest.id,
            groupName: 'Too Large Group',
            checkInDate: checkIn,
            checkOutDate: checkOut,
            rooms: [
              { roomTypeId: rt.id, dailyRate: '100.00' },
              { roomTypeId: rt.id, dailyRate: '100.00' }, // needs 2 but only 1 available
            ],
          },
          user.id,
          db,
        ),
      ).rejects.toThrow('Insufficient availability')
    })

    it('allows overbooking when overbookingPercent permits', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)

      const checkIn = dateHelpers.daysFromNow(40)
      const checkOut = dateHelpers.daysFromNow(41)

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0, // fully sold
      })

      
      const result = await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Overbooked Corp',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          overbookingPercent: 110,
          rooms: [{ roomTypeId: rt.id, dailyRate: '100.00' }],
        },
        user.id,
        db,
      )

      expect(result.rooms).toHaveLength(1)
    })

    it('returns requiresConfirmation + warnings when mixing block and non-block rooms', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt1 = await createTestRoomType(db, { name: 'Standard', code: 'WARN_STD' })
      const rt2 = await createTestRoomType(db, { name: 'Deluxe', code: 'WARN_DLX' })

      const startDate = dateHelpers.daysFromNow(60)
      const endDate = dateHelpers.daysFromNow(63)

      for (let i = 60; i < 63; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt1.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 10,
        })
        await createTestRoomInventory(db, {
          roomTypeId: rt2.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 5,
          available: 5,
        })
      }

      const block = await createGroupBlock(rt1.id, startDate, endDate, 5, 'Test Block', user.id, db)

      const result = await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Mixed Group',
          checkInDate: startDate,
          checkOutDate: endDate,
          rooms: [
            { roomTypeId: rt1.id, blockId: block.id, dailyRate: '100.00' },
            { roomTypeId: rt2.id, dailyRate: '180.00' }, // no blockId — from inventory
          ],
        },
        user.id,
        db,
      )

      expect(result).toHaveProperty('requiresConfirmation', true)
      if ('warnings' in result) {
        expect(result.warnings).toHaveLength(1)
        expect((result.warnings as any[])[0].roomTypeId).toBe(rt2.id)
        expect((result.warnings as any[])[0].roomTypeName).toBe('Deluxe')
        expect((result.warnings as any[])[0].message).toContain('general available inventory')
      }
    })

    it('proceeds and creates the reservation when confirmed:true on mixed rooms', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt1 = await createTestRoomType(db, { name: 'Standard', code: 'CONF2_STD' })
      const rt2 = await createTestRoomType(db, { name: 'Deluxe', code: 'CONF2_DLX' })

      const startDate = dateHelpers.daysFromNow(70)
      const endDate = dateHelpers.daysFromNow(72)

      for (let i = 70; i < 72; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt1.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 10,
        })
        await createTestRoomInventory(db, {
          roomTypeId: rt2.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 5,
          available: 5,
        })
      }

      const block = await createGroupBlock(rt1.id, startDate, endDate, 5, 'Conf Block', user.id, db)

      const result = await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Confirmed Mixed Group',
          checkInDate: startDate,
          checkOutDate: endDate,
          confirmed: true,
          rooms: [
            { roomTypeId: rt1.id, blockId: block.id, dailyRate: '100.00' },
            { roomTypeId: rt2.id, dailyRate: '180.00' },
          ],
        },
        user.id,
        db,
      )

      expect('reservation' in result).toBe(true)
      if ('reservation' in result) {
        expect((result as any).rooms).toHaveLength(2)
        expect((result as any).reservation.status).toBe('pending')
      }
    })
  })

  describe('getGroupRoomingList', () => {
    it('returns rooming list with room type details', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)

      const checkIn = dateHelpers.daysFromNow(10)
      const checkOut = dateHelpers.daysFromNow(12)

      for (let i = 10; i <= 11; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 10,
        })
      }

      const result = await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Test Group',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          rooms: [
            { roomTypeId: rt.id, dailyRate: '100.00' },
            { roomTypeId: rt.id, dailyRate: '100.00' },
          ],
        },
        user.id,
        db,
      )

      const roomingList = await getGroupRoomingList((result as any).reservation.id, db)
      expect(roomingList).toHaveLength(2)
      expect(roomingList[0].roomTypeName).toBeTruthy()
      expect(roomingList[0].roomTypeCode).toBeTruthy()
    })
  })

  describe('block pickup tracking', () => {
    it('creates a block, tracks pickup via blockId, and releases un-picked-up inventory', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)

      const startDate = dateHelpers.daysFromNow(10)
      const endDate = dateHelpers.daysFromNow(15)

      for (let i = 10; i < 15; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 20,
          available: 20,
        })
      }

      const block = await createGroupBlock(
        rt.id,
        startDate,
        endDate,
        5,
        'Conference Group',
        user.id,
        db,
      )

      expect(block.blockType).toBe('group_hold')
      expect(block.quantity).toBe(5)

      
      const { checkAvailability } = await import('../../services/availability')
      const availAfterBlock = await checkAvailability(rt.id, startDate, endDate, db)
      expect(availAfterBlock.minAvailable).toBe(15) // 20 - 5 block

      
      const pickup0 = await getBlockPickup(block.id, db)
      expect(pickup0.pickedUp).toBe(0)
      expect(pickup0.total).toBe(5)
      expect(pickup0.remaining).toBe(5)

      const result = await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Conference Attendees',
          checkInDate: startDate,
          checkOutDate: endDate,
          rooms: [
            { roomTypeId: rt.id, blockId: block.id, dailyRate: '100.00' },
            { roomTypeId: rt.id, blockId: block.id, dailyRate: '100.00' },
            { roomTypeId: rt.id, blockId: block.id, dailyRate: '100.00' },
          ],
        },
        user.id,
        db,
      )

      expect(result.rooms).toHaveLength(3)

      
      const availAfterPickup = await checkAvailability(rt.id, startDate, endDate, db)
      expect(availAfterPickup.minAvailable).toBe(15)

      
      const pickup3 = await getBlockPickup(block.id, db)
      expect(pickup3.pickedUp).toBe(3)
      expect(pickup3.remaining).toBe(2) // 5 - 3

      
      await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Unrelated Group',
          checkInDate: startDate,
          checkOutDate: endDate,
          rooms: [{ roomTypeId: rt.id, dailyRate: '100.00' }],
        },
        user.id,
        db,
      )

      
      const availAfterUnrelated = await checkAvailability(rt.id, startDate, endDate, db)
      expect(availAfterUnrelated.minAvailable).toBe(14)

      
      const pickupStill3 = await getBlockPickup(block.id, db)
      expect(pickupStill3.pickedUp).toBe(3)

      
      const released = await releaseGroupBlock(block.id, user.id, db)
      expect(released.releasedAt).toBeTruthy()
      expect(released.releasedSlots).toBe(2)
      expect(released.pickedUp).toBe(3)

      
      const avail = await checkAvailability(rt.id, startDate, endDate, db)
      expect(avail.minAvailable).toBe(16)

      
      await expect(
        releaseGroupBlock(block.id, user.id, db),
      ).rejects.toThrow('block not found or already released')
    })
  })
})
