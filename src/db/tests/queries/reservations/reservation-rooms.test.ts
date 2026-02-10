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
      const reservation = await createTestReservation(db, userId);
      const rt = await createTestRoomType(db);

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

      const result = await listRoomsForReservation(reservation.id, db);

      expect(result).toHaveLength(2);
      expect(result[0].checkInDate).toBe('2026-03-01');
    });
  });

  describe('findRoomConflicts', () => {
    it('detects reservation rooms that overlap with a physical room in a date range', async () => {
      const reservation = await createTestReservation(db, userId);
      const rt = await createTestRoomType(db);
      const room = await createTestRoom(db, { roomTypeId: rt.id });

      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: rt.id,
        roomId: room.id,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-10',
      });

      const conflicts = await findRoomConflicts(
        room.id,
        '2026-03-05',
        '2026-03-15',
        db,
      );

      expect(conflicts).toHaveLength(1);
    });

    it('returns empty when no conflict exists', async () => {
      const room = await createTestRoom(db);

      const conflicts = await findRoomConflicts(
        room.id,
        '2026-06-01',
        '2026-06-05',
        db,
      );
      expect(conflicts).toEqual([]);
    });
  });

  describe('findRoomTypeConflicts', () => {
    it('detects reservation rooms overlapping by room type', async () => {
      const reservation = await createTestReservation(db, userId);
      const rt = await createTestRoomType(db);

      await createTestReservationRoom(db, userId, {
        reservationId: reservation.id,
        roomTypeId: rt.id,
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-10',
      });

      const conflicts = await findRoomTypeConflicts(
        rt.id,
        '2026-04-05',
        '2026-04-15',
        db,
      );

      expect(conflicts).toHaveLength(1);
    });
  });

  describe('FK constraints', () => {
    it('rejects reservation room with non-existent reservationId', async () => {
      const { reservationRooms } = await import('../../../../db/schema/reservations');
      const rt = await createTestRoomType(db);
      const fakeReservationId = '00000000-0000-0000-0000-000000000000';

      await expect(
        db.insert(reservationRooms).values({
          reservationId: fakeReservationId,
          roomTypeId: rt.id,
          checkInDate: '2026-03-01',
          checkOutDate: '2026-03-05',
        }),
      ).rejects.toThrow();
    });
  });
});
