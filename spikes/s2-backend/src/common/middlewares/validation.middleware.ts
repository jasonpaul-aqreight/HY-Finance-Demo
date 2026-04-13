import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod/v4';

/**
 * Zod 4 validation middleware factory.
 * Usage: validate(createSaleRecordSchema)
 */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    // Replace body with parsed + transformed data
    req.body = result.data;
    next();
  };
}
