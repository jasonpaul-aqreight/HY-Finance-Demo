/**
 * Zod 4 validation middleware factory.
 * Usage: validate(createSaleRecordSchema)
 */
export function validate(schema) {
    return (req, res, next) => {
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
//# sourceMappingURL=validation.middleware.js.map