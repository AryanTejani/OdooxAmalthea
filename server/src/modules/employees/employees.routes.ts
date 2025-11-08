import { Router } from 'express';
import * as orgController from '../org/org.controller';
import * as employeesController from './employees.controller';
import * as salaryController from '../salary/salary.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireRole } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get employees grid with status (for landing page)
router.get('/grid', orgController.getEmployeesGridController);

// Get employee salary (employees can view own, admin/payroll can view any)
router.get('/:id/salary', employeesController.getEmployeeSalaryController);

// Get salary configuration (employees can view own, admin/payroll can view any)
router.get('/:id/configuration', salaryController.getSalaryConfigurationController);

// Update salary configuration (admin/payroll only)
router.put(
  '/:id/configuration',
  requireRole(['admin', 'manager']),
  salaryController.updateSalaryConfigurationController
);

export default router;

