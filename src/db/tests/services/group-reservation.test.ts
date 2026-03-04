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
import { systemConfig } from '../../schema/system'

let db: TestDb
// Business date = today (real calendar date). All test dates use daysFromNow(10+)
// so they are always in the future. Unhappy paths use yesterday.
const BUSINESS_DATE = new Date().toISOString().slice(0, 10)
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => {
  await cleanupTestDb(db)
  await db.insert(systemConfig)
    .values({ key: 'business_date', value: BUSINESS_DATE })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value: BUSINESS_DATE } })
})

describe('group reservation service', () => {
  describe('createGroupReservation', () => {
    it('creates a reservation with multiple rooms and correct pax counts', async () => {
      // 1. Create a user, guest (contact), and two room types
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

      // 2. Seed inventory for both room types across the 3-night stay
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

      // 3. Create a group reservation with 3 rooms (2 Std + 1 Dlx)
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

      // Expect 3 rooms, pending status, group name, summed pax, and correct total
      expect((result as any).rooms).toHaveLength(3)
      expect((result as any).reservation.status).toBe('pending')
      expect((result as any).reservation.guestNameSnapshot).toBe('Acme Corp Annual Retreat')
        expect((result as any).reservation.adultsCount).toBe(6)
        expect((result as any).reservation.totalAmount).toBe('1200.00')
    })

    it('defaults adultsCount to room type maxOccupancy when not specified', async () => {
      // 1. Create user, guest, and a room type with maxOccupancy = 4
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db, { maxOccupancy: 4 })

      const checkIn = dateHelpers.daysFromNow(20)
        const checkOut = dateHelpers.daysFromNow(21)

      // 2. Seed one night of inventory
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 10,
      })

      // 3. Create group with 2 rooms, omitting adultsCount
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

      
      // Expect adultsCount defaults to 4 + 4 = 8
      expect((result as any).reservation.adultsCount).toBe(8)
    })

    it('rejects when availability is insufficient', async () => {
      // 1. Create user, guest, and room type
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)

      const checkIn = dateHelpers.daysFromNow(30)
      const checkOut = dateHelpers.daysFromNow(31)

      // 2. Seed inventory with only 1 room available
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 2,
          available: 1,
      })

      // 3. Attempt to book 2 rooms — should fail
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
      // 1. Create user, guest, and room type
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)

      const checkIn = dateHelpers.daysFromNow(40)
      const checkOut = dateHelpers.daysFromNow(41)

      // 2. Seed inventory with 0 rooms available (fully sold)
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 0, // fully sold
      })

      
      // 3. Book 1 room with overbookingPercent=110 — should succeed
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

      // Expect room created despite zero availability
      expect(result.rooms).toHaveLength(1)
    })

    it('returns requiresConfirmation + warnings when mixing block and non-block rooms', async () => {
      // 1. Create user, guest, and two room types
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt1 = await createTestRoomType(db, { name: 'Standard', code: 'WARN_STD' })
      const rt2 = await createTestRoomType(db, { name: 'Deluxe', code: 'WARN_DLX' })

      const startDate = dateHelpers.daysFromNow(60)
      const endDate = dateHelpers.daysFromNow(63)

      // 2. Seed inventory for both room types across the date range
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

      // 3. Create a group block on the Standard type
      const block = await createGroupBlock(rt1.id, startDate, endDate, 5, 'Test Block', user.id, db)

      // 4. Create group reservation mixing block room + non-block room
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

      // Expect requiresConfirmation flag and a warning for the non-block room
      expect(result).toHaveProperty('requiresConfirmation', true)
      if ('warnings' in result) {
        expect(result.warnings).toHaveLength(1)
        expect((result.warnings as any[])[0].roomTypeId).toBe(rt2.id)
        expect((result.warnings as any[])[0].roomTypeName).toBe('Deluxe')
        expect((result.warnings as any[])[0].message).toContain('general available inventory')
      }
    })

    it('proceeds and creates the reservation when confirmed:true on mixed rooms', async () => {
      // 1. Create user, guest, and two room types
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt1 = await createTestRoomType(db, { name: 'Standard', code: 'CONF2_STD' })
      const rt2 = await createTestRoomType(db, { name: 'Deluxe', code: 'CONF2_DLX' })

      const startDate = dateHelpers.daysFromNow(70)
      const endDate = dateHelpers.daysFromNow(72)

      // 2. Seed inventory for both room types
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

      // 3. Create a group block on the Standard type
      const block = await createGroupBlock(rt1.id, startDate, endDate, 5, 'Conf Block', user.id, db)

      // 4. Create group reservation with confirmed:true on mixed rooms
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

      // Expect reservation created successfully with 2 rooms, status pending
      expect('reservation' in result).toBe(true)
      if ('reservation' in result) {
        expect((result as any).rooms).toHaveLength(2)
        expect((result as any).reservation.status).toBe('pending')
      }
    })
  })

  describe('getGroupRoomingList', () => {
    it('returns rooming list with room type details', async () => {
      // 1. Create user, guest, and room type
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)

      const checkIn = dateHelpers.daysFromNow(10)
      const checkOut = dateHelpers.daysFromNow(12)

      // 2. Seed inventory for the 2-night stay
      for (let i = 10; i <= 11; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 10,
          available: 10,
        })
      }

      // 3. Create a group reservation with 2 rooms
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

      // 4. Fetch the rooming list for the reservation
      const roomingList = await getGroupRoomingList((result as any).reservation.id, db)
      // Expect 2 entries with room type name and code populated
      expect(roomingList).toHaveLength(2)
      expect(roomingList[0].roomTypeName).toBeTruthy()
      expect(roomingList[0].roomTypeCode).toBeTruthy()
    })
  })

  describe('block pickup tracking', () => {
    it('creates a block, tracks pickup via blockId, and releases un-picked-up inventory', async () => {
      // 1. Create user, guest, and room type
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)

      const startDate = dateHelpers.daysFromNow(10)
      const endDate = dateHelpers.daysFromNow(15)

      // 2. Seed 5 nights of inventory (20 rooms each)
      for (let i = 10; i < 15; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 20,
          available: 20,
        })
      }

      // 3. Create a group block holding 5 rooms
      const block = await createGroupBlock(
        rt.id,
        startDate,
        endDate,
        5,
        'Conference Group',
        user.id,
        db,
      )

      // Expect block type and quantity
      expect(block.blockType).toBe('group_hold')
      expect(block.quantity).toBe(5)

      
      // 4. Verify availability dropped by 5 (20 → 15)
      const { checkAvailability } = await import('../../services/availability')
      const availAfterBlock = await checkAvailability(rt.id, startDate, endDate, db)
      expect(availAfterBlock.minAvailable).toBe(15) // 20 - 5 block

      
      // 5. Confirm initial pickup is 0 of 5
      const pickup0 = await getBlockPickup(block.id, db)
      expect(pickup0.pickedUp).toBe(0)
      expect(pickup0.total).toBe(5)
      expect(pickup0.remaining).toBe(5)

      // 6. Pick up 3 rooms from the block
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

      // Expect 3 rooms created
      expect(result.rooms).toHaveLength(3)

      
      // 7. Availability unchanged at 15 (block rooms, not general inventory)
      const availAfterPickup = await checkAvailability(rt.id, startDate, endDate, db)
      expect(availAfterPickup.minAvailable).toBe(15)

      
      // 8. Pickup is now 3, remaining is 2
      const pickup3 = await getBlockPickup(block.id, db)
      expect(pickup3.pickedUp).toBe(3)
      expect(pickup3.remaining).toBe(2) // 5 - 3

      
      // 9. Book 1 room outside the block (from general inventory)
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

      
      // 10. General availability drops to 14
      const availAfterUnrelated = await checkAvailability(rt.id, startDate, endDate, db)
      expect(availAfterUnrelated.minAvailable).toBe(14)

      
      // 11. Block pickup unchanged at 3
      const pickupStill3 = await getBlockPickup(block.id, db)
      expect(pickupStill3.pickedUp).toBe(3)

      
      // 12. Release the block — returns 2 un-picked-up slots
      const released = await releaseGroupBlock(block.id, user.id, db)
      expect(released.releasedAt).toBeTruthy()
      expect(released.releasedSlots).toBe(2)
      expect(released.pickedUp).toBe(3)

      
      // 13. Availability restored to 16 (14 + 2 released)
      const avail = await checkAvailability(rt.id, startDate, endDate, db)
      expect(avail.minAvailable).toBe(16)

      
      // 14. Releasing again should fail
      await expect(
        releaseGroupBlock(block.id, user.id, db),
      ).rejects.toThrow('block not found or already released')
    })
  })


  describe('guard – rejects past-day operations', () => {
    it('rejects createGroupBlock with a past startDate (unhappy path)', async () => {
      // 1. Create user and room type
      const user = await createTestUser(db)
      const rt = await createTestRoomType(db)

      // 2. Attempt to create a block starting yesterday — should fail
      await expect(
        createGroupBlock(rt.id, YESTERDAY, BUSINESS_DATE, 3, 'Past Block', user.id, db),
      ).rejects.toThrow('Block start date')
    })

    it('allows createGroupBlock with a future startDate (happy path)', async () => {
      // 1. Create user and room type
      const user = await createTestUser(db)
      const rt = await createTestRoomType(db)
      const startDate = dateHelpers.daysFromNow(10)
      const endDate = dateHelpers.daysFromNow(15)

      // 2. Seed inventory for the block dates
      for (let i = 10; i < 15; i++) {
        await createTestRoomInventory(db, {
          roomTypeId: rt.id,
          date: dateHelpers.daysFromNow(i),
          capacity: 20,
          available: 20,
        })
      }

      // 3. Create a block starting in the future
      const block = await createGroupBlock(rt.id, startDate, endDate, 3, 'Future Block', user.id, db)
      // Expect block created with quantity 3
      expect(block.quantity).toBe(3)
    })

    it('rejects createGroupReservation with a past checkInDate (unhappy path)', async () => {
      // 1. Create user, guest, and room type
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)

      // 2. Seed inventory for yesterday
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: YESTERDAY,
        capacity: 10,
        available: 10,
      })

      // 3. Attempt to book with past check-in — should fail
      await expect(
        createGroupReservation(
          {
            contactGuestId: guest.id,
            groupName: 'Past Group',
            checkInDate: YESTERDAY,
            checkOutDate: BUSINESS_DATE,
            rooms: [{ roomTypeId: rt.id, dailyRate: '100.00' }],
          },
          user.id,
          db,
        ),
      ).rejects.toThrow('Group check-in date')
    })

    it('allows createGroupReservation with a future checkInDate (happy path)', async () => {
      // 1. Create user, guest, and room type with future dates
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)
      const rt = await createTestRoomType(db)
      const checkIn = dateHelpers.daysFromNow(5)
      const checkOut = dateHelpers.daysFromNow(6)

      // 2. Seed inventory for the check-in date
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: checkIn,
        capacity: 10,
        available: 10,
      })

      // 3. Create the group reservation
      const result = await createGroupReservation(
        {
          contactGuestId: guest.id,
          groupName: 'Future Group',
          checkInDate: checkIn,
          checkOutDate: checkOut,
          rooms: [{ roomTypeId: rt.id, dailyRate: '100.00' }],
        },
        user.id,
        db,
      )

      // Expect reservation created with pending status
      expect((result as any).reservation.status).toBe('pending')
    })
  })
})
