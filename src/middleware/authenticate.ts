import { Request, Response, NextFunction } from 'express';
import { validateJWT, getBearerToken } from '../auth.js';
import { config } from '../config.js';
import { UnauthorizedError } from '../errors.js';
import { findUserById } from './helpers/lookupUser.js';


export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}


export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.secret);

    const user = await findUserById(Number(userId));
    if (!user) throw new UnauthorizedError('User not found');
    if (!user.isActive) throw new UnauthorizedError('Account is deactivated');

    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch (err) {
    next(err);
  }
};
