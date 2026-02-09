import {
  and,
  asc,
  eq,
  gte,
  lte,
  sql,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  reservations,
  reservationRooms,
  reservationDailyRates,
  type NewReservation,
} from '../../schema/reservations.js';
import { reserveRoomInventory } from '../catalog/rooms.js';
import { roomTypeRates } from '../../schema/rates.js';
import { roomTypes } from '../../schema/rooms.js';

type DbConnection = typeof defaultDb;

export const findReservationByNumber = async (reservationNumber: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(reservations)
    .where(eq(reservations.reservationNumber, reservationNumber))
    .limit(1);

export const listGuestReservations = async (guestId: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(reservations)
    .where(eq(reservations.guestId, guestId))
    .orderBy(asc(reservations.checkInDate));

export const listReservationsForStayWindow = async (from: string, to: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(reservations)
    .where(and(
      lte(reservations.checkInDate, to),
      gte(reservations.checkOutDate, from),
      sql`${reservations.status} IN ('confirmed', 'checked_in')`,
    ))
    .orderBy(asc(reservations.checkInDate));

export const listArrivalsForDate = async (targetDate: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(reservations)
    .where(and(
      eq(reservations.checkInDate, targetDate),
      sql`${reservations.status} IN ('confirmed', 'checked_in')`,
    ))
    .orderBy(asc(reservations.arrivalTime));

export const listDeparturesForDate = async (targetDate: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(reservations)
    .where(and(
      eq(reservations.checkOutDate, targetDate),
      eq(reservations.status, 'checked_in'),
    ))
    .orderBy(asc(reservations.checkOutDate));

export const listReservationsForAgency = async (
  agencyId: number,
  range?: { from: string; to: string },
  db: DbConnection = defaultDb
) =>
  db
    .select()
    .from(reservations)
    .where(range
      ? and(
          eq(reservations.agencyId, agencyId),
          lte(reservations.checkInDate, range.to),
          gte(reservations.checkOutDate, range.from),
        )
      : eq(reservations.agencyId, agencyId))
    .orderBy(asc(reservations.checkInDate));

interface CreateReservationInput {
  reservation: Omit<NewReservation, 'id' | 'createdAt' | 'updatedAt'>;
  rooms: Array<{
    roomTypeId: number;
    checkInDate: string;
    checkOutDate: string;
    ratePlanId?: number;
    dailyRates?: Array<{ date: string; rate: string; ratePlanId?: number }>;
  }>;
}

const computeNightlyRates = async (
  tx: any, 
  roomTypeId: number, 
  ratePlanId: number | undefined, 
  startDate: string, 
  endDate: string
) => {
  const out: Array<{ date: string; rate: string; ratePlanId?: number }> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let cur = new Date(start);
  while (cur < end) {
    const dateStr = cur.toISOString().slice(0, 10);
    let price: string | null = null;

    if (ratePlanId) {
      const [r] = await tx
        .select({ price: roomTypeRates.price })
        .from(roomTypeRates)
        .where(and(
          eq(roomTypeRates.roomTypeId, roomTypeId),
          eq(roomTypeRates.ratePlanId, ratePlanId),
          lte(roomTypeRates.startDate, dateStr),
          gte(roomTypeRates.endDate, dateStr),
        ))
        .limit(1);
      if (r && r.price != null) price = String(r.price);
    }

    if (!price) {
      const [rt] = await tx
        .select({ basePrice: roomTypes.basePrice })
        .from(roomTypes)
        .where(eq(roomTypes.id, roomTypeId))
        .limit(1);
      price = rt ? String(rt.basePrice) : '0';
    }

    out.push({ date: dateStr, rate: price, ratePlanId: ratePlanId ?? undefined });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

export const createReservation = async (input: CreateReservationInput, db: DbConnection = defaultDb) => {
  return db.transaction(async (tx) => {
    const [newReservation] = await tx
      .insert(reservations)
      .values(input.reservation)
      .returning();

    for (const room of input.rooms) {
      await reserveRoomInventory(room.roomTypeId, room.checkInDate, room.checkOutDate, 1, db);

      const [reservationRoom] = await tx
        .insert(reservationRooms)
        .values({
          reservationId: newReservation.id,
          roomId: null,
          roomTypeId: room.roomTypeId,
          checkInDate: room.checkInDate,
          checkOutDate: room.checkOutDate,
          ratePlanId: room.ratePlanId,
          assignedAt: null,
          assignedBy: null,
          notes: null,
        })
        .returning();

      const daily = room.dailyRates && room.dailyRates.length > 0
        ? room.dailyRates
        : await computeNightlyRates(
          tx, 
          room.roomTypeId, 
          room.ratePlanId ?? newReservation.ratePlanId ?? undefined, room.checkInDate, 
          room.checkOutDate
        );

      await tx.insert(reservationDailyRates).values(
        daily.map((dr) => ({
          reservationRoomId: reservationRoom.id,
          date: dr.date,
          rate: dr.rate,
          ratePlanId: dr.ratePlanId,
        }))
      );
    }

    return newReservation;
  });
};
