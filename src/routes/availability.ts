import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError } from '../errors.js';

import {
  checkAvailability,
  getAvailableRoomTypes,
  getBlockedRooms,
  canOverbook,
} from '../db/services/availability.js';

import {
  seedInventory,
  seedAllRoomTypeInventory,
} from '../db/services/inventory.js';

import { isRoomAvailableNow } from '../db/queries/catalog/rooms-availability.js';
import { getAvailabilityByDay } from '../db/queries/catalog/rooms.js';

const router = Router();

// GET /api/availability/check 
router.get(
  '/check',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, checkIn, checkOut } = req.query as Record<string, string>;
    if (!roomTypeId || !checkIn || !checkOut) {
      throw new BadRequestError('roomTypeId, checkIn and checkOut are required');
    }
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (isNaN(ci.getTime()) || isNaN(co.getTime())) {
      throw new BadRequestError('checkIn and checkOut must be valid ISO dates (YYYY-MM-DD)');
    }
    if (ci >= co) {
      throw new BadRequestError('checkOut must be after checkIn');
    }
    const result = await checkAvailability(Number(roomTypeId), checkIn, checkOut);
    res.json(result);
  }),
);

// GET /api/availability/room-types 
router.get(
  '/room-types',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { checkIn, checkOut } = req.query as Record<string, string>;
    if (!checkIn || !checkOut) {
      throw new BadRequestError('checkIn and checkOut are required');
    }
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (isNaN(ci.getTime()) || isNaN(co.getTime())) {
      throw new BadRequestError('checkIn and checkOut must be valid ISO dates (YYYY-MM-DD)');
    }
    if (ci >= co) {
      throw new BadRequestError('checkOut must be after checkIn');
    }
    const types = await getAvailableRoomTypes(checkIn, checkOut);
    res.json({ roomTypes: types });
  }),
);

// GET /api/availability/blocks 
router.get(
  '/blocks',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { checkIn, checkOut } = req.query as Record<string, string>;
    if (!checkIn || !checkOut) {
      throw new BadRequestError('checkIn and checkOut are required');
    }
    const blocks = await getBlockedRooms(checkIn, checkOut);
    res.json({ blocks });
  }),
);

// GET /api/availability/overbook 
router.get(
  '/overbook',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, checkIn, checkOut, requestedRooms, overbookingPercent } =
      req.query as Record<string, string>;
    if (!roomTypeId || !checkIn || !checkOut || !requestedRooms) {
      throw new BadRequestError(
        'roomTypeId, checkIn, checkOut and requestedRooms are required',
      );
    }
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (isNaN(ci.getTime()) || isNaN(co.getTime())) {
      throw new BadRequestError('checkIn and checkOut must be valid ISO dates (YYYY-MM-DD)');
    }
    if (ci >= co) {
      throw new BadRequestError('checkOut must be after checkIn');
    }
    const result = await canOverbook(
      Number(roomTypeId),
      checkIn,
      checkOut,
      Number(requestedRooms),
      overbookingPercent ? Number(overbookingPercent) : undefined,
    );
    res.json(result);
  }),
);

// GET /api/availability/day/:date 
router.get(
  '/day/:date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const date = req.params.date as string;
    const roomTypeId = req.query.roomTypeId
      ? Number(req.query.roomTypeId)
      : undefined;

    if (!roomTypeId) {
      throw new BadRequestError('roomTypeId query param is required');
    }

    // Use next day as endDate for a single-day view
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDate = nextDay.toISOString().slice(0, 10);

    const availability = await getAvailabilityByDay(roomTypeId, date, endDate);
    res.json({ availability });
  }),
);

export { router as availabilityRouter };

//  INVENTORY
const inventoryRouter = Router();

// POST /api/inventory/seed 
inventoryRouter.post(
  '/seed',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, startDate, endDate, capacity } = req.body;
    if (!roomTypeId || !startDate || !endDate || !capacity) {
      throw new BadRequestError('roomTypeId, startDate, endDate and capacity are required');
    }
    const inserted = await seedInventory(roomTypeId, startDate, endDate, capacity);
    res.status(201).json({ count: inserted.length, rows: inserted });
  }),
);

// POST /api/inventory/seed-all 
inventoryRouter.post(
  '/seed-all',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required');
    }
    const results = await seedAllRoomTypeInventory(startDate, endDate);
    res.status(201).json({ results });
  }),
);

export { inventoryRouter };

//  SINGLE ROOM AVAILABILITY
const roomAvailabilityRouter = Router();

// GET /api/rooms/:id/available-now 
roomAvailabilityRouter.get(
  '/:id/available-now',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid room id');

    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const available = await isRoomAvailableNow(id, date);
    res.json({ roomId: id, date, available });
  }),
);

export { roomAvailabilityRouter };
