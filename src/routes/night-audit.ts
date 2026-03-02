import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError } from '../errors.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';

import {
  runNightAudit,
  postDailyRoomCharges,
  generateDailyRevenueReport,
  flagDiscrepancies,
} from '../db/services/night-audit.js';

const router = Router();

// POST /api/night-audit/run
router.post(
  '/run',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { businessDate } = req.body;
    if (!businessDate) throw new BadRequestError('businessDate is required');
    const result = await runNightAudit(businessDate, user.id);
    res.json({ result });
  }),
);

// POST /api/night-audit/room-charges
router.post(
  '/room-charges',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    const { businessDate } = req.body;
    if (!businessDate) throw new BadRequestError('businessDate is required');
    const result = await postDailyRoomCharges(businessDate, user.id);
    res.json({ result });
  }),
);

// POST /api/night-audit/revenue-report
router.post(
  '/revenue-report',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { businessDate } = req.body;
    if (!businessDate) throw new BadRequestError('businessDate is required');
    const result = await generateDailyRevenueReport(businessDate);
    res.json({ result });
  }),
);

// POST /api/night-audit/discrepancies
router.post(
  '/discrepancies',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { businessDate } = req.body;
    if (!businessDate) throw new BadRequestError('businessDate is required');
    const issues = await flagDiscrepancies(businessDate);
    res.json({ issues });
  }),
);

export default router;
