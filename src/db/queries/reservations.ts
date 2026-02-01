import {
  and,
  asc,
  eq,
  gte,
  lte,
  sql,
} from 'drizzle-orm';

import { db } from '../index.js';
import {
  reservations,
} from '../schema/reservations.js';

export const findReservationByNumber = async (reservationNumber: string) =>
  db
    .select()
    .from(reservations)
    .where(eq(reservations.reservationNumber, reservationNumber))
    .limit(1);

export const listGuestReservations = async (guestId: string) =>
  db
    .select()
    .from(reservations)
    .where(eq(reservations.guestId, guestId))
    .orderBy(asc(reservations.checkInDate));

export const listReservationsForStayWindow = async (from: string, to: string) =>
  db
    .select()
    .from(reservations)
    .where(and(
      lte(reservations.checkInDate, to),
      gte(reservations.checkOutDate, from),
      sql`${reservations.status} IN ('confirmed', 'checked_in')`,
    ))
    .orderBy(asc(reservations.checkInDate));

export const listArrivalsForDate = async (targetDate: string) =>
  db
    .select()
    .from(reservations)
    .where(and(
      eq(reservations.checkInDate, targetDate),
      sql`${reservations.status} IN ('confirmed', 'checked_in')`,
    ))
    .orderBy(asc(reservations.arrivalTime));
