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
      await createTestGuest(db, { idDocumentNumber: 'PASS-123456' })
      await createTestGuest(db, { idDocumentNumber: 'PASS-999999' })

      const results = await searchGuestsByDocument('PASS-123456', db)
      expect(results).toHaveLength(1)
      expect(results[0].idDocumentNumber).toBe('PASS-123456')
    })
  })

  describe('searchGuestsByPhone', () => {
    it('finds guests by phone', async () => {
      await createTestGuest(db, { phone: '+34600111222' })
      await createTestGuest(db, { phone: '+34600333444' })

      const results = await searchGuestsByPhone('+34600111222', db)
      expect(results).toHaveLength(1)
      expect(results[0].phone).toBe('+34600111222')
    })
  })

  describe('searchGuestsByEmail', () => {
    it('finds guests by email', async () => {
      const g = await createTestGuest(db, { email: 'vip@example.com' })

      const results = await searchGuestsByEmail('vip@example.com', db)
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(g.id)
    })
  })

  describe('searchGuestsFuzzy', () => {
    it('finds guests by partial name, email, phone, or doc', async () => {
      await createTestGuest(db, { firstName: 'Maria', lastName: 'Garcia' })
      await createTestGuest(db, { firstName: 'Carlos', lastName: 'Lopez' })

      const results = await searchGuestsFuzzy('garcia', db)
      expect(results).toHaveLength(1)
      expect(results[0].lastName).toBe('Garcia')
    })
  })

  describe('setVipStatus', () => {
    it('sets VIP flag on a guest', async () => {
      const guest = await createTestGuest(db, { vipStatus: false })

      const updated = await setVipStatus(guest.id, true, db)
      expect(updated.vipStatus).toBe(true)
    })
  })

  describe('setLoyaltyNumber', () => {
    it('assigns a loyalty number', async () => {
      const guest = await createTestGuest(db)

      const updated = await setLoyaltyNumber(guest.id, 'LOY-12345', db)
      expect(updated.loyaltyNumber).toBe('LOY-12345')
    })
  })

  describe('listVipGuests', () => {
    it('returns only VIP guests', async () => {
      await createTestGuest(db, { vipStatus: true, firstName: 'VIP', lastName: 'One' })
      await createTestGuest(db, { vipStatus: false, firstName: 'Regular', lastName: 'Two' })
      await createTestGuest(db, { vipStatus: true, firstName: 'VIP', lastName: 'Three' })

      const vips = await listVipGuests(db)
      expect(vips).toHaveLength(2)
      expect(vips.every((g) => g.vipStatus === true)).toBe(true)
    })
  })

  describe('getGuestHistory', () => {
    it('returns stay history and stats', async () => {
      const user = await createTestUser(db)
      const guest = await createTestGuest(db)

      await createTestReservation(db, user.id, {
        guestId: guest.id,
        status: 'checked_out',
        totalAmount: '500.00',
        checkInDate: dateHelpers.daysAgo(10),
        checkOutDate: dateHelpers.daysAgo(5),
      })
      await createTestReservation(db, user.id, {
        guestId: guest.id,
        status: 'confirmed',
        totalAmount: '300.00',
        checkInDate: dateHelpers.daysFromNow(5),
        checkOutDate: dateHelpers.daysFromNow(10),
      })

      const history = await getGuestHistory(guest.id, db)

      expect(history.stays).toHaveLength(2)
      expect(history.stats.totalStays).toBe(1) // only checked_out counts
      expect(history.stats.totalReservations).toBe(2)
      expect(history.stats.totalSpend).toBe('500.00')
    })
  })

  describe('findDuplicates', () => {
    it('finds guests with matching email', async () => {
      const guest1 = await createTestGuest(db, { email: 'dupe@example.com', idDocumentNumber: 'DOC-001', phone: '+1111111111' })
      await createTestGuest(db, { email: 'dupe@example.com', idDocumentNumber: 'DOC-002', phone: '+2222222222' })
      await createTestGuest(db, { email: 'other@example.com', idDocumentNumber: 'DOC-003', phone: '+3333333333' })

      const dupes = await findDuplicates(guest1.id, db)
      expect(dupes).toHaveLength(1)
      expect(dupes[0].email).toBe('dupe@example.com')
    })

    it('finds guests with matching phone', async () => {
      const guest1 = await createTestGuest(db, { phone: '+34600555666', email: 'unique1@test.com', idDocumentNumber: 'DOC-A' })
      await createTestGuest(db, { phone: '+34600555666', email: 'unique2@test.com', idDocumentNumber: 'DOC-B' })

      const dupes = await findDuplicates(guest1.id, db)
      expect(dupes).toHaveLength(1)
    })
  })

  describe('mergeGuests', () => {
    it('merges a secondary guest into a primary guest', async () => {
      const user = await createTestUser(db)
      const primary = await createTestGuest(db, {
        firstName: 'John',
        lastName: 'Primary',
        email: 'john@primary.com',
        phone: null,
        vipStatus: false,
      })
      const secondary = await createTestGuest(db, {
        firstName: 'John',
        lastName: 'Secondary',
        email: 'john@secondary.com',
        phone: '+34600123456',
        vipStatus: true,
        loyaltyNumber: 'LOY-777',
      })

      await createTestReservation(db, user.id, { guestId: secondary.id })
      await createTestInvoice(db, { guestId: secondary.id })

      const merged = await mergeGuests(primary.id, secondary.id, db)

      expect(merged.id).toBe(primary.id)
      expect(merged.phone).toBe('+34600123456') 
      expect(merged.vipStatus).toBe(true) 
      expect(merged.loyaltyNumber).toBe('LOY-777') 

      const { guests } = await import('../../schema/guests')
      const { eq } = await import('drizzle-orm')
      const found = await db.select().from(guests).where(eq(guests.id, secondary.id))
      expect(found).toHaveLength(0)
    })
  })
})
