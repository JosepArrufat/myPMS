import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import {
  numericRequestParams,
  createRequestBody,
  assignRequestBody,
  completeRequestBody,
  outOfOrderBody,
  returnToServiceBody,
  updateBlockBody,
  scheduledQuery,
} from '../schemas/maintenance.js';

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
  validate({ body: createRequestBody }),
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
  validate({ params: numericRequestParams, body: assignRequestBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const { assigneeId } = req.body;
    const request = await assignRequest(id, assigneeId, user.id);
    res.json({ request });
  }),
);

// POST /api/maintenance/:id/complete
router.post(
  '/:id/complete',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  validate({ params: numericRequestParams, body: completeRequestBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const { resolutionNotes, cost } = req.body;
    const request = await completeRequest(id, resolutionNotes, cost, user.id);
    res.json({ request });
  }),
);

// POST /api/maintenance/out-of-order
router.post(
  '/out-of-order',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  validate({ body: outOfOrderBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { roomId, startDate, endDate, reason } = req.body;
    const block = await putRoomOutOfOrder(roomId, startDate, endDate, reason, user.id);
    res.status(201).json({ block });
  }),
);

// POST /api/maintenance/return-to-service
router.post(
  '/return-to-service',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  validate({ body: returnToServiceBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { roomId } = req.body;
    await returnRoomToService(roomId, user.id);
    res.json({ ok: true, roomId });
  }),
);

// PATCH /api/maintenance/out-of-order/:id
router.patch(
  '/out-of-order/:id',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  validate({ params: numericRequestParams, body: updateBlockBody }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    const { startDate, endDate, reason } = req.body;
    const block = await updateOutOfOrderBlock(id, { startDate, endDate, reason }, user.id);
    res.json({ block });
  }),
);

// DELETE /api/maintenance/out-of-order/:id
router.delete(
  '/out-of-order/:id',
  authenticate,
  requireRole('admin', 'manager', 'maintenance'),
  validate({ params: numericRequestParams }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const id = Number(req.params.id);
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
  validate({ query: scheduledQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { from } = req.query as unknown as { from: string };
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
