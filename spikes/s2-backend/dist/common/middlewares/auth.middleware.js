/**
 * Simulated auth middleware for spike — extracts role from x-user-role header.
 * In production this would verify JWT from NextAuth.
 */
export function authMiddleware(req, res, next) {
    const role = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    if (!role || !userId) {
        res.status(401).json({ error: 'Missing auth headers (x-user-role, x-user-id)' });
        return;
    }
    req.user = {
        id: userId,
        role,
        department_code: req.headers['x-department-code'],
    };
    next();
}
//# sourceMappingURL=auth.middleware.js.map