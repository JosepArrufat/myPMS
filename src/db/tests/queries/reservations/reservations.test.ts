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
      // 1. Create a reservation with a known number
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'RES-001',
      });

      // 2. Query by that reservation number
      const result = await findReservationByNumber('RES-001', db);

      // Exactly 1 match with the correct number
      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('RES-001');
    });

    it('returns empty when number does not exist', async () => {
      // 1. Query for a non-existent reservation number
      const result = await findReservationByNumber('NONE', db);
      // Empty array returned
      expect(result).toEqual([]);
    });
  });

  describe('listGuestReservations', () => {
    it('lists all reservations for a guest ordered by checkInDate', async () => {
      // 1. Create two reservations for the guest (early + late dates)
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

      // 2. Query reservations for the guest
      const result = await listGuestReservations(guestId, db);

      // 2 results, ordered early-then-late by check-in date
      expect(result).toHaveLength(2);
      expect(result[0].reservationNumber).toBe('EARLY');
      expect(result[1].reservationNumber).toBe('LATE');
    });
  });

  describe('listReservationsForStayWindow', () => {
    it('returns confirmed/checked_in reservations overlapping the window', async () => {
      // 1. Create three reservations: overlapping confirmed, outside confirmed, cancelled overlapping
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

      // 2. Query the stay window Mar 5–15
      const result = await listReservationsForStayWindow(
        '2026-03-05',
        '2026-03-15',
        db,
      );

      // Only the overlapping confirmed reservation survives
      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('OVERLAP');
    });
  });

  describe('listArrivalsForDate', () => {
    it('returns confirmed/checked_in arrivals for a specific date', async () => {
      // 1. Create a confirmed and a cancelled reservation arriving same date
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

      // 2. Query arrivals for Mar 10
      const result = await listArrivalsForDate('2026-03-10', db);

      // Only the confirmed arrival returned
      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('ARR1');
    });
  });

  describe('listDeparturesForDate', () => {
    it('returns only checked_in reservations departing on the date', async () => {
      // 1. Create a checked_in and a confirmed reservation departing same date
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

      // 2. Query departures for Mar 10
      const result = await listDeparturesForDate('2026-03-10', db);

      // Only the checked_in reservation returned
      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('DEP1');
    });
  });

  describe('listReservationsForAgency', () => {
    it('lists reservations linked to an agency', async () => {
      // 1. Create an agency
      const agency = await createTestAgency(db);

      // 2. Create one reservation with the agency, one without
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'AG1',
        agencyId: agency.id,
      });
      await createTestReservation(db, userId, {
        guestId,
        reservationNumber: 'NOAG',
      });

      // 3. Query reservations for the agency
      const result = await listReservationsForAgency(agency.id, undefined, db);

      // Only the agency-linked reservation returned
      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('AG1');
    });

    it('filters by date range when provided', async () => {
      // 1. Create an agency
      const agency = await createTestAgency(db);

      // 2. Create two agency reservations with different date windows
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

      // 3. Query with a date range filter
      const result = await listReservationsForAgency(
        agency.id,
        { from: '2026-02-01', to: '2026-04-01' },
        db,
      );

      // Only the reservation inside the range returned
      expect(result).toHaveLength(1);
      expect(result[0].reservationNumber).toBe('IN');
    });
  });

  describe('createReservation', () => {
    it('creates a reservation with room and daily rates', async () => {
      // 1. Create a room type
      const roomType = await createTestRoomType(db);

      // 2. Seed inventory for 2 nights
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-01', available: 5 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-02', available: 5 });

      // 3. Create the reservation with room and daily rates
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

      // Result defined with correct number and guest
      expect(result).toBeDefined();
      expect(result.reservationNumber).toBe('CR-001');
      expect(result.guestId).toBe(guestId);
    });

    it('rejects when room inventory is sold out', async () => {
      // 1. Create a room type
      const roomType = await createTestRoomType(db);

      // 2. Seed inventory with 0 available
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-01', available: 0 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-02', available: 0 });

      // 3. Attempt to create reservation – should throw
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
      ).rejects.toThrow('Insufficient availability');
    });

    it('rolls back the reservation when inventory fails', async () => {
      // 1. Create a room type
      const roomType = await createTestRoomType(db);

      // 2. Seed inventory – night 1 available, night 2 sold out
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-01', available: 1 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-06-02', available: 0 });

      // 3. Attempt to create reservation – should throw
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
      ).rejects.toThrow('Insufficient availability');

      // 4. Verify the reservation was not persisted (whole transaction rolled back)
      const rows = await findReservationByNumber('CR-ROLLBACK', db);
      expect(rows).toHaveLength(0);
    });
  });

  // Separate pool (max:2) so two transactions run in parallel
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
      // 1. Create a room type
      const roomType = await createTestRoomType(db);

      // 2. Seed inventory with only 1 available per night
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-07-01', available: 1 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-07-02', available: 1 });

      // 3. Build a reusable booking input helper
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

      // 4. Fire both bookings concurrently
      const results = await Promise.allSettled([
        createReservation(makeInput('RACE-A'), concDb),
        createReservation(makeInput('RACE-B'), concDb),
      ]);

      // Exactly 1 fulfilled, 1 rejected with availability error
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
        /Insufficient availability/i,
      );
    });

    it('both bookings succeed when availability is 2', async () => {
      // 1. Create a room type
      const roomType = await createTestRoomType(db);

      // 2. Seed inventory with 2 available per night
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-08-01', available: 2 });
      await createTestRoomInventory(db, { roomTypeId: roomType.id, date: '2026-08-02', available: 2 });

      // 3. Build a reusable booking input helper
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

      // 4. Fire both bookings concurrently
      const results = await Promise.allSettled([
        createReservation(makeInput('BOTH-A'), concDb),
        createReservation(makeInput('BOTH-B'), concDb),
      ]);

      // Both fulfilled since availability is sufficient
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(2);
    });
  });

  describe('FK constraints', () => {
    it('rejects a reservation with non-existent guestId', async () => {
      // 1. Import schema and define a fake guest ID
      const { reservations } = await import('../../../../db/schema/reservations');
      const fakeGuestId = '00000000-0000-0000-0000-000000000000';

      // 2. Attempt to insert a reservation with the fake guest
      await expect(
        db.insert(reservations).values({
          reservationNumber: 'FK-TEST',
          guestId: fakeGuestId,
          guestNameSnapshot: 'Ghost',
          checkInDate: '2026-03-01',
          checkOutDate: '2026-03-05',
          createdBy: userId,
        }),
      // Throws FK violation
      ).rejects.toThrow();
    });
  });
});
