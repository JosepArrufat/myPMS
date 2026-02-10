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
      await createTestGuest(db, { email: 'alice@example.com' });
      await createTestGuest(db, { email: 'bob@example.com' });

      const result = await findGuestByEmail('alice@example.com', db);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('alice@example.com');
    });

    it('returns empty when email does not exist', async () => {
      const result = await findGuestByEmail('nobody@example.com', db);

      expect(result).toEqual([]);
    });
  });

  describe('searchGuests', () => {
    it('matches by first name, last name, or email (case-insensitive)', async () => {
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

      const byFirst = await searchGuests('alice', db);
      expect(byFirst).toHaveLength(1);
      expect(byFirst[0].firstName).toBe('Alice');

      const byLast = await searchGuests('wonder', db);
      expect(byLast).toHaveLength(2);

      const byEmail = await searchGuests('bob@', db);
      expect(byEmail).toHaveLength(1);
      expect(byEmail[0].firstName).toBe('Bob');
    });

    it('returns empty when no guest matches', async () => {
      await createTestGuest(db);

      const result = await searchGuests('zzz_no_match', db);
      expect(result).toEqual([]);
    });
  });

  describe('listVipGuests', () => {
    it('returns only guests with vipStatus true', async () => {
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

      const result = await listVipGuests(db);

      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe('VIP');
    });

    it('returns empty when no VIP guests exist', async () => {
      await createTestGuest(db, { vipStatus: false });

      const result = await listVipGuests(db);
      expect(result).toEqual([]);
    });
  });
});
