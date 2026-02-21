import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../errors.js';
import { config } from '../config.js';
import { checkPasswordHash, makeJWT } from '../auth.js';

import { findUserByEmail, listActiveUsersByRole, searchUsers } from '../db/queries/identity/users.js';
import { listPermissions } from '../db/queries/identity/permissions.js';
import { listPermissionsForRole } from '../db/queries/identity/role-permissions.js';

const router = Router();

//  POST /api/auth/login 
router.post(
  '/auth/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const [user] = await findUserByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid credentials');

    const valid = await checkPasswordHash(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedError('Account is deactivated');

    // 1 hour expiry
    const token = makeJWT(String(user.id), 3600, config.secret);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  }),
);

// GET /api/auth/me 
router.get(
  '/auth/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthenticatedRequest;
    res.json({ user });
  }),
);

// GET /api/users  (admin only) 
router.get(
  '/users',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const role = (req.query.role as string) || 'front_desk';
    const users = await listActiveUsersByRole(role as any);
    res.json({ users });
  }),
);

// GET /api/users/search?q= 
router.get(
  '/users/search',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    if (!q) throw new BadRequestError('Query parameter "q" is required');
    const users = await searchUsers(q);
    res.json({ users });
  }),
);

// GET /api/permissions 
router.get(
  '/permissions',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const perms = await listPermissions();
    res.json({ permissions: perms });
  }),
);

// GET /api/roles/:role/permissions ───────────────────────────────
router.get(
  '/roles/:role/permissions',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.params;
    const perms = await listPermissionsForRole(role as any);
    res.json({ permissions: perms });
  }),
);

export default router;
