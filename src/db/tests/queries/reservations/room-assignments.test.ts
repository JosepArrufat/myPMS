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
  createTestReservation,
  createTestRoom,
} from '../../factories';

import { eq } from 'drizzle-orm';

import { roomAssignments } from '../../../../db/schema/reservations';

import {
  listAssignmentsForDate,
  listAssignmentsForReservation,
} from '../../../../db/queries/reservations/room-assignments';

describe('Reservations - room assignments', () => {
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

  describe('listAssignmentsForDate', () => {
    it('lists assignments on a specific date ordered by roomId', async () => {
      const res = await createTestReservation(db, userId);
      const roomA = await createTestRoom(db, { roomNumber: 'A01' });
      const roomB = await createTestRoom(db, { roomNumber: 'B02' });

      await db.insert(roomAssignments).values({
        reservationId: res.id,
        roomId: roomB.id,
        date: '2026-03-10',
        assignedBy: userId,
      });
      await db.insert(roomAssignments).values({
        reservationId: res.id,
        roomId: roomA.id,
        date: '2026-03-10',
        assignedBy: userId,
      });
      await db.insert(roomAssignments).values({
        reservationId: res.id,
        roomId: roomA.id,
        date: '2026-03-11',
        assignedBy: userId,
      });

      const result = await listAssignmentsForDate('2026-03-10', db);

      expect(result).toHaveLength(2);
      expect(result[0].roomId).toBe(roomA.id);
      expect(result[1].roomId).toBe(roomB.id);
    });

    it('returns empty when no assignments exist for the date', async () => {
      const result = await listAssignmentsForDate('2026-01-01', db);
      expect(result).toEqual([]);
    });
  });

  describe('listAssignmentsForReservation', () => {
    it('lists assignments for a reservation ordered by date', async () => {
      const res = await createTestReservation(db, userId);
      const room = await createTestRoom(db);

      await db.insert(roomAssignments).values({
        reservationId: res.id,
        roomId: room.id,
        date: '2026-03-12',
        assignedBy: userId,
      });
      await db.insert(roomAssignments).values({
        reservationId: res.id,
        roomId: room.id,
        date: '2026-03-10',
        assignedBy: userId,
      });

      const result = await listAssignmentsForReservation(res.id, db);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-03-10');
      expect(result[1].date).toBe('2026-03-12');
    });
  });

  describe('Room reassignment workflow', () => {
    it('reassign room, then the freed room can be taken but the occupied one cannot', async () => {
      const res1 = await createTestReservation(db, userId);
      const res2 = await createTestReservation(db, userId, { reservationNumber: 'WF-RES2' });
      const res3 = await createTestReservation(db, userId, { reservationNumber: 'WF-RES3' });
      const roomA = await createTestRoom(db, { roomNumber: 'WF-A' });
      const roomB = await createTestRoom(db, { roomNumber: 'WF-B' });
      const day = '2026-04-15';

      const [original] = await db.insert(roomAssignments).values({
        reservationId: res1.id,
        roomId: roomA.id,
        date: day,
        assignedBy: userId,
      }).returning();

      let assignments = await listAssignmentsForDate(day, db);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].roomId).toBe(roomA.id);

      await db.delete(roomAssignments).where(
        eq(roomAssignments.id, original.id),
      );
      await db.insert(roomAssignments).values({
        reservationId: res1.id,
        roomId: roomB.id,
        date: day,
        assignedBy: userId,
      });

      assignments = await listAssignmentsForDate(day, db);
      expect(assignments).toHaveLength(1);
      expect(assignments[0].roomId).toBe(roomB.id);

      await db.insert(roomAssignments).values({
        reservationId: res2.id,
        roomId: roomA.id,
        date: day,
        assignedBy: userId,
      });

      assignments = await listAssignmentsForDate(day, db);
      expect(assignments).toHaveLength(2);

      await expect(
        db.insert(roomAssignments).values({
          reservationId: res3.id,
          roomId: roomB.id,
          date: day,
          assignedBy: userId,
        }),
      ).rejects.toThrow();
    });
  });

  describe('FK constraints', () => {
    it('rejects assignment with non-existent roomId', async () => {
      const res = await createTestReservation(db, userId);

      await expect(
        db.insert(roomAssignments).values({
          reservationId: res.id,
          roomId: 999999,
          date: '2026-03-10',
          assignedBy: userId,
        }),
      ).rejects.toThrow();
    });

    it('rejects assignment with non-existent reservationId', async () => {
      const room = await createTestRoom(db);
      const fakeResId = '00000000-0000-0000-0000-000000000000';

      await expect(
        db.insert(roomAssignments).values({
          reservationId: fakeResId,
          roomId: room.id,
          date: '2026-03-10',
        }),
      ).rejects.toThrow();
    });
  });
});
