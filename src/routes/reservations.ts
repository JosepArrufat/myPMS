import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import { BadRequestError, NotFoundError } from '../errors.js';

import {
  createReservation,
  findReservation,
  listGuestReservations,
  listArrivalsForDate,
  listDeparturesForDate,
  listReservationsForStayWindow,
  listReservationsForAgency,
} from '../db/queries/reservations/reservations.js';

import {
  listRoomsForReservation,
  findRoomConflicts,
} from '../db/queries/reservations/reservation-rooms.js';

import {
  listAssignmentsForDate,
} from '../db/queries/reservations/room-assignments.js';

import {
  confirmReservation,
  cancelReservation,
  markNoShow,
  getReservationStatus,
} from '../db/services/reservation-lifecycle.js';

import { checkInReservation } from '../db/services/checkin.js';
import { checkoutReservation } from '../db/services/checkout.js';

import {
  overrideReservationRate,
  recalculateReservationTotal,
} from '../db/services/rate-management.js';

import { assignRoom, unassignRoom } from '../db/services/room-assignment.js';
import { getBusinessDate, setBusinessDate } from '../db/services/business-date.js';

const router = Router();

// Rejects mutations when check-out is before the current business date.
const guardPastReservation = async (checkOutDate: string | undefined) => {
  if (!checkOutDate) return;
  const bd = await getBusinessDate();
  if (checkOutDate < bd) {
    throw new BadRequestError(
      `Cannot modify a reservation that ended before the business date (${bd})`,
    );
  }
};

router.get(
  '/business-date',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const businessDate = await getBusinessDate();
    res.json({ businessDate });
  }),
);

router.put(
  '/business-date',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.body;
    if (!date) throw new BadRequestError('date is required (YYYY-MM-DD)');
    const businessDate = await setBusinessDate(date);
    res.json({ businessDate });
  }),
);

router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { reservation, rooms, overbookingPercent } = req.body;
    if (!reservation || !rooms || !Array.isArray(rooms) || rooms.length === 0) {
      throw new BadRequestError('reservation and rooms[] are required');
    }
    reservation.createdBy = user.id;
    const result = await createReservation({ reservation, rooms, overbookingPercent });
    res.status(201).json({ reservation: result });
  }),
);

router.get(
  '/guest/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const reservations = await listGuestReservations(req.params.id as string);
    res.json({ reservations });
  }),
);

router.get(
  '/arrivals/:date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const arrivals = await listArrivalsForDate(req.params.date as string);
    res.json({ arrivals });
  }),
);

router.get(
  '/departures/:date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const departures = await listDeparturesForDate(req.params.date as string);
    res.json({ departures });
  }),
);

router.get(
  '/stay-window',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) throw new BadRequestError('from and to query params are required');
    const reservations = await listReservationsForStayWindow(from, to);
    res.json({ reservations });
  }),
);

router.get(
  '/agency/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const range = from && to ? { from, to } : undefined;
    const reservations = await listReservationsForAgency(Number(req.params.id), range);
    res.json({ reservations });
  }),
);

// wildcard – must come after all fixed routes
router.get(
  '/:idOrNumber',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const reservation = await findReservation(req.params.idOrNumber as string);
    if (!reservation) throw new NotFoundError('Reservation not found');
    res.json({ reservation });
  }),
);

router.post(
  '/:id/confirm',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const found = await findReservation(req.params.id as string);
    if (!found) throw new NotFoundError('Reservation not found');
    await guardPastReservation(found.checkOutDate);
    const reservation = await confirmReservation(found.id, user.id);
    res.json({ reservation });
  }),
);

router.post(
  '/:id/check-in',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { roomId, guestId } = req.body;
    if (!roomId) throw new BadRequestError('roomId is required');
    if (!guestId) throw new BadRequestError('guestId is required at check-in');
    const found = await findReservation(req.params.id as string);
    if (!found) throw new NotFoundError('Reservation not found');
    await guardPastReservation(found.checkOutDate);
    const result = await checkInReservation(found.id, roomId, guestId, user.id);
    res.json(result);
  }),
);

router.post(
  '/:id/check-out',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { roomId } = req.body;
    if (!roomId) throw new BadRequestError('roomId is required');
    const found = await findReservation(req.params.id as string);
    if (!found) throw new NotFoundError('Reservation not found');
    await guardPastReservation(found.checkOutDate);
    const result = await checkoutReservation(found.id, roomId, user.id);
    res.json(result);
  }),
);

router.post(
  '/:id/cancel',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { reason, cancellationFee } = req.body;
    if (!reason) throw new BadRequestError('reason is required');
    const found = await findReservation(req.params.id as string);
    if (!found) throw new NotFoundError('Reservation not found');
    await guardPastReservation(found.checkOutDate);
    const reservation = await cancelReservation(
      found.id,
      user.id,
      reason,
      cancellationFee,
    );
    res.json({ reservation });
  }),
);

router.post(
  '/:id/no-show',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const found = await findReservation(req.params.id as string);
    if (!found) throw new NotFoundError('Reservation not found');
    await guardPastReservation(found.checkOutDate);
    const reservation = await markNoShow(found.id, user.id);
    res.json({ reservation });
  }),
);

router.get(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const status = await getReservationStatus(req.params.id as string);
    res.json(status);
  }),
);

// Body: { startDate, endDate, newRate, reservationRoomId? }
// Omitting reservationRoomId updates all rooms in the reservation.
router.post(
  '/:id/rate-override',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { startDate, endDate, newRate, reservationRoomId } = req.body;
    if (!startDate || !endDate || !newRate) {
      throw new BadRequestError('startDate, endDate and newRate are required');
    }
    const found = await findReservation(req.params.id as string);
    if (!found) throw new NotFoundError('Reservation not found');
    const result = await overrideReservationRate(
      found.id,
      startDate,
      endDate,
      newRate,
      user.id,
      reservationRoomId,
    );
    res.json(result);
  }),
);

router.post(
  '/:id/recalculate',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const reservation = await recalculateReservationTotal(req.params.id as string, user.id);
    res.json({ reservation });
  }),
);

router.get(
  '/:id/rooms',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const rooms = await listRoomsForReservation(req.params.id as string);
    res.json({ rooms });
  }),
);

// fills the first unassigned room-type slot matching the given room's type
router.post(
  '/:id/assign-room',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { roomId } = req.body;
    if (!roomId) {
      throw new BadRequestError('roomId is required');
    }
    const assignments = await assignRoom(
      req.params.id as string,
      roomId,
      user.id,
    );
    res.status(201).json({ assignments });
  }),
);

router.delete(
  '/:id/unassign-room',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { roomId } = req.body;
    if (!roomId) {
      throw new BadRequestError('roomId is required');
    }
    const result = await unassignRoom(
      req.params.id as string,
      roomId,
    );
    res.json(result);
  }),
);

export default router;

export const roomAssignmentsRouter = Router();

roomAssignmentsRouter.get(
  '/:date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const assignments = await listAssignmentsForDate(req.params.date as string);
    res.json({ assignments });
  }),
);

export const roomConflictsRouter = Router();

roomConflictsRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { roomId, from, to } = req.query as { roomId?: string; from?: string; to?: string };
    if (!roomId || !from || !to) {
      throw new BadRequestError('roomId, from and to query params are required');
    }
    const conflicts = await findRoomConflicts(Number(roomId), from, to);
    res.json({ conflicts });
  }),
);
