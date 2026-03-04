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
  createTestReservationRoom,
  createTestRoomType,
  createTestRoom,
} from '../../factories';

import {
  listRoomsForReservation,
  findRoomConflicts,
  findRoomTypeConflicts,
} from '../../../../db/queries/reservations/reservation-rooms';

describe('Reservations - reservation rooms', () => {
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

  describe('listRoomsForReservation', () => {
    it('lists reservation rooms for a given reservation', async () => {
      // 1. Create a reservation and a room type
      const reservation = await createTestReservation(db, userId);
      const rt = await createTestRoomType(db);

      // 2. Add two reservation rooms with consecutive date ranges
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: rt.id,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-05',
      });
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: rt.id,
        checkInDate: '2026-03-05',
        checkOutDate: '2026-03-10',
      });

      // 3. Query rooms for the reservation
      const result = await listRoomsForReservation(reservation.id, db);

      // 2 rooms returned, first starts Mar 1
      expect(result).toHaveLength(2);
      expect(result[0].checkInDate).toBe('2026-03-01');
    });
  });

  describe('findRoomConflicts', () => {
    it('detects reservation rooms that overlap with a physical room in a date range', async () => {
      // 1. Create a reservation, room type, and physical room
      const reservation = await createTestReservation(db, userId);
      const rt = await createTestRoomType(db);
      const room = await createTestRoom(db, { roomTypeId: rt.id });

      // 2. Add a reservation room assigned to the physical room
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: rt.id,
        roomId: room.id,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-10',
      });

      // 3. Query for conflicts on an overlapping range
      const conflicts = await findRoomConflicts(
        room.id,
        '2026-03-05',
        '2026-03-15',
        db,
      );

      // 1 conflict found
      expect(conflicts).toHaveLength(1);
    });

    it('returns empty when no conflict exists', async () => {
      // 1. Create a room with no reservation rooms
      const room = await createTestRoom(db);

      // 2. Query for conflicts on a future range
      const conflicts = await findRoomConflicts(
        room.id,
        '2026-06-01',
        '2026-06-05',
        db,
      );
      // No conflicts
      expect(conflicts).toEqual([]);
    });
  });

  describe('findRoomTypeConflicts', () => {
    it('detects reservation rooms overlapping by room type', async () => {
      // 1. Create a reservation and a room type
      const reservation = await createTestReservation(db, userId);
      const rt = await createTestRoomType(db);

      // 2. Add a reservation room for the room type
      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: rt.id,
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-10',
      });

      // 3. Query for room-type conflicts on an overlapping range
      const conflicts = await findRoomTypeConflicts(
        rt.id,
        '2026-04-05',
        '2026-04-15',
        db,
      );

      // 1 conflict found
      expect(conflicts).toHaveLength(1);
    });
  });

  describe('FK constraints', () => {
    it('rejects reservation room with non-existent reservationId', async () => {
      // 1. Import schema and create a room type
      const { reservationRooms } = await import('../../../../db/schema/reservations');
      const rt = await createTestRoomType(db);
      const fakeReservationId = '00000000-0000-0000-0000-000000000000';

      // 2. Attempt to insert a reservation room with fake reservation ID
      await expect(
        db.insert(reservationRooms).values({
          reservationId: fakeReservationId,
          roomTypeId: rt.id,
          checkInDate: '2026-03-01',
          checkOutDate: '2026-03-05',
        }),
      // Throws FK violation
      ).rejects.toThrow();
    });
  });
});
