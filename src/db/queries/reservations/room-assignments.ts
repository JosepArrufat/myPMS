import {
  asc,
  eq,
} from 'drizzle-orm';

import { db } from '../../index.js';
import {
  roomAssignments,
} from '../../schema/reservations.js';

export const listAssignmentsForDate = async (targetDate: string) =>
  db
    .select()
    .from(roomAssignments)
    .where(eq(roomAssignments.date, targetDate))
    .orderBy(asc(roomAssignments.roomId));

export const listAssignmentsForReservation = async (reservationId: string) =>
  db
    .select()
    .from(roomAssignments)
    .where(eq(roomAssignments.reservationId, reservationId))
    .orderBy(asc(roomAssignments.date));
