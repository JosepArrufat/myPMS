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

import { createTestGuest } from '../../factories';

import {
  createGuest,
  updateGuest,
  findGuestById,
  findGuestByEmail,
  searchGuests,
  listVipGuests,
} from '../../../../db/queries/catalog/guests';

describe('Catalog - guests', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('findGuestByEmail', () => {
    it('finds a guest by exact email', async () => {
      // 1. Seed two guests with different emails
      await createTestGuest(db, { email: 'alice@example.com' });
      await createTestGuest(db, { email: 'bob@example.com' });

      // 2. Look up by Alice's email
      const result = await findGuestByEmail('alice@example.com', db);

      // Should return exactly one match
      expect(result).toHaveLength(1);
      // Returned email matches the lookup
      expect(result[0].email).toBe('alice@example.com');
    });

    it('returns empty when email does not exist', async () => {
      // 1. Search for a non-existent email
      const result = await findGuestByEmail('nobody@example.com', db);

      // Should return empty array
      expect(result).toEqual([]);
    });
  });

  describe('searchGuests', () => {
    it('matches by first name, last name, or email (case-insensitive)', async () => {
      // 1. Seed three guests with distinct names and emails
      await createTestGuest(db, {
        firstName: 'Alice',
        lastName: 'Wonder',
        email: 'alice@example.com',
      });
      await createTestGuest(db, {
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@example.com',
      });
      await createTestGuest(db, {
        firstName: 'Charlie',
        lastName: 'Wonderland',
        email: 'charlie@example.com',
      });

      // 2. Search by first name
      const byFirst = await searchGuests('alice', {}, db);
      // Only Alice matches
      expect(byFirst.data).toHaveLength(1);
      expect(byFirst.data[0].firstName).toBe('Alice');

      // 3. Search by last name substring
      const byLast = await searchGuests('wonder', {}, db);
      // Alice Wonder + Charlie Wonderland both match
      expect(byLast.data).toHaveLength(2);

      // 4. Search by email prefix
      const byEmail = await searchGuests('bob@', {}, db);
      // Only Bob matches
      expect(byEmail.data).toHaveLength(1);
      expect(byEmail.data[0].firstName).toBe('Bob');
    });

    it('returns empty when no guest matches', async () => {
      // 1. Seed a guest with default fields
      await createTestGuest(db);

      // 2. Search for a term that matches nothing
      const result = await searchGuests('zzz_no_match', {}, db);
      // Should return empty data array
      expect(result.data).toEqual([]);
    });
  });

  describe('listVipGuests', () => {
    it('returns only guests with vipStatus true', async () => {
      // 1. Seed one VIP guest and one regular guest
      await createTestGuest(db, {
        firstName: 'VIP',
        email: 'vip@example.com',
        vipStatus: true,
      });
      await createTestGuest(db, {
        firstName: 'Regular',
        email: 'regular@example.com',
        vipStatus: false,
      });

      // 2. Fetch VIP-only list
      const result = await listVipGuests(db);

      // Should return only the VIP guest
      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe('VIP');
    });

    it('returns empty when no VIP guests exist', async () => {
      // 1. Seed a non-VIP guest
      await createTestGuest(db, { vipStatus: false });

      // 2. Fetch VIP list
      const result = await listVipGuests(db);
      // Should return empty array
      expect(result).toEqual([]);
    });
  });

  describe('createGuest', () => {
    it('creates a guest and returns it with an id', async () => {
      // 1. Create a guest with full contact details
      const guest = await createGuest(
        {
          firstName: 'New',
          lastName: 'Guest',
          email: 'new@example.com',
          phone: '+1555000000',
        },
        db,
      );

      // Should have a generated id and correct fields
      expect(guest.id).toBeTruthy();
      expect(guest.firstName).toBe('New');
      expect(guest.email).toBe('new@example.com');
    });
  });

  describe('updateGuest', () => {
    it('updates guest fields and returns updated record', async () => {
      // 1. Seed a non-VIP guest
      const guest = await createTestGuest(db, { vipStatus: false });

      // 2. Update VIP status and phone number
      const updated = await updateGuest(
        guest.id,
        { vipStatus: true, phone: '+9990000000' },
        db,
      );

      // Should reflect the new values
      expect(updated.vipStatus).toBe(true);
      expect(updated.phone).toBe('+9990000000');
      // Unchanged fields should persist
      expect(updated.firstName).toBe(guest.firstName);
    });
  });

  describe('findGuestById', () => {
    it('returns the guest by UUID', async () => {
      // 1. Seed a guest
      const guest = await createTestGuest(db);

      // 2. Look up by its UUID
      const result = await findGuestById(guest.id, db);

      // Should return exactly one match with the same id
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(guest.id);
    });

    it('returns empty for non-existent ID', async () => {
      // 1. Look up a UUID that was never seeded
      const result = await findGuestById(
        '00000000-0000-0000-0000-000000000000',
        db,
      );

      // Should return empty array
      expect(result).toEqual([]);
    });
  });
});
