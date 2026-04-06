import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod/v4';
/**
 * Zod 4 validation middleware factory.
 * Usage: validate(createSaleRecordSchema)
 */
export declare function validate(schema: ZodType): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.middleware.d.ts.map