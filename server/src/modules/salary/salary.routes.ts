import { Router } from 'express';
import * as salaryController from './salary.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/rbac';

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// Get employees without salary config (admin|hr|payroll only) - must come before /:employeeId
router.get(
  '/employees-without-config',
  requireRole(['admin', 'hr', 'payroll']),
  salaryController.getEmployeesWithoutSalary
);

// Get all salary configurations (admin|hr|payroll only) - must come before /:employeeId
router.get(
  '/',
  requireRole(['admin', 'hr', 'payroll']),
  salaryController.getSalaryConfigs
);

// Get salary configuration for specific employee (admin|payroll can view any, employees|hr can view own) - must come last
router.get(
  '/:employeeId',
  salaryController.getSalaryConfigByEmployeeId
);

// Create salary configuration (admin|payroll only)
router.post(
  '/',
  requireRole(['admin', 'payroll']),
  salaryController.createSalaryConfig
);

// Update salary configuration (admin|payroll only)
router.put(
  '/:employeeId',
  requireRole(['admin', 'payroll']),
  salaryController.updateSalaryConfig
);

// Delete salary configuration (admin only)
router.delete(
  '/:employeeId',
  requireRole(['admin']),
  salaryController.deleteSalaryConfig
);

export default router;

