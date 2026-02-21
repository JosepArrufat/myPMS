import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import { BadRequestError, NotFoundError } from '../errors.js';

import {
  searchGuests,
  findGuestById,
  findGuestByEmail,
  createGuest,
  updateGuest,
} from '../db/queries/catalog/guests.js';

import {
  listVipGuests,
  setVipStatus,
  setLoyaltyNumber,
  getGuestHistory,
  findDuplicates,
  mergeGuests,
  searchGuestsByDocument,
  searchGuestsByPhone,
  searchGuestsFuzzy,
} from '../db/services/guest.js';

const router = Router();

//  GET /api/guests/vip 
router.get(
  '/vip',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const guests = await listVipGuests();
    res.json({ guests });
  }),
);

// GET /api/guests/duplicates?guestId= 
router.get(
  '/duplicates',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const guestId = req.query.guestId as string;
    if (!guestId) throw new BadRequestError('guestId query param is required');
    const duplicates = await findDuplicates(guestId);
    res.json({ duplicates });
  }),
);

// GET /api/guests/search/document?q= 
router.get(
  '/search/document',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    if (!q) throw new BadRequestError('Query parameter "q" is required');
    const guests = await searchGuestsByDocument(q);
    res.json({ guests });
  }),
);

// GET /api/guests/search/phone?q= 
router.get(
  '/search/phone',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    if (!q) throw new BadRequestError('Query parameter "q" is required');
    const guests = await searchGuestsByPhone(q);
    res.json({ guests });
  }),
);

// GET /api/guests/search/fuzzy?q= 
router.get(
  '/search/fuzzy',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    if (!q) throw new BadRequestError('Query parameter "q" is required');
    const guests = await searchGuestsFuzzy(q);
    res.json({ guests });
  }),
);

// GET /api/guests/email/:email 
router.get(
  '/email/:email',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const [guest] = await findGuestByEmail(req.params.email as string);
    if (!guest) throw new NotFoundError('Guest not found');
    res.json({ guest });
  }),
);

// GET /api/guests 
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    const guests = await searchGuests(q);
    res.json({ guests });
  }),
);

// GET /api/guests/:id 
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const [guest] = await findGuestById(req.params.id as string);
    if (!guest) throw new NotFoundError('Guest not found');
    res.json({ guest });
  }),
);

// POST /api/guests 
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const guest = await createGuest(req.body);
    res.status(201).json({ guest });
  }),
);

// PATCH /api/guests/:id 
router.patch(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const guest = await updateGuest(req.params.id as string, req.body);
    if (!guest) throw new NotFoundError('Guest not found');
    res.json({ guest });
  }),
);

// PATCH /api/guests/:id/vip 
router.patch(
  '/:id/vip',
  authenticate,
  requireRole('admin', 'manager', 'front_desk'),
  asyncHandler(async (req: Request, res: Response) => {
    const { vipStatus } = req.body;
    if (typeof vipStatus !== 'boolean') {
      throw new BadRequestError('vipStatus (boolean) is required');
    }
    const guest = await setVipStatus(req.params.id as string, vipStatus);
    res.json({ guest });
  }),
);

// PATCH /api/guests/:id/loyalty 
router.patch(
  '/:id/loyalty',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { loyaltyNumber } = req.body;
    if (!loyaltyNumber) throw new BadRequestError('loyaltyNumber is required');
    const guest = await setLoyaltyNumber(req.params.id as string, loyaltyNumber);
    res.json({ guest });
  }),
);

// GET /api/guests/:id/history 
router.get(
  '/:id/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const history = await getGuestHistory(req.params.id as string);
    res.json(history);
  }),
);

// POST /api/guests/merge
router.post(
  '/merge',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const { primaryGuestId, secondaryGuestId } = req.body;
    if (!primaryGuestId || !secondaryGuestId) {
      throw new BadRequestError('primaryGuestId and secondaryGuestId are required');
    }
    const merged = await mergeGuests(primaryGuestId, secondaryGuestId);
    res.json({ guest: merged });
  }),
);

export default router;
