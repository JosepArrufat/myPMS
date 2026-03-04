import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTestDb, cleanupTestDb, type TestDb } from '../../setup'
import {
  createTestRoomType,
  createTestOverbookingPolicy,
} from '../../factories'
import { dateHelpers } from '../../utils'
import {
  createOverbookingPolicy,
  updateOverbookingPolicy,
  deleteOverbookingPolicy,
  listOverbookingPolicies,
  listPoliciesForRange,
  getEffectiveOverbookingPercent,
  trimExpiredPolicies,
} from '../../../queries/catalog/overbooking-policies'

let db: TestDb

beforeAll(() => { db = getTestDb() })
afterAll(async () => { await cleanupTestDb(db) })
beforeEach(async () => { await cleanupTestDb(db) })

describe('overbooking-policies queries', () => {
  describe('CRUD', () => {
    it('creates a hotel-wide policy', async () => {
      // 1. Create a policy with no roomTypeId (hotel-wide)
      const policy = await createOverbookingPolicy({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 120,
      }, db)

      // ID should be assigned
      expect(policy.id).toBeDefined()
      // roomTypeId should be null (hotel-wide)
      expect(policy.roomTypeId).toBeNull()
      // Percent and dates should match input
      expect(policy.overbookingPercent).toBe(120)
      expect(String(policy.startDate)).toBe('2026-03-01')
      expect(String(policy.endDate)).toBe('2026-03-31')
    })

    it('creates a room-type-specific policy', async () => {
      // 1. Create a room type
      const rt = await createTestRoomType(db)

      // 2. Create a policy scoped to that room type
      const policy = await createOverbookingPolicy({
        roomTypeId: rt.id,
        startDate: '2026-04-01',
        endDate: '2026-04-15',
        overbookingPercent: 110,
      }, db)

      // Should reference the room type and carry correct percent
      expect(policy.roomTypeId).toBe(rt.id)
      expect(policy.overbookingPercent).toBe(110)
    })

    it('updates a policy', async () => {
      // 1. Create a policy with 100% overbooking
      const policy = await createTestOverbookingPolicy(db, {
        overbookingPercent: 100,
      })

      // 2. Update to 130%
      const updated = await updateOverbookingPolicy(
        policy.id,
        { overbookingPercent: 130 },
        db,
      )

      // Updated value should be 130
      expect(updated.overbookingPercent).toBe(130)
    })

    it('deletes a policy', async () => {
      // 1. Create a policy
      const policy = await createTestOverbookingPolicy(db)

      // 2. Delete it
      const deleted = await deleteOverbookingPolicy(policy.id, db)

      // Returned row should match original ID
      expect(deleted.id).toBe(policy.id)

      // List should now be empty
      const remaining = await listOverbookingPolicies(db)
      expect(remaining).toHaveLength(0)
    })

    it('lists all policies ordered by start date', async () => {
      // 1. Create June and March policies (out of order)
      await createTestOverbookingPolicy(db, {
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      })
      await createTestOverbookingPolicy(db, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      })

      // 2. List all policies
      const policies = await listOverbookingPolicies(db)

      // Should be sorted: March first, June second
      expect(policies).toHaveLength(2)
      expect(String(policies[0].startDate)).toBe('2026-03-01')
      expect(String(policies[1].startDate)).toBe('2026-06-01')
    })
  })

  describe('listPoliciesForRange', () => {
    it('returns policies overlapping the given range', async () => {
      // 1. Create a March policy and a May policy
      await createTestOverbookingPolicy(db, {
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      })
      await createTestOverbookingPolicy(db, {
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      })

      // 2. Query for range Mar 10–20
      const result = await listPoliciesForRange('2026-03-10', '2026-03-20', db)

      // Only the March policy should overlap
      expect(result).toHaveLength(1)
      expect(String(result[0].startDate)).toBe('2026-03-01')
    })

    it('returns empty when no policies overlap', async () => {
      // 1. Create a March policy
      await createTestOverbookingPolicy(db, {
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      })

      // 2. Query for April range
      const result = await listPoliciesForRange('2026-04-01', '2026-04-30', db)

      // No policies should match
      expect(result).toHaveLength(0)
    })
  })

  describe('getEffectiveOverbookingPercent', () => {
    it('returns room-type-specific policy when it exists', async () => {
      // 1. Create a room type
      const rt = await createTestRoomType(db)

      // 2. Create hotel-wide (120%) and room-specific (110%) policies
      // hotel-wide policy: 120%
      await createTestOverbookingPolicy(db, {
        roomTypeId: null,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 120,
      })

      // room-type-specific policy: 110%
      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 110,
      })

      // 3. Get effective percent for that room type
      const pct = await getEffectiveOverbookingPercent(rt.id, '2026-03-15', db)

      // Specific policy (110%) should win over hotel-wide
      expect(pct).toBe(110) // specific wins over hotel-wide
    })

    it('falls back to hotel-wide policy when no specific policy exists', async () => {
      // 1. Create a room type
      const rt = await createTestRoomType(db)

      // 2. Create only a hotel-wide policy (115%)
      await createTestOverbookingPolicy(db, {
        roomTypeId: null,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 115,
      })

      // 3. Get effective percent
      const pct = await getEffectiveOverbookingPercent(rt.id, '2026-03-15', db)

      // Should fall back to 115%
      expect(pct).toBe(115)
    })

    it('returns 100 (no overbooking) when no policy exists', async () => {
      // 1. Create a room type with no policies
      const rt = await createTestRoomType(db)

      // 2. Get effective percent
      const pct = await getEffectiveOverbookingPercent(rt.id, '2026-03-15', db)

      // Should default to 100
      expect(pct).toBe(100)
    })

    it('ignores policies outside the date', async () => {
      // 1. Create a room type and an April policy
      const rt = await createTestRoomType(db)

      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        overbookingPercent: 130,
      })

      // 2. Query for a March date
      const pct = await getEffectiveOverbookingPercent(rt.id, '2026-03-15', db)

      // Should default to 100 (policy is outside range)
      expect(pct).toBe(100) // outside policy range → default
    })
  })

  describe('trimExpiredPolicies', () => {
    it('deletes fully expired policies', async () => {
      // 1. Create an expired policy (ends Feb 10) and an active one (ends Feb 28)
      // Ends before businessDate
      await createTestOverbookingPolicy(db, {
        startDate: '2026-02-01',
        endDate: '2026-02-10',
        overbookingPercent: 110,
      })
      // Still active
      await createTestOverbookingPolicy(db, {
        startDate: '2026-02-15',
        endDate: '2026-02-28',
        overbookingPercent: 120,
      })

      // 2. Trim with businessDate Feb 16
      const result = await trimExpiredPolicies('2026-02-16', db)

      // Expired one should be deleted
      expect(result.deleted).toBe(1)

      // Active one should remain
      const remaining = await listOverbookingPolicies(db)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].overbookingPercent).toBe(120)
    })

    it('trims policies that started before businessDate', async () => {
      // 1. Create a policy spanning Feb 1–28
      await createTestOverbookingPolicy(db, {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        overbookingPercent: 115,
      })

      // 2. Trim with businessDate Feb 15
      const result = await trimExpiredPolicies('2026-02-15', db)
      expect(result.trimmed).toBe(1)

      // startDate should be advanced to Feb 16
      const policies = await listOverbookingPolicies(db)
      expect(policies).toHaveLength(1)
      expect(String(policies[0].startDate)).toBe('2026-02-16')
      expect(String(policies[0].endDate)).toBe('2026-02-28')
    })

    it('handles mixed expired and trimmed policies', async () => {
      // 1. Create expired (Jan), partially expired (Feb–Mar), and future (Apr) policies
      // Fully expired
      await createTestOverbookingPolicy(db, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        overbookingPercent: 100,
      })

      // Needs trimming
      await createTestOverbookingPolicy(db, {
        startDate: '2026-02-01',
        endDate: '2026-03-15',
        overbookingPercent: 110,
      })

      // Future — untouched
      await createTestOverbookingPolicy(db, {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        overbookingPercent: 130,
      })

      // 2. Trim with businessDate Feb 20
      const result = await trimExpiredPolicies('2026-02-20', db)

      // Jan deleted, Feb trimmed
      expect(result.deleted).toBe(1) // Jan policy deleted
      expect(result.trimmed).toBe(1) // Feb policy trimmed

      const policies = await listOverbookingPolicies(db)
      expect(policies).toHaveLength(2)

      // Trimmed policy — startDate advanced
      expect(String(policies[0].startDate)).toBe('2026-02-21')
      expect(String(policies[0].endDate)).toBe('2026-03-15')

      // Future policy untouched
      expect(String(policies[1].startDate)).toBe('2026-04-01')
    })

    it('does nothing when there are no expired policies', async () => {
      // 1. Create a future policy (June)
      await createTestOverbookingPolicy(db, {
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        overbookingPercent: 120,
      })

      // 2. Trim with businessDate Feb 15
      const result = await trimExpiredPolicies('2026-02-15', db)

      // Nothing should change
      expect(result.deleted).toBe(0)
      expect(result.trimmed).toBe(0)
    })
  })
})
