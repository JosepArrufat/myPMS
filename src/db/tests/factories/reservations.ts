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

type TestDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>;

export const createTestReservation = async (
  db: TestDb,
  overrides: Partial<NewReservation> = {},
  tx?: any
): Promise<Reservation> => {
  const conn = tx ?? db;
  const timestamp = Date.now();
  
  const [reservation] = await conn.insert(reservations).values({
    reservationNumber: `RES${timestamp}`,
    guestNameSnapshot: 'Test Guest',
    checkInDate: '2026-02-10',
    checkOutDate: '2026-02-15',
    adultsCount: 2,
    childrenCount: 0,
    status: 'confirmed',
    ...overrides,
  }).returning();
  
  return reservation;
};

export const createTestReservationRoom = async (
  db: TestDb,
  reservationId: string,
  roomTypeId: number,
  overrides: Partial<NewReservationRoom> = {},
  tx?: any
): Promise<ReservationRoom> => {
  const conn = tx ?? db;
  
  const [reservationRoom] = await conn.insert(reservationRooms).values({
    reservationId,
    roomTypeId,
    checkInDate: '2026-02-10',
    checkOutDate: '2026-02-15',
    ...overrides,
  }).returning();
  
  return reservationRoom;
};
