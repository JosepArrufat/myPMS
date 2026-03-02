import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError } from '../errors.js';

import {
  getAuditTrailForRecord,
  getAuditEventsForUser,
} from '../db/queries/audit/audit-log.js';

const router = Router();

// GET /api/audit/user/:userId
router.get(
  '/user/:userId',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) throw new BadRequestError('Invalid userId');
    const { since } = req.query as { since?: string };
    const sinceDate = since ? new Date(since) : undefined;
    const events = await getAuditEventsForUser(userId, sinceDate);
    res.json({ events });
  }),
);

// GET /api/audit/:table/:recordId
router.get(
  '/:table/:recordId',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const table = String(req.params.table);
    const recordId = String(req.params.recordId);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const trail = await getAuditTrailForRecord(table, recordId, limit);
    res.json({ trail });
  }),
);

export default router;
