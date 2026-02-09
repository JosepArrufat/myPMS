import type { 
  Reservation, 
  NewReservation,
  ReservationRoom,
  NewReservationRoom
} from '../../schema/reservations';
import { 
  reservations, 
  reservationRooms 
} from '../../schema/reservations';
import type { TestDb } from '../setup';

export const createTestReservation = async (
  db: TestDb,
  userId: number,
  overrides: Partial<NewReservation> = {},
  tx?: any
): Promise<Reservation> => {
  const conn = tx ?? db;
  const timestamp = Date.now();
  
  let guestId = overrides.guestId;
  if (!guestId) {
    const { createTestGuest } = await import('./guests');
    const guest = await createTestGuest(db, {}, tx);
    guestId = guest.id;
  }
  
  const [reservation] = await conn
    .insert(reservations)
    .values({
      reservationNumber: `RES${timestamp}`,
      guestId,
      guestNameSnapshot: 'Test Guest',
      checkInDate: '2026-02-10',
      checkOutDate: '2026-02-15',
      adultsCount: 2,
      childrenCount: 0,
      status: 'confirmed',
      createdBy: userId,
      ...overrides,
    })
    .returning();
  
  return reservation;
};

export const createTestReservationRoom = async (
  db: TestDb,
  userId: number,
  overrides: Partial<NewReservationRoom> = {},
  tx?: any
): Promise<ReservationRoom> => {
  const conn = tx ?? db;
  
  let reservationId = overrides.reservationId;
  if (!reservationId) {
    const reservation = await createTestReservation(db, userId, {}, tx);
    reservationId = reservation.id;
  }
  
  let roomTypeId = overrides.roomTypeId;
  if (!roomTypeId) {
    const { createTestRoomType } = await import('./rooms');
    const roomType = await createTestRoomType(db, {}, tx);
    roomTypeId = roomType.id;
  }
  
  const [reservationRoom] = await conn
    .insert(reservationRooms)
    .values({
      reservationId,
      roomTypeId,
      checkInDate: '2026-02-10',
      checkOutDate: '2026-02-15',
      createdBy: userId,
      ...overrides,
    })
    .returning();
  
  return reservationRoom;
};
