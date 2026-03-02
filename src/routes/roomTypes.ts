import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError, NotFoundError } from '../errors.js';

import {
  createRoomType,
  updateRoomType,
  findRoomTypeById,
} from '../db/queries/catalog/rooms.js';

import {
  listActiveRoomTypes,
  findRoomTypeByCode,
} from '../db/queries/catalog/room-types.js';

const router = Router();

// GET /api/room-types
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const types = await listActiveRoomTypes();
    res.json({ roomTypes: types });
  }),
);

// GET /api/room-types/:id
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      // Maybe it's a code like "STD" — try by code
      const [byCode] = await findRoomTypeByCode(req.params.id as string);
      if (!byCode) throw new NotFoundError('Room type not found');
      return res.json({ roomType: byCode });
    }
    const [roomType] = await findRoomTypeById(id);
    if (!roomType) throw new NotFoundError('Room type not found');
    res.json({ roomType });
  }),
);

// POST /api/room-types
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, code, description, basePrice, maxOccupancy, sortOrder } = req.body;
    if (!name || !code || !basePrice) {
      throw new BadRequestError('name, code and basePrice are required');
    }
    const roomType = await createRoomType({
      name,
      code,
      description,
      basePrice,
      maxOccupancy,
      sortOrder,
    });
    res.status(201).json({ roomType });
  }),
);

// PATCH /api/room-types/:id
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid room type id');

    const roomType = await updateRoomType(id, req.body);
    if (!roomType) throw new NotFoundError('Room type not found');

    res.json({ roomType });
  }),
);

export default router;
