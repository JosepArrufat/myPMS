import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { assertNotPastDate } from '../db/guards.js';

import {
  createOverbookingPolicy,
  updateOverbookingPolicy,
  deleteOverbookingPolicy,
  listOverbookingPolicies,
  getEffectiveOverbookingPercent,
} from '../db/queries/catalog/overbooking-policies.js';

const router = Router();

// POST /api/overbooking-policies
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate } = req.body;
    if (!startDate) throw new BadRequestError('startDate is required');
    // guard: startDate must not be before business date
    await assertNotPastDate(startDate, undefined, 'startDate');
    const policy = await createOverbookingPolicy(req.body);
    res.status(201).json({ policy });
  }),
);

// PATCH /api/overbooking-policies/:id
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid policy id');
    const { startDate } = req.body;
    if (startDate) await assertNotPastDate(startDate, undefined, 'startDate');
    const policy = await updateOverbookingPolicy(id, req.body);
    if (!policy) throw new NotFoundError('Overbooking policy not found');
    res.json({ policy });
  }),
);

// DELETE /api/overbooking-policies/:id
router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid policy id');
    const deleted = await deleteOverbookingPolicy(id);
    if (!deleted) throw new NotFoundError('Overbooking policy not found');
    res.json({ deleted });
  }),
);

// GET /api/overbooking-policies/effective
router.get(
  '/effective',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, date } = req.query as { roomTypeId?: string; date?: string };
    if (!roomTypeId || !date) throw new BadRequestError('roomTypeId and date query params are required');
    const rtId = Number(roomTypeId);
    if (isNaN(rtId)) throw new BadRequestError('Invalid roomTypeId');
    const percent = await getEffectiveOverbookingPercent(rtId, date);
    res.json({ roomTypeId: rtId, date, overbookingPercent: percent });
  }),
);

// GET /api/overbooking-policies
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const policies = await listOverbookingPolicies();
    res.json({ policies });
  }),
);

export default router;
