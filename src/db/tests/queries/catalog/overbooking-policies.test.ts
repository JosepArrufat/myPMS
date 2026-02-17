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
      const policy = await createOverbookingPolicy({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 120,
      }, db)

      expect(policy.id).toBeDefined()
      expect(policy.roomTypeId).toBeNull()
      expect(policy.overbookingPercent).toBe(120)
      expect(String(policy.startDate)).toBe('2026-03-01')
      expect(String(policy.endDate)).toBe('2026-03-31')
    })

    it('creates a room-type-specific policy', async () => {
      const rt = await createTestRoomType(db)
      const policy = await createOverbookingPolicy({
        roomTypeId: rt.id,
        startDate: '2026-04-01',
        endDate: '2026-04-15',
        overbookingPercent: 110,
      }, db)

      expect(policy.roomTypeId).toBe(rt.id)
      expect(policy.overbookingPercent).toBe(110)
    })

    it('updates a policy', async () => {
      const policy = await createTestOverbookingPolicy(db, {
        overbookingPercent: 100,
      })
      const updated = await updateOverbookingPolicy(
        policy.id,
        { overbookingPercent: 130 },
        db,
      )
      expect(updated.overbookingPercent).toBe(130)
    })

    it('deletes a policy', async () => {
      const policy = await createTestOverbookingPolicy(db)
      const deleted = await deleteOverbookingPolicy(policy.id, db)
      expect(deleted.id).toBe(policy.id)

      const remaining = await listOverbookingPolicies(db)
      expect(remaining).toHaveLength(0)
    })

    it('lists all policies ordered by start date', async () => {
      await createTestOverbookingPolicy(db, {
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      })
      await createTestOverbookingPolicy(db, {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      })

      const policies = await listOverbookingPolicies(db)
      expect(policies).toHaveLength(2)
      expect(String(policies[0].startDate)).toBe('2026-03-01')
      expect(String(policies[1].startDate)).toBe('2026-06-01')
    })
  })

  describe('listPoliciesForRange', () => {
    it('returns policies overlapping the given range', async () => {
      await createTestOverbookingPolicy(db, {
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      })
      await createTestOverbookingPolicy(db, {
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      })

      const result = await listPoliciesForRange('2026-03-10', '2026-03-20', db)
      expect(result).toHaveLength(1)
      expect(String(result[0].startDate)).toBe('2026-03-01')
    })

    it('returns empty when no policies overlap', async () => {
      await createTestOverbookingPolicy(db, {
        startDate: '2026-03-01',
        endDate: '2026-03-15',
      })

      const result = await listPoliciesForRange('2026-04-01', '2026-04-30', db)
      expect(result).toHaveLength(0)
    })
  })

  describe('getEffectiveOverbookingPercent', () => {
    it('returns room-type-specific policy when it exists', async () => {
      const rt = await createTestRoomType(db)

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

      const pct = await getEffectiveOverbookingPercent(rt.id, '2026-03-15', db)
      expect(pct).toBe(110) // specific wins over hotel-wide
    })

    it('falls back to hotel-wide policy when no specific policy exists', async () => {
      const rt = await createTestRoomType(db)

      await createTestOverbookingPolicy(db, {
        roomTypeId: null,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        overbookingPercent: 115,
      })

      const pct = await getEffectiveOverbookingPercent(rt.id, '2026-03-15', db)
      expect(pct).toBe(115)
    })

    it('returns 100 (no overbooking) when no policy exists', async () => {
      const rt = await createTestRoomType(db)
      const pct = await getEffectiveOverbookingPercent(rt.id, '2026-03-15', db)
      expect(pct).toBe(100)
    })

    it('ignores policies outside the date', async () => {
      const rt = await createTestRoomType(db)

      await createTestOverbookingPolicy(db, {
        roomTypeId: rt.id,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        overbookingPercent: 130,
      })

      const pct = await getEffectiveOverbookingPercent(rt.id, '2026-03-15', db)
      expect(pct).toBe(100) // outside policy range → default
    })
  })

  describe('trimExpiredPolicies', () => {
    it('deletes fully expired policies', async () => {
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

      const result = await trimExpiredPolicies('2026-02-16', db)
      expect(result.deleted).toBe(1)

      const remaining = await listOverbookingPolicies(db)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].overbookingPercent).toBe(120)
    })

    it('trims policies that started before businessDate', async () => {
      await createTestOverbookingPolicy(db, {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        overbookingPercent: 115,
      })

      const result = await trimExpiredPolicies('2026-02-15', db)
      expect(result.trimmed).toBe(1)

      const policies = await listOverbookingPolicies(db)
      expect(policies).toHaveLength(1)
      // startDate advanced past businessDate
      expect(String(policies[0].startDate)).toBe('2026-02-16')
      expect(String(policies[0].endDate)).toBe('2026-02-28')
    })

    it('handles mixed expired and trimmed policies', async () => {
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

      const result = await trimExpiredPolicies('2026-02-20', db)
      expect(result.deleted).toBe(1) // Jan policy deleted
      expect(result.trimmed).toBe(1) // Feb policy trimmed

      const policies = await listOverbookingPolicies(db)
      expect(policies).toHaveLength(2)

      // Trimmed policy
      expect(String(policies[0].startDate)).toBe('2026-02-21')
      expect(String(policies[0].endDate)).toBe('2026-03-15')

      // Future policy untouched
      expect(String(policies[1].startDate)).toBe('2026-04-01')
    })

    it('does nothing when there are no expired policies', async () => {
      await createTestOverbookingPolicy(db, {
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        overbookingPercent: 120,
      })

      const result = await trimExpiredPolicies('2026-02-15', db)
      expect(result.deleted).toBe(0)
      expect(result.trimmed).toBe(0)
    })
  })
})
