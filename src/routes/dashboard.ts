import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { BadRequestError } from '../errors.js';

import {
  getRoomStatusBoard,
  getArrivals,
  getDepartures,
  getStayovers,
  getRoomsNeedingInspection,
  getOccupancySummary,
} from '../db/queries/dashboard/room-status-board.js';

const router = Router();

// GET /api/dashboard/room-board
router.get(
  '/room-board',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const board = await getRoomStatusBoard();
    res.json({ board });
  }),
);

// GET /api/dashboard/arrivals
router.get(
  '/arrivals',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.query as { date?: string };
    if (!date) throw new BadRequestError('date query param is required');
    const arrivals = await getArrivals(date);
    res.json({ arrivals });
  }),
);

// GET /api/dashboard/departures
router.get(
  '/departures',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.query as { date?: string };
    if (!date) throw new BadRequestError('date query param is required');
    const departures = await getDepartures(date);
    res.json({ departures });
  }),
);

// GET /api/dashboard/stayovers
router.get(
  '/stayovers',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.query as { date?: string };
    if (!date) throw new BadRequestError('date query param is required');
    const stayovers = await getStayovers(date);
    res.json({ stayovers });
  }),
);

// GET /api/dashboard/needs-inspection
router.get(
  '/needs-inspection',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.query as { date?: string };
    if (!date) throw new BadRequestError('date query param is required');
    const tasks = await getRoomsNeedingInspection(date);
    res.json({ tasks });
  }),
);

// GET /api/dashboard/occupancy
router.get(
  '/occupancy',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.query as { date?: string };
    if (!date) throw new BadRequestError('date query param is required');
    const occupancy = await getOccupancySummary(date);
    res.json({ occupancy });
  }),
);

export default router;
