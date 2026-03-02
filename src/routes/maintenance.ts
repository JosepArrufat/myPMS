import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import { BadRequestError } from '../errors.js';

import {
  createRequest,
  assignRequest,
  completeRequest,
  putRoomOutOfOrder,
  returnRoomToService,
  updateOutOfOrderBlock,
  releaseOutOfOrderBlock,
} from '../db/services/maintenance.js';

import {
  listOpenRequests,
  listScheduledRequests,
  listUrgentOpenRequests,
} from '../db/queries/maintenance/maintenance-requests.js';

const router = Router();

// POST /api/maintenance
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const request = await createRequest(req.body, user.id);
    res.status(201).json({ request });
  }),
);

// POST /api/maintenance/:id/assign
router.post(
  '/:id/assign',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid request id');
    const { assigneeId } = req.body;
    if (!assigneeId) throw new BadRequestError('assigneeId is required');
    const request = await assignRequest(id, assigneeId, user.id);
    res.json({ request });
  }),
);

// POST /api/maintenance/:id/complete
router.post(
  '/:id/complete',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid request id');
    const { resolutionNotes, cost } = req.body;
    if (!resolutionNotes) throw new BadRequestError('resolutionNotes is required');
    const request = await completeRequest(id, resolutionNotes, cost, user.id);
    res.json({ request });
  }),
);

// POST /api/maintenance/out-of-order
router.post(
  '/out-of-order',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { roomId, startDate, endDate, reason } = req.body;
    if (!roomId || !startDate || !endDate || !reason) {
      throw new BadRequestError('roomId, startDate, endDate and reason are required');
    }
    const block = await putRoomOutOfOrder(roomId, startDate, endDate, reason, user.id);
    res.status(201).json({ block });
  }),
);

// POST /api/maintenance/return-to-service
router.post(
  '/return-to-service',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { roomId } = req.body;
    if (!roomId) throw new BadRequestError('roomId is required');
    await returnRoomToService(roomId, user.id);
    res.json({ ok: true, roomId });
  }),
);

// PATCH /api/maintenance/out-of-order/:id
router.patch(
  '/out-of-order/:id',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid block id');
    const { startDate, endDate, reason } = req.body;
    if (!startDate && !endDate && !reason) {
      throw new BadRequestError('At least one of startDate, endDate, or reason is required');
    }
    const block = await updateOutOfOrderBlock(id, { startDate, endDate, reason }, user.id);
    res.json({ block });
  }),
);

// DELETE /api/maintenance/out-of-order/:id
router.delete(
  '/out-of-order/:id',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid block id');
    const block = await releaseOutOfOrderBlock(id, user.id);
    res.json({ block });
  }),
);

// GET /api/maintenance/open
router.get(
  '/open',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const requests = await listOpenRequests();
    res.json({ requests });
  }),
);

// GET /api/maintenance/scheduled?from=
router.get(
  '/scheduled',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from } = req.query as { from?: string };
    if (!from) throw new BadRequestError('from query param is required');
    const requests = await listScheduledRequests(from);
    res.json({ requests });
  }),
);

// GET /api/maintenance/urgent
router.get(
  '/urgent',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const requests = await listUrgentOpenRequests();
    res.json({ requests });
  }),
);

export default router;
