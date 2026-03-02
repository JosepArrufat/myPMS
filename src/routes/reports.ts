import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { BadRequestError } from '../errors.js';

import { getDailyRevenue, listDailyRevenueRange } from '../db/queries/reporting/daily-revenue.js';
import { getMonthlyRevenue, listMonthlyRevenueRange } from '../db/queries/reporting/monthly-revenue.js';
import { getYearlyRevenue, listYearlyRevenueRange } from '../db/queries/reporting/yearly-revenue.js';
import { listRoomTypeRevenueRange } from '../db/queries/reporting/daily-room-type-revenue.js';
import { listRatePlanRevenueRange } from '../db/queries/reporting/daily-rate-revenue.js';

const router = Router();

// GET /api/reports/daily/range
router.get(
  '/daily/range',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) throw new BadRequestError('from and to query params are required');
    const rows = await listDailyRevenueRange(from, to);
    res.json({ rows });
  }),
);

// GET /api/reports/daily/:date
router.get(
  '/daily/:date',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await getDailyRevenue(String(req.params.date));
    res.json({ rows });
  }),
);

// GET /api/reports/monthly/range
router.get(
  '/monthly/range',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) throw new BadRequestError('from and to query params are required');
    const rows = await listMonthlyRevenueRange(from, to);
    res.json({ rows });
  }),
);

// GET /api/reports/monthly/:month
router.get(
  '/monthly/:month',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await getMonthlyRevenue(String(req.params.month));
    res.json({ rows });
  }),
);

// GET /api/reports/yearly/range
router.get(
  '/yearly/range',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) throw new BadRequestError('from and to query params are required');
    const fromYear = Number(from);
    const toYear = Number(to);
    if (isNaN(fromYear) || isNaN(toYear)) throw new BadRequestError('from and to must be valid years');
    const rows = await listYearlyRevenueRange(fromYear, toYear);
    res.json({ rows });
  }),
);

// GET /api/reports/yearly/:year
router.get(
  '/yearly/:year',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const year = Number(req.params.year);
    if (isNaN(year)) throw new BadRequestError('Invalid year');
    const rows = await getYearlyRevenue(year);
    res.json({ rows });
  }),
);

// GET /api/reports/room-type-revenue
router.get(
  '/room-type-revenue',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, from, to } = req.query as { roomTypeId?: string; from?: string; to?: string };
    if (!roomTypeId || !from || !to) throw new BadRequestError('roomTypeId, from, and to query params are required');
    const rtId = Number(roomTypeId);
    if (isNaN(rtId)) throw new BadRequestError('Invalid roomTypeId');
    const rows = await listRoomTypeRevenueRange(rtId, from, to);
    res.json({ rows });
  }),
);

// GET /api/reports/rate-plan-revenue
router.get(
  '/rate-plan-revenue',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { ratePlanId, from, to } = req.query as { ratePlanId?: string; from?: string; to?: string };
    if (!ratePlanId || !from || !to) throw new BadRequestError('ratePlanId, from, and to query params are required');
    const rpId = Number(ratePlanId);
    if (isNaN(rpId)) throw new BadRequestError('Invalid ratePlanId');
    const rows = await listRatePlanRevenueRange(rpId, from, to);
    res.json({ rows });
  }),
);

export default router;
