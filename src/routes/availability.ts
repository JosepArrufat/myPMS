import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  checkAvailabilityQuery,
  roomTypesAvailQuery,
  blocksQuery,
  overbookQuery,
  dayAvailParams,
  dayAvailQuery,
  seedInventoryBody,
  seedAllBody,
  roomAvailParams,
} from '../schemas/availability.js';

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
  validate({ query: checkAvailabilityQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, checkIn, checkOut } = req.query as unknown as { roomTypeId: number; checkIn: string; checkOut: string };
    const result = await checkAvailability(roomTypeId, checkIn, checkOut);
    res.json(result);
  }),
);

// GET /api/availability/room-types 
router.get(
  '/room-types',
  authenticate,
  validate({ query: roomTypesAvailQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { checkIn, checkOut } = req.query as unknown as { checkIn: string; checkOut: string };
    const types = await getAvailableRoomTypes(checkIn, checkOut);
    res.json({ roomTypes: types });
  }),
);

// GET /api/availability/blocks 
router.get(
  '/blocks',
  authenticate,
  validate({ query: blocksQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { checkIn, checkOut } = req.query as unknown as { checkIn: string; checkOut: string };
    const blocks = await getBlockedRooms(checkIn, checkOut);
    res.json({ blocks });
  }),
);

// GET /api/availability/overbook 
router.get(
  '/overbook',
  authenticate,
  requireRole('admin', 'manager'),
  validate({ query: overbookQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, checkIn, checkOut, requestedRooms, overbookingPercent } =
      req.query as unknown as { roomTypeId: number; checkIn: string; checkOut: string; requestedRooms: number; overbookingPercent?: number };
    const result = await canOverbook(
      roomTypeId,
      checkIn,
      checkOut,
      requestedRooms,
      overbookingPercent,
    );
    res.json(result);
  }),
);

// GET /api/availability/day/:date 
router.get(
  '/day/:date',
  authenticate,
  validate({ params: dayAvailParams, query: dayAvailQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const date = req.params.date as string;
    const roomTypeId = (req.query as unknown as { roomTypeId: number }).roomTypeId;
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
  validate({ body: seedInventoryBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, startDate, endDate, capacity } = req.body;
    const inserted = await seedInventory(roomTypeId, startDate, endDate, capacity);
    res.status(201).json({ count: inserted.length, rows: inserted });
  }),
);

// POST /api/inventory/seed-all 
inventoryRouter.post(
  '/seed-all',
  authenticate,
  requireRole('admin'),
  validate({ body: seedAllBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.body;
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
  validate({ params: roomAvailParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const available = await isRoomAvailableNow(id, date);
    res.json({ roomId: id, date, available });
  }),
);

export { roomAvailabilityRouter };
