import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireRole } from '../middleware/requireRole.js'
import { BadRequestError } from '../errors.js'
import {
  getBusinessDate,
  setBusinessDate,
  advanceBusinessDate,
} from '../db/services/business-date.js'

const router = Router()

// GET /api/business-date
// Returns the current hotel business date (YYYY-MM-DD).
router.get(
  '/',
  authenticate,
  asyncHandler(async (_req: Request, res: Response) => {
    const businessDate = await getBusinessDate()
    res.json({ businessDate })
  }),
)

// PUT /api/business-date
// Body: { date: "YYYY-MM-DD" }
// Sets the business date to an arbitrary date (admin only).
router.put(
  '/',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.body
    if (!date) throw new BadRequestError('date is required (YYYY-MM-DD)')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestError('date must be in YYYY-MM-DD format')
    }
    const businessDate = await setBusinessDate(date)
    res.json({ businessDate })
  }),
)

// POST /api/business-date/advance
// Increments the business date by 1 day (admin and manager only).
// This is the end-of-day / night-audit trigger.
router.post(
  '/advance',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (_req: Request, res: Response) => {
    const businessDate = await advanceBusinessDate()
    res.json({ businessDate, advanced: true })
  }),
)

export default router
