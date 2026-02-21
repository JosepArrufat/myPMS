import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError, NotFoundError } from '../errors.js';

import {
  listActiveRatePlans,
  findRatePlanByCode,
  createRatePlan,
  updateRatePlan,
  listRatePlansForStay,
} from '../db/queries/catalog/rate-plans.js';

import {
  setRoomTypeRate,
  getEffectiveRate,
  getDerivedRate,
  updateBaseRateAndPropagate,
  createRateAdjustment,
} from '../db/services/rate-management.js';

import {
  listAdjustmentsForBaseType,
} from '../db/queries/catalog/room-type-rate-adjustments.js';

const router = Router();

// GET /api/rate-plans 
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const plans = await listActiveRatePlans();
    res.json({ ratePlans: plans });
  }),
);

// GET /api/rate-plans/stay?checkIn=&checkOut= 
router.get(
  '/stay',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { checkIn, checkOut } = req.query as { checkIn?: string; checkOut?: string };
    if (!checkIn || !checkOut) {
      throw new BadRequestError('checkIn and checkOut query params are required');
    }
    const plans = await listRatePlansForStay(checkIn, checkOut);
    res.json({ ratePlans: plans });
  }),
);

// GET /api/rate-plans/:code 
router.get(
  '/:code',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const [plan] = await findRatePlanByCode(req.params.code as string);
    if (!plan) throw new NotFoundError('Rate plan not found');
    res.json({ ratePlan: plan });
  }),
);

// POST /api/rate-plans 
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const plan = await createRatePlan(req.body);
    res.status(201).json({ ratePlan: plan });
  }),
);

// PATCH /api/rate-plans/:id
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid rate plan id');

    const plan = await updateRatePlan(id, req.body);
    if (!plan) throw new NotFoundError('Rate plan not found');

    res.json({ ratePlan: plan });
  }),
);

export { router as ratePlanRouter };


const ratesRouter = Router();

// POST /api/room-type-rates 
ratesRouter.post(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, ratePlanId, startDate, endDate, price } = req.body;
    if (!roomTypeId || !ratePlanId || !startDate || !endDate || !price) {
      throw new BadRequestError('roomTypeId, ratePlanId, startDate, endDate and price are required');
    }
    const rate = await setRoomTypeRate(roomTypeId, ratePlanId, startDate, endDate, price);
    res.status(201).json({ rate });
  }),
);

// GET /api/room-type-rates/effective 
ratesRouter.get(
  '/effective',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { roomTypeId, ratePlanId, date } = req.query as Record<string, string>;
    if (!roomTypeId || !ratePlanId || !date) {
      throw new BadRequestError('roomTypeId, ratePlanId and date query params are required');
    }
    const rate = await getEffectiveRate(Number(roomTypeId), Number(ratePlanId), date);
    if (!rate) throw new NotFoundError('No rate found');
    res.json({ rate });
  }),
);

// GET /api/room-type-rates/derived 
ratesRouter.get(
  '/derived',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { baseRoomTypeId, derivedRoomTypeId, ratePlanId, date } = req.query as Record<string, string>;
    if (!baseRoomTypeId || !derivedRoomTypeId || !ratePlanId || !date) {
      throw new BadRequestError('baseRoomTypeId, derivedRoomTypeId, ratePlanId and date are required');
    }
    const rate = await getDerivedRate(
      Number(baseRoomTypeId),
      Number(derivedRoomTypeId),
      Number(ratePlanId),
      date,
    );
    if (!rate) throw new NotFoundError('No derived rate found');
    res.json({ rate });
  }),
);

// POST /api/room-type-rates/propagate 
ratesRouter.post(
  '/propagate',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { baseRoomTypeId, ratePlanId, startDate, endDate, newPrice } = req.body;
    if (!baseRoomTypeId || !ratePlanId || !startDate || !endDate || !newPrice) {
      throw new BadRequestError('baseRoomTypeId, ratePlanId, startDate, endDate and newPrice are required');
    }
    const result = await updateBaseRateAndPropagate(
      baseRoomTypeId,
      ratePlanId,
      startDate,
      endDate,
      newPrice,
    );
    res.json(result);
  }),
);

export { ratesRouter };

const adjustmentsRouter = Router();

// POST /api/rate-adjustments 
adjustmentsRouter.post(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { baseRoomTypeId, derivedRoomTypeId, adjustmentType, adjustmentValue, ratePlanId } = req.body;
    if (!baseRoomTypeId || !derivedRoomTypeId || !adjustmentType || !adjustmentValue) {
      throw new BadRequestError(
        'baseRoomTypeId, derivedRoomTypeId, adjustmentType and adjustmentValue are required',
      );
    }
    const adjustment = await createRateAdjustment(
      baseRoomTypeId,
      derivedRoomTypeId,
      adjustmentType,
      adjustmentValue,
      ratePlanId,
    );
    res.status(201).json({ adjustment });
  }),
);

// GET /api/rate-adjustments/base/:id
adjustmentsRouter.get(
  '/base/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid base room type id');

    const ratePlanId = req.query.ratePlanId
      ? Number(req.query.ratePlanId)
      : undefined;

    const adjustments = await listAdjustmentsForBaseType(id, ratePlanId);
    res.json({ adjustments });
  }),
);

export { adjustmentsRouter };
