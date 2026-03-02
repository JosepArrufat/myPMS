import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { assertNotPastDate } from '../db/guards.js';

import {
  createPromotion,
  updatePromotion,
  findPromotionByCode,
  listActivePromotions,
  listPromotionsForPeriod,
} from '../db/queries/catalog/promotions.js';

const router = Router();

// POST /api/promotions
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { validFrom } = req.body;
    if (!validFrom) throw new BadRequestError('validFrom is required');
    // guard: validFrom must not be before business date
    await assertNotPastDate(validFrom, undefined, 'validFrom');
    const promotion = await createPromotion(req.body);
    res.status(201).json({ promotion });
  }),
);

// PATCH /api/promotions/:id
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid promotion id');
    const { validFrom } = req.body;
    if (validFrom) await assertNotPastDate(validFrom, undefined, 'validFrom');
    const promotion = await updatePromotion(id, req.body);
    if (!promotion) throw new NotFoundError('Promotion not found');
    res.json({ promotion });
  }),
);

// GET /api/promotions/active
router.get(
  '/active',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const promotions = await listActivePromotions();
    res.json({ promotions });
  }),
);

// GET /api/promotions/period
router.get(
  '/period',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) throw new BadRequestError('from and to query params are required');
    const promotions = await listPromotionsForPeriod(from, to);
    res.json({ promotions });
  }),
);

// GET /api/promotions/:code
router.get(
  '/:promotionCode',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await findPromotionByCode(String(req.params.promotionCode));
    if (!result.length) throw new NotFoundError('Promotion not found');
    res.json({ promotion: result[0] });
  }),
);

export default router;
