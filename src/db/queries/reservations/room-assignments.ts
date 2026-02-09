import {
  asc,
  eq,
} from 'drizzle-orm';

import { db as defaultDb } from '../../index.js';
import {
  roomAssignments,
} from '../../schema/reservations.js';

type DbConnection = typeof defaultDb;

export const listAssignmentsForDate = async (targetDate: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomAssignments)
    .where(eq(roomAssignments.date, targetDate))
    .orderBy(asc(roomAssignments.roomId));

export const listAssignmentsForReservation = async (reservationId: string, db: DbConnection = defaultDb) =>
  db
    .select()
    .from(roomAssignments)
    .where(eq(roomAssignments.reservationId, reservationId))
    .orderBy(asc(roomAssignments.date));
