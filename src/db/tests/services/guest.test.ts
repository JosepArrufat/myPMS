import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTestDb, cleanupTestDb, type TestDb } from '../setup'
import {
  createTestUser,
  createTestGuest,
  createTestReservation,
  createTestInvoice,
} from '../factories'
import { dateHelpers } from '../utils'
import {
  searchGuestsByDocument,
  searchGuestsByPhone,
  searchGuestsByEmail,
  searchGuestsFuzzy,
  setVipStatus,
  setLoyaltyNumber,
  listVipGuests,
  getGuestHistory,
  findDuplicates,
  mergeGuests,
} from '../../services/guest'

let db: TestDb

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => { await cleanupTestDb(db) })

describe('guest service', () => {
  describe('searchGuestsByDocument', () => {
    it('finds guests by document number', async () => {
      // 1. Create two guests with different document numbers
      await createTestGuest(db, { idDocumentNumber: 'PASS-123456' })
      await createTestGuest(db, { idDocumentNumber: 'PASS-999999' })

      // 2. Search for PASS-123456
      const results = await searchGuestsByDocument('PASS-123456', db)
      // exactly one match returned
      expect(results).toHaveLength(1)
      // the returned guest has the correct document number
      expect(results[0].idDocumentNumber).toBe('PASS-123456')
    })
  })

  describe('searchGuestsByPhone', () => {
    it('finds guests by phone', async () => {
      // 1. Create two guests with different phone numbers
      await createTestGuest(db, { phone: '+34600111222' })
      await createTestGuest(db, { phone: '+34600333444' })

      // 2. Search by the first phone number
      const results = await searchGuestsByPhone('+34600111222', db)
      // exactly one match returned
      expect(results).toHaveLength(1)
      // the returned guest has the correct phone
      expect(results[0].phone).toBe('+34600111222')
    })
  })

  describe('searchGuestsByEmail', () => {
    it('finds guests by email', async () => {
      // 1. Create a guest with a known email
      const g = await createTestGuest(db, { email: 'vip@example.com' })

      // 2. Search by that email
      const results = await searchGuestsByEmail('vip@example.com', db)
      // exactly one match returned
      expect(results).toHaveLength(1)
      // the returned guest is the one we created
      expect(results[0].id).toBe(g.id)
    })
  })

  describe('searchGuestsFuzzy', () => {
    it('finds guests by partial name, email, phone, or doc', async () => {
      // 1. Create Maria Garcia and Carlos Lopez
      await createTestGuest(db, { firstName: 'Maria', lastName: 'Garcia' })
      await createTestGuest(db, { firstName: 'Carlos', lastName: 'Lopez' })

      // 2. Fuzzy search for "garcia"
      const results = await searchGuestsFuzzy('garcia', db)
      // only one guest matches
      expect(results).toHaveLength(1)
      // it's Garcia, not Lopez
      expect(results[0].lastName).toBe('Garcia')
    })
  })

  describe('setVipStatus', () => {
    it('sets VIP flag on a guest', async () => {
      // 1. Create a non-VIP guest
      const guest = await createTestGuest(db, { vipStatus: false })

      // 2. Set VIP status to true
      const updated = await setVipStatus(guest.id, true, db)
      // guest is now VIP
      expect(updated.vipStatus).toBe(true)
    })
  })

  describe('setLoyaltyNumber', () => {
    it('assigns a loyalty number', async () => {
      // 1. Create a guest with no loyalty number
      const guest = await createTestGuest(db)

      // 2. Assign a loyalty number
      const updated = await setLoyaltyNumber(guest.id, 'LOY-12345', db)
      // loyalty number is persisted
      expect(updated.loyaltyNumber).toBe('LOY-12345')
    })
  })

  describe('listVipGuests', () => {
    it('returns only VIP guests', async () => {
      // 1. Create 2 VIP guests and 1 regular guest
      await createTestGuest(db, { vipStatus: true, firstName: 'VIP', lastName: 'One' })
      await createTestGuest(db, { vipStatus: false, firstName: 'Regular', lastName: 'Two' })
      await createTestGuest(db, { vipStatus: true, firstName: 'VIP', lastName: 'Three' })

      // 2. List VIP guests only
      const vips = await listVipGuests(db)
      // exactly 2 VIPs returned (the regular guest is excluded)
      expect(vips).toHaveLength(2)
      // every returned guest is VIP
      expect(vips.every((g) => g.vipStatus === true)).toBe(true)
    })
  })

  describe('getGuestHistory', () => {
    it('returns stay history and stats', async () => {
      // 1. Create a user and a guest
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)

      // 2. Create a checked-out reservation ($500) in the past
      await createTestReservation(db, user.id, {
        guestId: guest.id,
        status: 'checked_out',
        totalAmount: '500.00',
        checkInDate: dateHelpers.daysAgo(10),
        checkOutDate: dateHelpers.daysAgo(5),
      })
      // 3. Create a confirmed reservation ($300) in the future
      await createTestReservation(db, user.id, {
        guestId: guest.id,
        status: 'confirmed',
        totalAmount: '300.00',
        checkInDate: dateHelpers.daysFromNow(5),
        checkOutDate: dateHelpers.daysFromNow(10),
      })

      // 4. Fetch guest history
      const history = await getGuestHistory(guest.id, db)

      // both reservations appear
      expect(history.reservations).toHaveLength(2)
      // only checked_out counts as a completed stay
      expect(history.stats.totalStays).toBe(1) // only checked_out counts
      // total reservations includes confirmed too
      expect(history.stats.totalReservations).toBe(2)
      // spend only counts checked-out amount
      expect(history.stats.totalSpend).toBe('500.00')
    })
  })

  describe('findDuplicates', () => {
    it('finds guests with matching email', async () => {
      // 1. Create 2 guests with the same email and 1 with a different email
      const guest1 = await createTestGuest(db, { email: 'dupe@example.com', idDocumentNumber: 'DOC-001', phone: '+1111111111' })
      await createTestGuest(db, { email: 'dupe@example.com', idDocumentNumber: 'DOC-002', phone: '+2222222222' })
      await createTestGuest(db, { email: 'other@example.com', idDocumentNumber: 'DOC-003', phone: '+3333333333' })

      // 2. Find duplicates of guest1
      const dupes = await findDuplicates(guest1.id, db)
      // only the other guest sharing the same email is returned
      expect(dupes).toHaveLength(1)
      // the duplicate has the matching email
      expect(dupes[0].email).toBe('dupe@example.com')
    })

    it('finds guests with matching phone', async () => {
      // 1. Create 2 guests with the same phone but different emails
      const guest1 = await createTestGuest(db, { phone: '+34600555666', email: 'unique1@test.com', idDocumentNumber: 'DOC-A' })
      await createTestGuest(db, { phone: '+34600555666', email: 'unique2@test.com', idDocumentNumber: 'DOC-B' })

      // 2. Find duplicates of guest1
      const dupes = await findDuplicates(guest1.id, db)
      // the other guest sharing the same phone is found
      expect(dupes).toHaveLength(1)
    })
  })

  describe('mergeGuests', () => {
    it('merges a secondary guest into a primary guest', async () => {
      // 1. Create a user for reservation ownership
      const user = await createTestUser(db)
      // 2. Create primary guest (no phone, not VIP)
      const primary = await createTestGuest(db, {
        firstName: 'John',
        lastName: 'Primary',
        email: 'john@primary.com',
        phone: null,
        vipStatus: false,
      })
      // 3. Create secondary guest (has phone, VIP, loyalty number)
      const secondary = await createTestGuest(db, {
        firstName: 'John',
        lastName: 'Secondary',
        email: 'john@secondary.com',
        phone: '+34600123456',
        vipStatus: true,
        loyaltyNumber: 'LOY-777',
      })

      // 4. Attach a reservation and an invoice to the secondary guest
      await createTestReservation(db, user.id, { guestId: secondary.id })
      await createTestInvoice(db, { guestId: secondary.id })

      // 5. Merge secondary into primary
      const merged = await mergeGuests(primary.id, secondary.id, db)

      // merged guest keeps primary's id
      expect(merged.id).toBe(primary.id)
      // primary inherits secondary's phone
      expect(merged.phone).toBe('+34600123456') 
      // primary inherits VIP status
      expect(merged.vipStatus).toBe(true) 
      // primary inherits loyalty number
      expect(merged.loyaltyNumber).toBe('LOY-777') 

      // 6. Verify the secondary guest record is deleted
      const { guests } = await import('../../schema/guests')
      const { eq } = await import('drizzle-orm')
      const found = await db.select().from(guests).where(eq(guests.id, secondary.id))
      // secondary guest no longer exists
      expect(found).toHaveLength(0)
    })
  })
})
