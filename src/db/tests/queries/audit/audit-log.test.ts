import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from 'vitest';
import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../../setup';
import { createTestUser, createTestAuditEntry } from '../../factories';
import {
  getAuditTrailForRecord,
  getAuditEventsForUser,
} from '../../../queries/audit/audit-log';
import type { BaseUser } from '../../utils';

describe('Audit Log Queries', () => {
  const db = getTestDb();
  let baseUser: BaseUser;

  beforeAll(() => {
    // DB client already initialized
  });

  beforeEach(async () => {
    await cleanupTestDb(db);

    baseUser = await createTestUser(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('getAuditTrailForRecord', () => {
    it('should return audit entries for specific table and record', async () => {
      // 1. Insert two audit entries for users/123 (update + insert)
      await createTestAuditEntry(db, {
        tableName: 'users',
        recordId: '123',
        action: 'update',
        userId: baseUser.id,
        newValues: { name: 'test' },
      });
      
      await createTestAuditEntry(db, {
        tableName: 'users',
        recordId: '123',
        action: 'insert',
        userId: baseUser.id,
        newValues: { name: 'initial' },
      });
      
      // 2. Insert a decoy entry for a different record (users/456)
      await createTestAuditEntry(db, {
        tableName: 'users',
        recordId: '456',
        action: 'update',
        userId: baseUser.id,
        newValues: { name: 'other' },
      });

      // 3. Query audit trail for users/123
      const results = await getAuditTrailForRecord('users', '123', 50, db);

      // Only the 2 matching entries returned, ordered chronologically
      expect(results).toHaveLength(2);
      expect(results[0].action).toBe('insert');
      expect(results[1].action).toBe('update');
    });

    it('should limit results when specified', async () => {
      // 1. Insert 20 audit entries for the same record
      for (let i = 0; i < 20; i++) {
        await createTestAuditEntry(db, {
          tableName: 'users',
          recordId: '123',
          action: 'update',
          userId: baseUser.id,
          newValues: { step: i },
        });
      }

      // 2. Query with a limit of 5
      const results = await getAuditTrailForRecord('users', '123', 5, db);

      // Only 5 rows returned despite 20 existing
      expect(results).toHaveLength(5);
    });

    it('should return empty array when no matching entries', async () => {
      // 1. Query for a record ID that has no audit entries
      const results = await getAuditTrailForRecord('users', 'nonexistent', 50, db);

      // Empty array returned
      expect(results).toEqual([]);
    });
  });

  describe('getAuditEventsForUser', () => {
    it('should return all events for user when no date filter', async () => {
      // 1. Create a second user to act as a decoy
      const otherUser = await createTestUser(db, { email: 'other@test.com' });

      // 2. Insert two events for baseUser and one for otherUser
      await createTestAuditEntry(db, {
        tableName: 'users',
        recordId: '1',
        action: 'update',
        userId: baseUser.id,
      });
      
      await createTestAuditEntry(db, {
        tableName: 'rooms',
        recordId: '2',
        action: 'insert',
        userId: baseUser.id,
      });
      
      await createTestAuditEntry(db, {
        tableName: 'rooms',
        recordId: '3',
        action: 'delete',
        userId: otherUser.id,
      });

      // 3. Query events for baseUser with no date filter
      const results = await getAuditEventsForUser(baseUser.id, undefined, db);

      // Only baseUser's 2 events returned
      expect(results).toHaveLength(2);
      expect(results.every(r => r.userId === baseUser.id)).toBe(true);
    });

    it('should filter by date when provided', async () => {
      // 1. Set up date references (now, yesterday, two days ago)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      // 2. Insert one event at now and one at two days ago
      await createTestAuditEntry(db, {
        tableName: 'users',
        recordId: '1',
        action: 'update',
        userId: baseUser.id,
        timestamp: now,
      });
      
      await createTestAuditEntry(db, {
        tableName: 'users',
        recordId: '2',
        action: 'update',
        userId: baseUser.id,
        timestamp: twoDaysAgo,
      });

      // 3. Query with yesterday as the date filter
      const results = await getAuditEventsForUser(baseUser.id, yesterday, db);

      if (results.length === 0) {
        throw new Error('Expected at least one audit event for user after date filter');
      }

      // Only the recent event survives the filter
      expect(results).toHaveLength(1);
      expect(results[0].timestamp?.getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
    });

    it('should return empty array for user with no events', async () => {
      // 1. Create a fresh user with no audit history
      const newUser = await createTestUser(db, { email: 'newuser@test.com' });

      // 2. Query events for that user
      const results = await getAuditEventsForUser(newUser.id, undefined, db);

      // Empty array returned
      expect(results).toEqual([]);
    });
  });
});
