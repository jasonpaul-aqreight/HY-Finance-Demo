import type { Request, Response, NextFunction } from 'express';
import type { UserPayload } from '../services/ability.service.js';
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
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.middleware.d.ts.map