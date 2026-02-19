import {
  and,
  eq,
  sql,
} from 'drizzle-orm'

import { db as defaultDb } from '../../index.js'
import { rooms, roomTypes } from '../../schema/rooms.js'
import { reservations, reservationRooms } from '../../schema/reservations.js'
import { housekeepingTasks } from '../../schema/housekeeping.js'

type DbConnection = typeof defaultDb

// ─── Room status board (all rooms with current status) ──────────────
export const getRoomStatusBoard = async (
  db: DbConnection = defaultDb,
) => {
  const allRooms = await db
    .select({
      id: rooms.id,
      roomNumber: rooms.roomNumber,
      floor: rooms.floor,
      status: rooms.status,
      cleanlinessStatus: rooms.cleanlinessStatus,
      roomTypeId: rooms.roomTypeId,
      roomTypeName: roomTypes.name,
      roomTypeCode: roomTypes.code,
    })
    .from(rooms)
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))

  return allRooms
}

// ─── Today's arrivals ───────────────────────────────────────────────
export const getArrivals = async (
  date: string,
  db: DbConnection = defaultDb,
) =>
  db
    .select({
      reservationId: reservations.id,
      reservationNumber: reservations.reservationNumber,
      guestName: reservations.guestNameSnapshot,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
      status: reservations.status,
      specialRequests: reservations.specialRequests,
      arrivalTime: reservations.arrivalTime,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.checkInDate, date),
        sql`${reservations.status} IN ('confirmed', 'checked_in')`,
      ),
    )

// ─── Today's departures ────────────────────────────────────────────
export const getDepartures = async (
  date: string,
  db: DbConnection = defaultDb,
) =>
  db
    .select({
      reservationId: reservations.id,
      reservationNumber: reservations.reservationNumber,
      guestName: reservations.guestNameSnapshot,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
      status: reservations.status,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.checkOutDate, date),
        eq(reservations.status, 'checked_in'),
      ),
    )

// ─── Stayovers (guests staying through a date) ─────────────────────
export const getStayovers = async (
  date: string,
  db: DbConnection = defaultDb,
) =>
  db
    .select({
      reservationId: reservations.id,
      reservationNumber: reservations.reservationNumber,
      guestName: reservations.guestNameSnapshot,
      checkInDate: reservations.checkInDate,
      checkOutDate: reservations.checkOutDate,
      status: reservations.status,
    })
    .from(reservations)
    .where(
      and(
        sql`${reservations.checkInDate} < ${date}`,
        sql`${reservations.checkOutDate} > ${date}`,
        eq(reservations.status, 'checked_in'),
      ),
    )

// ─── Rooms needing inspection ───────────────────────────────────────
export const getRoomsNeedingInspection = async (
  date: string,
  db: DbConnection = defaultDb,
) =>
  db
    .select({
      taskId: housekeepingTasks.id,
      roomId: housekeepingTasks.roomId,
      roomNumber: rooms.roomNumber,
      taskType: housekeepingTasks.taskType,
      status: housekeepingTasks.status,
      taskDate: housekeepingTasks.taskDate,
    })
    .from(housekeepingTasks)
    .innerJoin(rooms, eq(housekeepingTasks.roomId, rooms.id))
    .where(
      and(
        eq(housekeepingTasks.taskDate, date),
        sql`${housekeepingTasks.status} IN ('completed')`,
      ),
    )

// ─── Occupancy summary for a date ──────────────────────────────────
export const getOccupancySummary = async (
  date: string,
  db: DbConnection = defaultDb,
) => {
  const allRooms = await db
    .select({
      id: rooms.id,
      status: rooms.status,
    })
    .from(rooms)

  const total = allRooms.length
  const occupied = allRooms.filter((r) => r.status === 'occupied').length
  const available = allRooms.filter((r) => r.status === 'available').length
  const maintenance = allRooms.filter((r) => r.status === 'maintenance').length
  const outOfOrder = allRooms.filter((r) => r.status === 'out_of_order').length
  const blocked = allRooms.filter((r) => r.status === 'blocked').length

  const occupancyRate = total > 0 ? (occupied / total * 100) : 0

  return {
    date,
    total,
    occupied,
    available,
    maintenance,
    outOfOrder,
    blocked,
    occupancyRate: occupancyRate.toFixed(2),
  }
}
