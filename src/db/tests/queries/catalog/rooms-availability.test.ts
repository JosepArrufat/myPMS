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
    // 1. Create a room with "available" status
    const room = await createTestRoom(db, { status: 'available' });

    // 2. Check availability for that date
    const available = await isRoomAvailableNow(room.id, '2026-03-01', db);

    // Room should be available
    expect(available).toBe(true);
  });

  it('returns false when room status is not available', async () => {
    // 1. Create a room with "occupied" status
    const room = await createTestRoom(db, { status: 'occupied' });

    // 2. Check availability
    const available = await isRoomAvailableNow(room.id, '2026-03-01', db);

    // Should be unavailable
    expect(available).toBe(false);
  });

  it('returns false when room has an assignment on that date', async () => {
    // 1. Create an available room and a reservation
    const room = await createTestRoom(db, { status: 'available' });
    const reservation = await createTestReservation(db, userId);

    // 2. Insert a room assignment for that date
    await db.insert(roomAssignments).values({
      reservationId: reservation.id,
      roomId: room.id,
      date: '2026-03-01',
      assignedBy: userId,
    });

    // 3. Check availability
    const available = await isRoomAvailableNow(room.id, '2026-03-01', db);

    // Should be unavailable due to the assignment
    expect(available).toBe(false);
  });

  it('returns false when room has an active block covering the date', async () => {
    // 1. Create an available room
    const room = await createTestRoom(db, { status: 'available' });

    // 2. Insert an active maintenance block (Mar 1–5)
    await db.insert(roomBlocks).values({
      roomId: room.id,
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      blockType: 'maintenance',
      releasedAt: null,
    });

    // 3. Check availability for Mar 3
    const available = await isRoomAvailableNow(room.id, '2026-03-03', db);

    // Should be unavailable due to the block
    expect(available).toBe(false);
  });

  it('returns true when the block has been released', async () => {
    // 1. Create an available room
    const room = await createTestRoom(db, { status: 'available' });

    // 2. Insert a released block (releasedAt set)
    await db.insert(roomBlocks).values({
      roomId: room.id,
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      blockType: 'maintenance',
      releasedAt: new Date(),
    });

    // 3. Check availability
    const available = await isRoomAvailableNow(room.id, '2026-03-03', db);

    // Should be available since block was released
    expect(available).toBe(true);
  });

  it('returns false for a non-existent room', async () => {
    // 1. Query availability for a non-existent room ID
    const available = await isRoomAvailableNow(999999, '2026-03-01', db);
    // Should be unavailable
    expect(available).toBe(false);
  });
});
