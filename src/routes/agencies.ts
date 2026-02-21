import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError, NotFoundError } from '../errors.js';

import {
  searchAgencies,
  findAgencyByCode,
  createAgency,
  updateAgency,
  listAgencyReservations,
} from '../db/queries/catalog/agencies.js';

const router = Router();

// GET /api/agencies 
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    const includeInactive = req.query.includeInactive === 'true';
    const agencies = await searchAgencies(q, includeInactive);
    res.json({ agencies });
  }),
);

// GET /api/agencies/:code 
router.get(
  '/:code',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const [agency] = await findAgencyByCode(req.params.code as string);
    if (!agency) throw new NotFoundError('Agency not found');
    res.json({ agency });
  }),
);

// POST /api/agencies 
router.post(
  '/',
  authenticate,
  requireRole('admin', 'manager', 'sales'),
  asyncHandler(async (req: Request, res: Response) => {
    const agency = await createAgency(req.body);
    res.status(201).json({ agency });
  }),
);

//  PATCH /api/agencies/:id 
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'manager', 'sales'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid agency id');

    const agency = await updateAgency(id, req.body);
    if (!agency) throw new NotFoundError('Agency not found');

    res.json({ agency });
  }),
);

// GET /api/agencies/:id/reservations 
router.get(
  '/:id/reservations',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) throw new BadRequestError('Invalid agency id');

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const range = from && to ? { from, to } : undefined;

    const reservations = await listAgencyReservations(id, range);
    res.json({ reservations });
  }),
);

export default router;
