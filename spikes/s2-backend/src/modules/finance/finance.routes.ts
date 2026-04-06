import { Router } from 'express';
import { financeController } from './finance.controller.js';
import { authorize } from '../../common/middlewares/authorization.middleware.js';
import { validate } from '../../common/middlewares/validation.middleware.js';
import { createSaleRecordSchema } from './finance.validation.js';

const router = Router();

// GET /api/v1/finance/sales — requires FinanceDashboard read
router.get(
  '/sales',
  authorize('read', 'FinanceDashboard'),
  financeController.getSalesDaily,
);

// POST /api/v1/finance/sales — requires FinanceDashboard create + Zod validation
router.post(
  '/sales',
  authorize('create', 'FinanceDashboard'),
  validate(createSaleRecordSchema),
  financeController.createSaleRecord,
);

// GET /api/v1/finance/settings — requires FinanceSettings read
router.get(
  '/settings',
  authorize('read', 'FinanceSettings'),
  financeController.getSettings,
);

export default router;
