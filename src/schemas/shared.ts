import { z } from 'zod'

// --- Primitives ---

// Numeric path param (coerces string → positive int)
export const numericId = z.coerce.number().int().positive()

// UUID string
export const uuidStr = z.string().uuid()

// ISO date string YYYY-MM-DD
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')

// Positive decimal as string (for monetary amounts)
export const monetaryStr = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid amount (e.g. "100.00")')

// Non-empty trimmed string
export const requiredStr = z.string().min(1, 'Required')

// --- Reusable param / query objects ---

export const numericIdParams = z.object({ id: numericId })

export const dateRangeQuery = z.object({
  from: dateStr,
  to: dateStr,
})

// checkIn / checkOut pair with date-order validation
export const checkInOutQuery = z
  .object({
    checkIn: dateStr,
    checkOut: dateStr,
  })
  .refine((d) => d.checkIn < d.checkOut, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
  })
