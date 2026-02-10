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
  createTestRoomType,
  createTestRoomInventory,
} from '../../factories';

import { roomBlocks } from '../../../../db/schema/reservations';

import {
  listActiveBlocksForRange,
  listBlocksForRoom,
  createRoomBlock,
  releaseRoomBlock,
} from '../../../../db/queries/reservations/room-blocks';

import {
  getAvailabilityByDay,
} from '../../../../db/queries/catalog/rooms';

describe('Reservations - room blocks', () => {
  const db = getTestDb();

  beforeEach(async () => {
    await cleanupTestDb(db);
  });

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  describe('listActiveBlocksForRange', () => {
    it('returns unreleased blocks overlapping the date range', async () => {
      const room = await createTestRoom(db);

      await db.insert(roomBlocks).values({
        roomId: room.id,
        startDate: '2026-03-01',
        endDate: '2026-03-10',
        blockType: 'maintenance',
        releasedAt: null,
      });
      await db.insert(roomBlocks).values({
        roomId: room.id,
        startDate: '2026-06-01',
        endDate: '2026-06-10',
        blockType: 'renovation',
        releasedAt: null,
      });
      await db.insert(roomBlocks).values({
        roomId: room.id,
        startDate: '2026-03-01',
        endDate: '2026-03-10',
        blockType: 'vip_hold',
        releasedAt: new Date(),
      });

      const result = await listActiveBlocksForRange(
        '2026-03-05',
        '2026-03-15',
        db,
      );

      expect(result).toHaveLength(1);
      expect(result[0].blockType).toBe('maintenance');
    });
  });

  describe('listBlocksForRoom', () => {
    it('lists all blocks for a room (active and released)', async () => {
      const room = await createTestRoom(db);

      await db.insert(roomBlocks).values({
        roomId: room.id,
        startDate: '2026-03-01',
        endDate: '2026-03-05',
        blockType: 'maintenance',
      });
      await db.insert(roomBlocks).values({
        roomId: room.id,
        startDate: '2026-04-01',
        endDate: '2026-04-05',
        blockType: 'renovation',
        releasedAt: new Date(),
      });

      const result = await listBlocksForRoom(room.id, db);

      expect(result).toHaveLength(2);
      expect(result[0].startDate).toBe('2026-03-01');
    });
  });

  describe('createRoomBlock (transactional)', () => {
    it('creates a block and decrements inventory', async () => {
      const rt = await createTestRoomType(db);

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-05-01',
        available: 10,
      });
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-05-02',
        available: 10,
      });

      const block = await createRoomBlock(
        {
          roomTypeId: rt.id,
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          blockType: 'group_hold',
          quantity: 2,
        },
        db,
      );

      expect(block.blockType).toBe('group_hold');
      expect(block.quantity).toBe(2);

      const avail = await getAvailabilityByDay(
        rt.id,
        '2026-05-01',
        '2026-05-03',
        db,
      );
      expect(avail[0].available).toBe(8);
      expect(avail[1].available).toBe(8);
    });
  });

  describe('releaseRoomBlock (transactional)', () => {
    it('releases a block and restores inventory', async () => {
      const rt = await createTestRoomType(db);

      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-05-01',
        available: 10,
      });
      await createTestRoomInventory(db, {
        roomTypeId: rt.id,
        date: '2026-05-02',
        available: 10,
      });

      const block = await createRoomBlock(
        {
          roomTypeId: rt.id,
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          blockType: 'maintenance',
          quantity: 3,
        },
        db,
      );

      const availBefore = await getAvailabilityByDay(
        rt.id,
        '2026-05-01',
        '2026-05-03',
        db,
      );
      expect(availBefore[0].available).toBe(7);

      await releaseRoomBlock(block.id, db);

      const availAfter = await getAvailabilityByDay(
        rt.id,
        '2026-05-01',
        '2026-05-03',
        db,
      );
      expect(availAfter[0].available).toBe(10);
      expect(availAfter[1].available).toBe(10);
    });

    it('throws when block does not exist', async () => {
      await expect(
        releaseRoomBlock(999999, db),
      ).rejects.toThrow('block not found');
    });
  });

  describe('FK constraints', () => {
    it('rejects block with non-existent roomId', async () => {
      await expect(
        db.insert(roomBlocks).values({
          roomId: 999999,
          startDate: '2026-03-01',
          endDate: '2026-03-05',
          blockType: 'maintenance',
        }),
      ).rejects.toThrow();
    });
  });
});
