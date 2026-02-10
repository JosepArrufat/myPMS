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
  createTestRoom,
  createTestUser,
  createTestReservation,
} from '../../factories';

import { roomAssignments, roomBlocks } from '../../../../db/schema/reservations';

import {
  isRoomAvailableNow,
} from '../../../../db/queries/catalog/rooms-availability';

describe('Catalog - rooms availability', () => {
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

  it('returns true for an available room with no assignments or blocks', async () => {
    const room = await createTestRoom(db, { status: 'available' });

    const available = await isRoomAvailableNow(room.id, '2026-03-01', db);

    expect(available).toBe(true);
  });

  it('returns false when room status is not available', async () => {
    const room = await createTestRoom(db, { status: 'occupied' });

    const available = await isRoomAvailableNow(room.id, '2026-03-01', db);

    expect(available).toBe(false);
  });

  it('returns false when room has an assignment on that date', async () => {
    const room = await createTestRoom(db, { status: 'available' });
    const reservation = await createTestReservation(db, userId);

    await db.insert(roomAssignments).values({
      reservationId: reservation.id,
      roomId: room.id,
      date: '2026-03-01',
      assignedBy: userId,
    });

    const available = await isRoomAvailableNow(room.id, '2026-03-01', db);

    expect(available).toBe(false);
  });

  it('returns false when room has an active block covering the date', async () => {
    const room = await createTestRoom(db, { status: 'available' });

    await db.insert(roomBlocks).values({
      roomId: room.id,
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      blockType: 'maintenance',
      releasedAt: null,
    });

    const available = await isRoomAvailableNow(room.id, '2026-03-03', db);

    expect(available).toBe(false);
  });

  it('returns true when the block has been released', async () => {
    const room = await createTestRoom(db, { status: 'available' });

    await db.insert(roomBlocks).values({
      roomId: room.id,
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      blockType: 'maintenance',
      releasedAt: new Date(),
    });

    const available = await isRoomAvailableNow(room.id, '2026-03-03', db);

    expect(available).toBe(true);
  });

  it('returns false for a non-existent room', async () => {
    const available = await isRoomAvailableNow(999999, '2026-03-01', db);
    expect(available).toBe(false);
  });
});
