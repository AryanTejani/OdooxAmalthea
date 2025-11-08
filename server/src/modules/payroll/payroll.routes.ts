import { Router } from 'express';
import * as payrollController from './payroll.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/rbac';

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// Create payrun (admin|payroll only)
router.post(
  '/payruns',
  requireRole(['admin', 'payroll']),
  payrollController.createPayrunController
);

// Get all payruns (admin|payroll only)
router.get(
  '/payruns',
  requireRole(['admin', 'payroll']),
  payrollController.getPayrunsController
);

// Compute payslips for a payrun (admin|payroll only)
router.post(
  '/payruns/:id/compute',
  requireRole(['admin', 'payroll']),
  payrollController.computePayslipsController
);

// Validate payrun (admin|payroll only)
router.post(
  '/payruns/:id/validate',
  requireRole(['admin', 'payroll']),
  payrollController.validatePayrunController
);

// Cancel payrun (admin|payroll only)
router.post(
  '/payruns/:id/cancel',
  requireRole(['admin', 'payroll']),
  payrollController.cancelPayrunController
);

// Get payslips for a payrun (admin|payroll see all; employee sees own)
router.get(
  '/payruns/:id/payslips',
  payrollController.getPayslipsByPayrunController
);

// Get single payslip detail (admin|payroll see all; employee sees own)
router.get(
  '/payslips/:id',
  payrollController.getPayslipDetailController
);

// Recompute single payslip (admin|payroll only)
router.post(
  '/payslips/:id/recompute',
  requireRole(['admin', 'payroll']),
  payrollController.recomputePayslipController
);

// Get my payslips (all authenticated users)
router.get(
  '/my',
  payrollController.getMyPayslipsController
);

// Get payroll warnings (admin|payroll only)
router.get(
  '/warnings',
  requireRole(['admin', 'payroll']),
  payrollController.getWarningsController
);

// Get monthly stats for dashboard (admin|payroll only)
router.get(
  '/stats',
  requireRole(['admin', 'payroll']),
  payrollController.getMonthlyStatsController
);

export default router;
