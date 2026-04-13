import type { Request, Response, NextFunction } from 'express';
import type { AppActions, AppSubjects } from '../services/ability.service.js';
/**
 * CASL 6 authorization middleware factory.
 * Usage: authorize('read', 'FinanceDashboard')
 */
export declare function authorize(action: AppActions, subject: AppSubjects): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authorization.middleware.d.ts.map