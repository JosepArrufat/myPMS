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
      // 1. Create a room
      const room = await createTestRoom(db);

      // 2. Insert 3 blocks: active overlapping, active non-overlapping, released overlapping
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

      // 3. Query active blocks for the overlapping range
      const result = await listActiveBlocksForRange(
        '2026-03-05',
        '2026-03-15',
        db,
      );

      // Only the active overlapping block returned
      expect(result).toHaveLength(1);
      expect(result[0].blockType).toBe('maintenance');
    });
  });

  describe('listBlocksForRoom', () => {
    it('lists all blocks for a room (active and released)', async () => {
      // 1. Create a room
      const room = await createTestRoom(db);

      // 2. Insert one active and one released block
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

      // 3. Query all blocks for the room
      const result = await listBlocksForRoom(room.id, db);

      // Both blocks returned, ordered by startDate
      expect(result).toHaveLength(2);
      expect(result[0].startDate).toBe('2026-03-01');
    });
  });

  describe('createRoomBlock (transactional)', () => {
    it('creates a block and decrements inventory', async () => {
      // 1. Create a room type
      const rt = await createTestRoomType(db);

      // 2. Seed inventory for 2 days at 10 available each
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

      // 3. Create a room block for quantity 2
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

      // Correct block type and quantity
      expect(block.blockType).toBe('group_hold');
      expect(block.quantity).toBe(2);

      // 4. Verify inventory decremented to 8
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
      // 1. Create a room type
      const rt = await createTestRoomType(db);

      // 2. Seed inventory for 2 days at 10 available each
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

      // 3. Create a block for quantity 3
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

      // Verify: availability dropped to 7
      const availBefore = await getAvailabilityByDay(
        rt.id,
        '2026-05-01',
        '2026-05-03',
        db,
      );
      expect(availBefore[0].available).toBe(7);

      // 4. Release the block
      await releaseRoomBlock(block.id, db);

      // Verify: availability restored to 10
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
      // 1. Attempt to release a non-existent block
      await expect(
        releaseRoomBlock(999999, db),
      // Throws "block not found"
      ).rejects.toThrow('block not found');
    });
  });

  describe('FK constraints', () => {
    it('rejects block with non-existent roomId', async () => {
      // 1. Attempt to insert a block with a fake room ID
      await expect(
        db.insert(roomBlocks).values({
          roomId: 999999,
          startDate: '2026-03-01',
          endDate: '2026-03-05',
          blockType: 'maintenance',
        }),
      // Throws FK violation
      ).rejects.toThrow();
    });
  });
});
