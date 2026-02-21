import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors.js';
import type { AuthenticatedRequest } from './authenticate.js';

/**
 * Factory that returns middleware restricting access to one or more roles.
 *
 * Usage:
 *   router.get('/admin-only', authenticate, requireRole('admin'), handler);
 *   router.get('/staff', authenticate, requireRole('admin', 'manager', 'front_desk'), handler);
 */
export const requireRole = (...allowedRoles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !allowedRoles.includes(user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
