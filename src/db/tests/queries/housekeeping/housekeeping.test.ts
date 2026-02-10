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
    await createTestHousekeepingTask(db, userId, { taskDate: '2026-02-10' });
    await createTestHousekeepingTask(db, userId, { taskDate: '2026-02-10' });
    await createTestHousekeepingTask(db, userId, { taskDate: '2026-02-11' });

    const results = await listTasksForDate('2026-02-10', db);

    expect(results.length).toBe(2);
    expect(results.every((r) => r.taskDate === '2026-02-10')).toBe(true);
  });

  it('lists tasks for a room within a date range', async () => {
    const roomA = await createTestRoom(db);
    const roomB = await createTestRoom(db);

    await createTestHousekeepingTask(db, userId, { roomId: roomA.id, taskDate: '2026-02-01' });
    await createTestHousekeepingTask(db, userId, { roomId: roomA.id, taskDate: '2026-02-05' });
    await createTestHousekeepingTask(db, userId, { roomId: roomB.id, taskDate: '2026-02-03' });

    const results = await listTasksForRoom(
      roomA.id,
      '2026-02-01',
      '2026-02-10',
      db,
    );

    expect(results.length).toBe(2);
    expect(results.every((r) => r.roomId === roomA.id)).toBe(true);
  });

  it('lists tasks for an assignee within range', async () => {
    const assignee = await createTestUser(db);

    await createTestHousekeepingTask(db, userId, { assignedTo: assignee.id, taskDate: '2026-02-02' });
    await createTestHousekeepingTask(db, userId, { assignedTo: assignee.id, taskDate: '2026-02-04' });
    await createTestHousekeepingTask(db, userId, { taskDate: '2026-02-03' });

    const results = await listTasksForAssignee(
      assignee.id,
      '2026-02-01',
      '2026-02-10',
      db,
    );

    expect(results.length).toBe(2);
    expect(results.every((r) => r.assignedTo === assignee.id)).toBe(true);
  });
});
