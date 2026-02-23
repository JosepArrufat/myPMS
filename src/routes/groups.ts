import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import { BadRequestError, NotFoundError } from '../errors.js';

import {
  createGroupReservation,
  getGroupRoomingList,
  createGroupBlock,
  getBlockPickup,
  releaseGroupBlock,
} from '../db/services/group-reservation.js';

import { listActiveBlocksForRange } from '../db/queries/reservations/room-blocks.js';

// ═══════════════════════════════════════════════════════════════════
//  Groups — /api/groups
// ═══════════════════════════════════════════════════════════════════
export const groupsRouter = Router();

// POST /api/groups
// If the room list mixes block-sourced and inventory-sourced rooms, the service
// returns { requiresConfirmation: true, warnings: [...] } with a 200 so the
// client can prompt the user. Re-submit with { ...body, confirmed: true } to proceed.
groupsRouter.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const result = await createGroupReservation(req.body, user.id);
    if ('requiresConfirmation' in result && result.requiresConfirmation) {
      return res.status(200).json(result);
    }
    res.status(201).json(result);
  }),
);

// GET /api/groups/:id/rooming-list
groupsRouter.get(
  '/:id/rooming-list',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const rooms = await getGroupRoomingList(req.params.id as string);
    res.json({ rooms });
  }),
);

// ═══════════════════════════════════════════════════════════════════
//  Blocks — /api/blocks
// ═══════════════════════════════════════════════════════════════════
export const blocksRouter = Router();

// POST /api/blocks
blocksRouter.post(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { roomTypeId, startDate, endDate, quantity, reason } = req.body;
    if (!roomTypeId || !startDate || !endDate || !quantity) {
      throw new BadRequestError('roomTypeId, startDate, endDate and quantity are required');
    }
    const block = await createGroupBlock(
      roomTypeId,
      startDate,
      endDate,
      quantity,
      reason ?? '',
      user.id,
    );
    res.status(201).json({ block });
  }),
);

// GET /api/blocks/:id/pickup
blocksRouter.get(
  '/:id/pickup',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid block id');
    const result = await getBlockPickup(id);
    res.json(result);
  }),
);

// POST /api/blocks/:id/release
blocksRouter.post(
  '/:id/release',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid block id');
    const result = await releaseGroupBlock(id, user.id);
    res.json(result);
  }),
);

// GET /api/blocks/active?from=&to=
blocksRouter.get(
  '/active',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) throw new BadRequestError('from and to query params are required');
    const blocks = await listActiveBlocksForRange(from, to);
    res.json({ blocks });
  }),
);
