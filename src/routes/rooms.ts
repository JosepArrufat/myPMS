import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError, NotFoundError } from '../errors.js';

import {
  createRoom,
  updateRoom,
  findRoomByNumber,
  listRoomsByType,
  listAvailableRooms,
} from '../db/queries/catalog/rooms.js';

import { isRoomAvailableNow } from '../db/queries/catalog/rooms-availability.js';

const router = Router();

// GET /api/rooms 
// Optional query: ?roomTypeId=1 to filter by type
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId } = req.query as { roomTypeId?: string };
    if (roomTypeId) {
      const id = Number(roomTypeId);
      if (isNaN(id)) throw new BadRequestError('Invalid roomTypeId');
      const rooms = await listRoomsByType(id);
      return res.json({ rooms });
    }
    const rooms = await listAvailableRooms();
    res.json({ rooms });
  }),
);

// GET /api/rooms/available 
router.get(
  '/available',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const rooms = await listAvailableRooms();
    res.json({ rooms });
  }),
);

// GET /api/rooms/:roomNumber 
router.get(
  '/:roomNumber',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const roomNumber = req.params.roomNumber as string;
    const [room] = await findRoomByNumber(roomNumber);
    if (!room) throw new NotFoundError('Room not found');
    res.json({ room });
  }),
);

// GET /api/rooms/:id/available 
router.get(
  '/:id/available',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid room id');

    const { date } = req.query as { date?: string };
    const checkDate = date ?? new Date().toISOString().slice(0, 10);

    const available = await isRoomAvailableNow(id, checkDate);
    res.json({ roomId: id, date: checkDate, available });
  }),
);

// POST /api/rooms 
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { roomNumber, roomTypeId, floor, status } = req.body;
    if (!roomNumber || !roomTypeId) {
      throw new BadRequestError('roomNumber and roomTypeId are required');
    }
    const room = await createRoom({ roomNumber, roomTypeId, floor, status });
    res.status(201).json({ room });
  }),
);

// PATCH /api/rooms/:id 
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid room id');

    const room = await updateRoom(id, req.body);
    if (!room) throw new NotFoundError('Room not found');

    res.json({ room });
  }),
);

export default router;
