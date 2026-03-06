import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { BadRequestError } from '../errors.js'

type ValidationSchemas = {
  body?: z.ZodType
  query?: z.ZodType
  params?: z.ZodType
}

// Validates req.body / req.query / req.params against Zod schemas.
// Replaces manual if-throw checks — parsed data overwrites the original.
export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        const r = schemas.params.safeParse(req.params)
        if (!r.success) return next(new BadRequestError(r.error.issues[0].message))
        req.params = r.data as Record<string, string>
      }
      if (schemas.query) {
        const r = schemas.query.safeParse(req.query)
        if (!r.success) return next(new BadRequestError(r.error.issues[0].message))
        ;(req as any).query = r.data
      }
      if (schemas.body) {
        const r = schemas.body.safeParse(req.body)
        if (!r.success) return next(new BadRequestError(r.error.issues[0].message))
        req.body = r.data
      }
      next()
    } catch (err) {
      next(err)
    }
  }
