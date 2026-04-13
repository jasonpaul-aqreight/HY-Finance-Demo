import { Router } from 'express';
import financeRoutes from '../modules/finance/finance.routes.js';
const router = Router();
router.use('/finance', financeRoutes);
// Future: router.use('/hr', hrRoutes);
// Future: router.use('/sales', salesRoutes);
export default router;
//# sourceMappingURL=routes.index.js.map