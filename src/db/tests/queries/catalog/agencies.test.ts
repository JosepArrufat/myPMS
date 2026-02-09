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
      await createTestAgency(db, { code: 'AGN001', name: 'Test Agency' });
      await createTestAgency(db, { code: 'AGN002', name: 'Other Agency' });

      const result = await findAgencyByCode('AGN001', db);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Agency');
    });

    it('should return empty when code not found', async () => {
      const result = await findAgencyByCode('NONEXIST', db);

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
      const results = await searchAgencies('booking', false, db);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Booking.com');
    });

    it('should exclude inactive agencies by default', async () => {
      const results = await searchAgencies('booking', false, db);

      expect(results).toHaveLength(1);
      expect(results[0].isActive).toBe(true);
    });

    it('should include inactive agencies when requested', async () => {
      const results = await searchAgencies('booking', true, db);

      expect(results).toHaveLength(2);
    });

    it('should return empty when no match', async () => {
      const results = await searchAgencies('xyz', false, db);

      expect(results).toEqual([]);
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

      const results = await listAgencyReservations(agency.id, undefined, db);

      expect(results).toHaveLength(2);
    });

    it('should filter by date range when provided', async () => {
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

      const results = await listAgencyReservations(
        agency.id,
        { from: '2026-01-01', to: '2026-01-31' },
        db
      );

      expect(results).toHaveLength(1);
      expect(results[0].checkInDate).toBe('2026-01-10');
    });

    it('should return empty when agency has no reservations', async () => {
      const results = await listAgencyReservations(agency.id, undefined, db);

      expect(results).toEqual([]);
    });
  });
});
