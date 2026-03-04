import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'vitest';

import {
  getTestDb,
  cleanupTestDb,
  verifyDbIsEmpty,
} from '../../setup';

import {
  createTestUser,
  createTestMaintenanceRequest,
} from '../../factories';

import {
  listOpenRequests,
  listScheduledRequests,
  listUrgentOpenRequests,
} from '../../../../db/queries/maintenance/maintenance-requests';

describe('Maintenance - requests', () => {
  const db = getTestDb();
  let userId: number;

  beforeEach(async () => {
    await cleanupTestDb(db);
    const u = await createTestUser(db);
    userId = u.id;
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  it('lists open requests ordered by priority', async () => {
    // 1. Create requests – two open (normal + urgent), one completed
    await createTestMaintenanceRequest(db, userId, { status: 'open', priority: 'normal' });
    await createTestMaintenanceRequest(db, userId, { status: 'open', priority: 'urgent' });
    await createTestMaintenanceRequest(db, userId, { status: 'completed', priority: 'urgent' });

    // 2. Query open requests
    const results = await listOpenRequests(db);

    // Only 2 open requests returned; first is normal priority
    expect(results.length).toBe(2);
    expect(results[0].priority).toBe('normal');
  });

  it('lists scheduled requests from a date and excludes completed ones', async () => {
    // 1. Create one incomplete scheduled request and one completed
    await createTestMaintenanceRequest(db, userId, { scheduledDate: '2026-02-05', completedAt: null });
    await createTestMaintenanceRequest(db, userId, { scheduledDate: '2026-02-10', completedAt: new Date() });

    // 2. Query scheduled requests from Feb 1
    const results = await listScheduledRequests('2026-02-01', db);

    // Only the incomplete request returned
    expect(results.length).toBe(1);
    expect(results[0].scheduledDate).toBe('2026-02-05');
  });

  it('lists urgent open requests', async () => {
    // 1. Create one urgent open and one normal open request
    await createTestMaintenanceRequest(db, userId, { status: 'open', priority: 'urgent' });
    await createTestMaintenanceRequest(db, userId, { status: 'open', priority: 'normal' });

    // 2. Query urgent open requests only
    const results = await listUrgentOpenRequests(db);

    // Only the urgent one returned
    expect(results.length).toBe(1);
    expect(results[0].priority).toBe('urgent');
  });
});
