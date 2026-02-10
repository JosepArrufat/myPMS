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
  getConcurrentTestDb,
} from '../../setup';
import type { TestDb } from '../../setup';

import {
  createTestUser,
  createTestGuest,
  createTestReservation,
  createTestAgency,
  createTestRoomType,
  createTestRoomInventory,
} from '../../factories';

import {
  findReservationByNumber,
  listGuestReservations,
  listReservationsForStayWindow,
  listArrivalsForDate,
  listDeparturesForDate,
  listReservationsForAgency,
  createReservation,
} from '../../../../db/queries/reservations/reservations';

describe('Reservations - reservations', () => {
  const db = getTestDb();
  let userId: number;
  let guestId: string;

  beforeEach(async () => {
    await cleanupTestDb(db);
    const u = await createTestUser(db);
    userId = u.id;
    const g = await createTestGuest(db);
    guestId = g.id;
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('findReservationByNumber', () => {
    it('finds a reservation by exact number', async () => {
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'RES-001',
      });

      const result = await findReservationByNumber('RES-001', db);

      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('RES-001');
    });

    it('returns empty when number does not exist', async () => {
      const result = await findReservationByNumber('NONE', db);
      expect(result).toEqual([]);
    });
  });

  describe('listGuestReservations', () => {
    it('lists all reservations for a guest ordered by checkInDate', async () => {
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'EARLY',
        checkInDate: '2026-02-01',
        checkOutDate: '2026-02-05',
      });
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'LATE',
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-05',
      });

      const result = await listGuestReservations(guestId, db);

      expect(result).toHaveLength(2);
      expect(result[0].reservationNumber).toBe('EARLY');
      expect(result[1].reservationNumber).toBe('LATE');
    });
  });

  describe('listReservationsForStayWindow', () => {
    it('returns confirmed/checked_in reservations overlapping the window', async () => {
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'OVERLAP',
        status: 'confirmed',
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-10',
      });
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'OUTSIDE',
        status: 'confirmed',
        checkInDate: '2026-05-01',
        checkOutDate: '2026-05-05',
      });
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'CANCELLED',
        status: 'cancelled',
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-10',
      });

      const result = await listReservationsForStayWindow(
        '2026-03-05',
        '2026-03-15',
        db,
      );

      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('OVERLAP');
    });
  });

  describe('listArrivalsForDate', () => {
    it('returns confirmed/checked_in arrivals for a specific date', async () => {
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'ARR1',
        status: 'confirmed',
        checkInDate: '2026-03-10',
        checkOutDate: '2026-03-15',
      });
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'ARR2',
        status: 'cancelled',
        checkInDate: '2026-03-10',
        checkOutDate: '2026-03-15',
      });

      const result = await listArrivalsForDate('2026-03-10', db);

      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('ARR1');
    });
  });

  describe('listDeparturesForDate', () => {
    it('returns only checked_in reservations departing on the date', async () => {
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'DEP1',
        status: 'checked_in',
        checkInDate: '2026-03-05',
        checkOutDate: '2026-03-10',
      });
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'DEP2',
        status: 'confirmed',
        checkInDate: '2026-03-05',
        checkOutDate: '2026-03-10',
      });

      const result = await listDeparturesForDate('2026-03-10', db);

      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('DEP1');
    });
  });

  describe('listReservationsForAgency', () => {
    it('lists reservations linked to an agency', async () => {
      const agency = await createTestAgency(db);

      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'AG1',
        agencyId: agency.id,
      });
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'NOAG',
      });

      const result = await listReservationsForAgency(agency.id, undefined, db);

      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('AG1');
    });

    it('filters by date range when provided', async () => {
      const agency = await createTestAgency(db);

      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'IN',
        agencyId: agency.id,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-05',
      });
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'OUT',
        agencyId: agency.id,
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-05',
      });

      const result = await listReservationsForAgency(
        agency.id,
        { from: '2026-02-01', to: '2026-04-01' },
        db,
      );

      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('IN');
    });
  });

  describe('createReservation', () => {
    it('creates a reservation with room and daily rates', async () => {
      const roomType = await createTestRoomType(db);

      // Inventory for 2 nights
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-01', available: 5 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-02', available: 5 });

      const result = await createReservation({
        reservation: {
          reservationNumber: 'CR-001',
          guestId,
          guestNameSnapshot: 'Test Guest',
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-03',
          adultsCount: 2,
          childrenCount: 0,
          status: 'confirmed',
          createdBy: userId,
        },
        rooms: [{
          roomTypeId: roomType.id,
          checkInDate: '2026-06-01',
          checkOutDate: '2026-06-03',
          dailyRates: [
            { date: '2026-06-01', rate: '100.00' },
            { date: '2026-06-02', rate: '100.00' },
          ],
        }],
      }, db);

      expect(result).toBeDefined();
      expect(result.reservationNumber).toBe('CR-001');
      expect(result.guestId).toBe(guestId);
    });

    it('rejects when room inventory is sold out', async () => {
      const roomType = await createTestRoomType(db);

      // Inventory with 0 available
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-01', available: 0 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-02', available: 0 });

      await expect(
        createReservation({
          reservation: {
            reservationNumber: 'CR-SOLD',
            guestId,
            guestNameSnapshot: 'Test Guest',
            checkInDate: '2026-06-01',
            checkOutDate: '2026-06-03',
            adultsCount: 1,
            childrenCount: 0,
            status: 'confirmed',
            createdBy: userId,
          },
          rooms: [{
            roomTypeId: roomType.id,
            checkInDate: '2026-06-01',
            checkOutDate: '2026-06-03',
            dailyRates: [
              { date: '2026-06-01', rate: '100.00' },
              { date: '2026-06-02', rate: '100.00' },
            ],
          }],
        }, db),
      ).rejects.toThrow('sold out');
    });

    it('rolls back the reservation when inventory fails', async () => {
      const roomType = await createTestRoomType(db);

      // First night available, second sold out → should roll back entirely
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-01', available: 1 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-02', available: 0 });

      await expect(
        createReservation({
          reservation: {
            reservationNumber: 'CR-ROLLBACK',
            guestId,
            guestNameSnapshot: 'Test Guest',
            checkInDate: '2026-06-01',
            checkOutDate: '2026-06-03',
            adultsCount: 1,
            childrenCount: 0,
            status: 'confirmed',
            createdBy: userId,
          },
          rooms: [{
            roomTypeId: roomType.id,
            checkInDate: '2026-06-01',
            checkOutDate: '2026-06-03',
            dailyRates: [
              { date: '2026-06-01', rate: '100.00' },
              { date: '2026-06-02', rate: '100.00' },
            ],
          }],
        }, db),
      ).rejects.toThrow('sold out');

      // Reservation must NOT exist — the whole transaction rolled back
      const rows = await findReservationByNumber('CR-ROLLBACK', db);
      expect(rows).toHaveLength(0);
    });
  });

  // ─── Race-condition tests ───────────────────────────────────────────
  // Uses a separate pool with max:2 so two transactions can truly
  // run in parallel against the same Postgres database.
  describe('Race condition – concurrent bookings', () => {
    let concDb: TestDb;
    let closeConcPool: () => Promise<void>;

    beforeAll(() => {
      const { db: cdb, close } = getConcurrentTestDb();
      concDb = cdb;
      closeConcPool = close;
    });

    afterAll(async () => {
      await closeConcPool();
    });

    it('only one of two simultaneous bookings succeeds when availability is 1', async () => {
      const roomType = await createTestRoomType(db);

      // Only 1 room available per night
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-07-01', available: 1 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-07-02', available: 1 });

      const makeInput = (resNumber: string) => ({
        reservation: {
          reservationNumber: resNumber,
          guestId,
          guestNameSnapshot: 'Test Guest',
          checkInDate: '2026-07-01' as string,
          checkOutDate: '2026-07-03' as string,
          adultsCount: 1,
          childrenCount: 0,
          status: 'confirmed' as const,
          createdBy: userId,
        },
        rooms: [{
          roomTypeId: roomType.id,
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-03',
          dailyRates: [
            { date: '2026-07-01', rate: '100.00' },
            { date: '2026-07-02', rate: '100.00' },
          ],
        }],
      });

      // Fire both bookings at the same time
      const results = await Promise.allSettled([
        createReservation(makeInput('RACE-A'), concDb),
        createReservation(makeInput('RACE-B'), concDb),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
        /sold out/i,
      );
    });

    it('both bookings succeed when availability is 2', async () => {
      const roomType = await createTestRoomType(db);

      // 2 rooms available per night — both should succeed
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-08-01', available: 2 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-08-02', available: 2 });

      const makeInput = (resNumber: string) => ({
        reservation: {
          reservationNumber: resNumber,
          guestId,
          guestNameSnapshot: 'Test Guest',
          checkInDate: '2026-08-01' as string,
          checkOutDate: '2026-08-03' as string,
          adultsCount: 1,
          childrenCount: 0,
          status: 'confirmed' as const,
          createdBy: userId,
        },
        rooms: [{
          roomTypeId: roomType.id,
          checkInDate: '2026-08-01',
          checkOutDate: '2026-08-03',
          dailyRates: [
            { date: '2026-08-01', rate: '100.00' },
            { date: '2026-08-02', rate: '100.00' },
          ],
        }],
      });

      const results = await Promise.allSettled([
        createReservation(makeInput('BOTH-A'), concDb),
        createReservation(makeInput('BOTH-B'), concDb),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(2);
    });
  });

  describe('FK constraints', () => {
    it('rejects a reservation with non-existent guestId', async () => {
      const { reservations } = await import('../../../../db/schema/reservations');
      const fakeGuestId = '00000000-0000-0000-0000-000000000000';

      await expect(
        db.insert(reservations).values({
          reservationNumber: 'FK-TEST',
          guestId: fakeGuestId,
          guestNameSnapshot: 'Ghost',
          checkInDate: '2026-03-01',
          checkOutDate: '2026-03-05',
          createdBy: userId,
        }),
      ).rejects.toThrow();
    });
  });
});
