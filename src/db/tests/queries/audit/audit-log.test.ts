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
      
      await createTestAuditEntry(db, {
        tableName: 'users',
        recordId: '456',
        action: 'update',
        userId: baseUser.id,
        newValues: { name: 'other' },
      });

      const results = await getAuditTrailForRecord('users', '123', 50, db);

      expect(results).toHaveLength(2);
      expect(results[0].action).toBe('insert');
      expect(results[1].action).toBe('update');
    });

    it('should limit results when specified', async () => {
      for (let i = 0; i < 20; i++) {
        await createTestAuditEntry(db, {
          tableName: 'users',
          recordId: '123',
          action: 'update',
          userId: baseUser.id,
          newValues: { step: i },
        });
      }

      const results = await getAuditTrailForRecord('users', '123', 5, db);

      expect(results).toHaveLength(5);
    });

    it('should return empty array when no matching entries', async () => {
      const results = await getAuditTrailForRecord('users', 'nonexistent', 50, db);

      expect(results).toEqual([]);
    });
  });

  describe('getAuditEventsForUser', () => {
    it('should return all events for user when no date filter', async () => {
      const otherUser = await createTestUser(db, { email: 'other@test.com' });

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

      const results = await getAuditEventsForUser(baseUser.id, undefined, db);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.userId === baseUser.id)).toBe(true);
    });

    it('should filter by date when provided', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

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

      const results = await getAuditEventsForUser(baseUser.id, yesterday, db);

      if (results.length === 0) {
        throw new Error('Expected at least one audit event for user after date filter');
      }

      expect(results).toHaveLength(1);
      expect(results[0].timestamp?.getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
    });

    it('should return empty array for user with no events', async () => {
      const newUser = await createTestUser(db, { email: 'newuser@test.com' });

      const results = await getAuditEventsForUser(newUser.id, undefined, db);

      expect(results).toEqual([]);
    });
  });
});
