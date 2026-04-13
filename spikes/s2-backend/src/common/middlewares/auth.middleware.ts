import type { Request, Response, NextFunction } from 'express';
import type { UserPayload } from '../services/ability.service.js';

// Extend Express Request to carry user payload
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

/**
 * Simulated auth middleware for spike — extracts role from x-user-role header.
 * In production this would verify JWT from NextAuth.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const role = req.headers['x-user-role'] as string;
  const userId = req.headers['x-user-id'] as string;

  if (!role || !userId) {
    res.status(401).json({ error: 'Missing auth headers (x-user-role, x-user-id)' });
    return;
  }

  req.user = {
    id: userId,
    role,
    department_code: req.headers['x-department-code'] as string | undefined,
  };

  next();
}
