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
} from '../../setup';
import {
  createTestUser,
  createTestAgency,
  createTestGuest,
  createTestRoomType,
  createTestReservation,
} from '../../factories';
import {
  findAgencyByCode,
  searchAgencies,
  listAgencyReservations,
  createAgency,
  updateAgency,
} from '../../../queries/catalog/agencies';
import type { BaseUser } from '../../utils';
import { Agency, Guest, NewAgency } from 'src/db/schema';

describe('Agency Queries', () => {
  const db = getTestDb();
  let baseUser: BaseUser;

  beforeAll(() => {
    // DB client ready
  });

  beforeEach(async () => {
    await cleanupTestDb(db);

    baseUser = await createTestUser(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('findAgencyByCode', () => {
    it('should find agency by exact code', async () => {
      // 1. Seed two agencies with distinct codes
      await createTestAgency(db, { code: 'AGN001', name: 'Test Agency' });
      await createTestAgency(db, { code: 'AGN002', name: 'Other Agency' });

      // 2. Search by the first agency's code
      const result = await findAgencyByCode('AGN001', db);

      // Should return exactly one match with the correct name
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Agency');
    });

    it('should return empty when code not found', async () => {
      // 1. Search for a code that was never seeded
      const result = await findAgencyByCode('NONEXIST', db);

      // Should return an empty array
      expect(result).toEqual([]);
    });
  });

  describe('searchAgencies', () => {
    beforeEach(async () => {
      await createTestAgency(db, {
        name: 'Booking.com',
        isActive: true,
      });
      await createTestAgency(db, {
        name: 'Expedia Group',
        isActive: true,
      });
      await createTestAgency(db, {
        name: 'Inactive Booking',
        isActive: false,
      });
    });

    it('should find agencies by partial name match', async () => {
      // 1. Search for partial name 'booking' (active only)
      const results = await searchAgencies('booking', false, {}, db);

      // Should return only the active matching agency
      expect(results.data).toHaveLength(1);
      expect(results.data[0].name).toBe('Booking.com');
    });

    it('should exclude inactive agencies by default', async () => {
      // 1. Search with includeInactive = false
      const results = await searchAgencies('booking', false, {}, db);

      // Should return only active matches
      expect(results.data).toHaveLength(1);
      expect(results.data[0].isActive).toBe(true);
    });

    it('should include inactive agencies when requested', async () => {
      // 1. Search with includeInactive = true
      const results = await searchAgencies('booking', true, {}, db);

      // Should return both active and inactive matches
      expect(results.data).toHaveLength(2);
    });

    it('should return empty when no match', async () => {
      // 1. Search for a term that matches nothing
      const results = await searchAgencies('xyz', false, {}, db);

      // Should return empty data array
      expect(results.data).toEqual([]);
    });
  });

  describe('listAgencyReservations', () => {
    let agency: Agency;
    let guest: Guest;
    let roomType;

    beforeEach(async () => {
      agency = await createTestAgency(db);
      guest = await createTestGuest(db);
      roomType = await createTestRoomType(db);
    });

    it('should list all reservations for agency when no date range', async () => {
      // 1. Create two reservations for the agency in different months
      await createTestReservation(db, baseUser.id, {
        guestId: guest.id,
        agencyId: agency.id,
        checkInDate: '2026-01-01',
        checkOutDate: '2026-01-05',
      });
      await createTestReservation(db, baseUser.id, {
        guestId: guest.id,
        agencyId: agency.id,
        checkInDate: '2026-02-01',
        checkOutDate: '2026-02-05',
      });

      // 2. List reservations with no date filter
      const results = await listAgencyReservations(agency.id, undefined, db);

      // Should return both reservations
      expect(results).toHaveLength(2);
    });

    it('should filter by date range when provided', async () => {
      // 1. Create two reservations in different months
      await createTestReservation(db, baseUser.id, {
        guestId: guest.id,
        agencyId: agency.id,
        checkInDate: '2026-01-10',
        checkOutDate: '2026-01-15',
      });
      await createTestReservation(db, baseUser.id, {
        guestId: guest.id,
        agencyId: agency.id,
        checkInDate: '2026-03-01',
        checkOutDate: '2026-03-05',
      });

      // 2. List with a January-only date range
      const results = await listAgencyReservations(
        agency.id,
        { from: '2026-01-01', to: '2026-01-31' },
        db
      );

      // Should return only the January reservation
      expect(results).toHaveLength(1);
      expect(results[0].checkInDate).toBe('2026-01-10');
    });

    it('should return empty when agency has no reservations', async () => {
      // 1. List reservations for agency with no bookings
      const results = await listAgencyReservations(agency.id, undefined, db);

      // Should return empty array
      expect(results).toEqual([]);
    });
  });

  describe('createAgency', () => {
    it('creates an agency and returns it', async () => {
      // 1. Create a new agency with full details
      const agency = await createAgency(
        {
          name: 'New Travel Co',
          code: 'NTC001',
          type: 'agency',
          contactPerson: 'Mary',
          email: 'mary@ntc.com',
        },
        db,
      );

      // Should return with a generated id and correct fields
      expect(agency.id).toBeTruthy();
      expect(agency.name).toBe('New Travel Co');
      expect(agency.code).toBe('NTC001');
    });
  });

  describe('updateAgency', () => {
    it('updates agency fields', async () => {
      // 1. Seed a default agency
      const ag = await createTestAgency(db);

      // 2. Update commission and active status
      const updated = await updateAgency(
        ag.id,
        { commissionPercent: '15.00', isActive: false },
        db,
      );

      // Should reflect the new values
      expect(updated.commissionPercent).toBe('15.00');
      expect(updated.isActive).toBe(false);
    });
  });
});
