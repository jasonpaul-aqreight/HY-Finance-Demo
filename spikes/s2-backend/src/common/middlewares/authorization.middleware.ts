import type { Request, Response, NextFunction } from 'express';
import { defineAbilityFor } from '../services/ability.service.js';
import type { AppActions, AppSubjects } from '../services/ability.service.js';

/**
 * CASL 6 authorization middleware factory.
 * Usage: authorize('read', 'FinanceDashboard')
 */
export function authorize(action: AppActions, subject: AppSubjects) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const ability = defineAbilityFor(req.user);

    if (ability.can(action, subject)) {
      next();
    } else {
      res.status(403).json({
        error: 'Forbidden',
        detail: `Role '${req.user.role}' cannot '${action}' on '${subject}'`,
      });
    }
  };
}
