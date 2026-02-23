import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// ─── Queries ────────────────────────────────────────────────────────
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

// ─── Services ───────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════
//  1.7  Reservations
// ═══════════════════════════════════════════════════════════════════
const router = Router();

// ─── Business date helper ───────────────────────────────────────────
// Rejects mutations on reservations whose check-out is before the
// current business date (i.e. the stay is in the past).
const guardPastReservation = async (checkOutDate: string | undefined) => {
  if (!checkOutDate) return;
  const bd = await getBusinessDate();
  if (checkOutDate < bd) {
    throw new BadRequestError(
      `Cannot modify a reservation that ended before the business date (${bd})`,
    );
  }
};

// GET /api/reservations/business-date  – fetch the current business date
router.get(
  '/business-date',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const businessDate = await getBusinessDate();
    res.json({ businessDate });
  }),
);

// PUT /api/reservations/business-date  – manually set the business date (admin only)
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

// POST /api/reservations
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

// ── Static single-segment routes MUST come before the /:idOrNumber wildcard ──

// GET /api/reservations/guest/:id
router.get(
  '/guest/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const reservations = await listGuestReservations(req.params.id as string);
    res.json({ reservations });
  }),
);

// GET /api/reservations/arrivals/:date
router.get(
  '/arrivals/:date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const arrivals = await listArrivalsForDate(req.params.date as string);
    res.json({ arrivals });
  }),
);

// GET /api/reservations/departures/:date
router.get(
  '/departures/:date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const departures = await listDeparturesForDate(req.params.date as string);
    res.json({ departures });
  }),
);

// GET /api/reservations/stay-window?from=&to=
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

// GET /api/reservations/agency/:id
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

// GET /api/reservations/:idOrNumber  – lookup by reservation number OR UUID id (wildcard – must be last single-segment GET)
router.get(
  '/:idOrNumber',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const reservation = await findReservation(req.params.idOrNumber as string);
    if (!reservation) throw new NotFoundError('Reservation not found');
    res.json({ reservation });
  }),
);

// ── Lifecycle actions ───────────────────────────────────────────────

// POST /api/reservations/:id/confirm – guard: cannot confirm past reservations
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

// POST /api/reservations/:id/check-in – guestId required at check-in
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

// POST /api/reservations/:id/check-out – guard: cannot check out past reservations
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

// POST /api/reservations/:id/cancel – guard: cannot cancel past reservations
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

// POST /api/reservations/:id/no-show – guard: cannot mark no-show on past reservations
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

// GET /api/reservations/:id/status
router.get(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const status = await getReservationStatus(req.params.id as string);
    res.json(status);
  }),
);

// ── Rate overrides ──────────────────────────────────────────────────

// POST /api/reservations/:id/rate-override – overrides daily rates & recalculates total
// Body: { startDate, endDate, newRate, reservationRoomId? }
// When reservationRoomId is omitted it updates ALL rooms in the reservation.
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

// POST /api/reservations/:id/recalculate
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

// ═══════════════════════════════════════════════════════════════════
//  1.8  Reservation Rooms & Assignments
// ═══════════════════════════════════════════════════════════════════

// GET /api/reservations/:id/rooms
router.get(
  '/:id/rooms',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const rooms = await listRoomsForReservation(req.params.id as string);
    res.json({ rooms });
  }),
);

// POST /api/reservations/:id/assign-room
// Assigns a physical room to this reservation for its entire stay.
// If the reservation has multiple room-type slots, the first unassigned slot
// matching the physical room's type is filled.
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

// DELETE /api/reservations/:id/unassign-room
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

// ─── Standalone routers for non-reservation-scoped endpoints ────────

export const roomAssignmentsRouter = Router();

// GET /api/room-assignments/:date
roomAssignmentsRouter.get(
  '/:date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const assignments = await listAssignmentsForDate(req.params.date as string);
    res.json({ assignments });
  }),
);

export const roomConflictsRouter = Router();

// GET /api/room-conflicts?roomId=&from=&to=
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
