import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb, cleanupTestDb, verifyDbIsEmpty } from '../setup';
import {
  createTestUser,
  createTestGuest,
  createTestRoomType,
  createTestRoom,
  createTestReservation,
} from '../factories';

describe('Factory Examples', () => {
  const db = getTestDb();

  afterAll(async () => {
    await cleanupTestDb(db);
    await verifyDbIsEmpty(db);
  });

  it('should create a test user', async () => {
    const user = await createTestUser(db);
    
    expect(user.email).toContain('@example.com');
    expect(user.firstName).toBe('Test');
    expect(user.isActive).toBe(true);
  });

  it('should create a test guest with overrides', async () => {
    const guest = await createTestGuest(db, {
      firstName: 'Jane',
      lastName: 'Smith',
      vipStatus: true,
    });
    
    expect(guest.firstName).toBe('Jane');
    expect(guest.lastName).toBe('Smith');
    expect(guest.vipStatus).toBe(true);
  });

  it('should create related entities (room type -> room)', async () => {
    const roomType = await createTestRoomType(db, {
      basePrice: '250.00',
    });
    
    const room = await createTestRoom(
      db,
      roomType.id,
      { floor: 5 }
    );
    
    expect(room.roomTypeId).toBe(roomType.id);
    expect(room.floor).toBe(5);
    expect(room.status).toBe('available');
  });

  it('should use factories in a transaction', async () => {
    await db.transaction(async (tx) => {
      const guest = await createTestGuest(db, {}, tx);
      
      const reservation = await createTestReservation(
        db,
        { guestId: guest.id },
        tx
      );
      
      expect(reservation.guestId).toBe(guest.id);
    });
  });
});
