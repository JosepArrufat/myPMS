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
  createTestHousekeepingTask,
  createTestRoom,
} from '../../factories';

import {
  listTasksForDate,
  listTasksForRoom,
  listTasksForAssignee,
} from '../../../../db/queries/housekeeping/housekeeping-tasks';

describe('Housekeeping Queries', () => {
  const db = getTestDb();
  let userId: number;

  beforeEach(async () => {
    await cleanupTestDb(db);
    const user = await createTestUser(db);
    userId = user.id;
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  it('lists tasks for a given date', async () => {
    // 1. Create tasks – two on Feb 10, one on Feb 11
    await createTestHousekeepingTask(db, userId, { taskDate: '2026-02-10' });
    await createTestHousekeepingTask(db, userId, { taskDate: '2026-02-10' });
    await createTestHousekeepingTask(db, userId, { taskDate: '2026-02-11' });

    // 2. Query tasks for Feb 10
    const results = await listTasksForDate('2026-02-10', db);

    // Only the 2 matching tasks returned, all on the correct date
    expect(results.length).toBe(2);
    expect(results.every((r) => r.taskDate === '2026-02-10')).toBe(true);
  });

  it('lists tasks for a room within a date range', async () => {
    // 1. Create two rooms
    const roomA = await createTestRoom(db);
    const roomB = await createTestRoom(db);

    // 2. Create tasks – two for roomA, one for roomB
    await createTestHousekeepingTask(db, userId, { roomId: roomA.id, taskDate: '2026-02-01' });
    await createTestHousekeepingTask(db, userId, { roomId: roomA.id, taskDate: '2026-02-05' });
    await createTestHousekeepingTask(db, userId, { roomId: roomB.id, taskDate: '2026-02-03' });

    // 3. Query tasks for roomA in the date range
    const results = await listTasksForRoom(
      roomA.id,
      '2026-02-01',
      '2026-02-10',
      db,
    );

    // Only roomA's 2 tasks returned
    expect(results.length).toBe(2);
    expect(results.every((r) => r.roomId === roomA.id)).toBe(true);
  });

  it('lists tasks for an assignee within range', async () => {
    // 1. Create a dedicated assignee user
    const assignee = await createTestUser(db);

    // 2. Create tasks – two assigned to the assignee, one unassigned
    await createTestHousekeepingTask(db, userId, { assignedTo: assignee.id, taskDate: '2026-02-02' });
    await createTestHousekeepingTask(db, userId, { assignedTo: assignee.id, taskDate: '2026-02-04' });
    await createTestHousekeepingTask(db, userId, { taskDate: '2026-02-03' });

    // 3. Query tasks for the assignee in the date range
    const results = await listTasksForAssignee(
      assignee.id,
      '2026-02-01',
      '2026-02-10',
      db,
    );

    // Only the assignee's 2 tasks returned
    expect(results.length).toBe(2);
    expect(results.every((r) => r.assignedTo === assignee.id)).toBe(true);
  });
});
