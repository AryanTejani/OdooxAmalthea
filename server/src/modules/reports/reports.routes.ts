import { Router } from 'express';
import * as reportsController from './reports.controller';
import { requireRole } from '../../middleware/rbac';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';

const router = Router();

// All routes require authentication, tenant context, and admin/payroll role
router.use(requireAuth);
router.use(requireTenant);
router.use(requireRole(['admin', 'payroll']));

// Get employees for report selection
router.get('/employees', reportsController.getReportEmployeesController);

// Get salary statement
router.get('/salary-statement', reportsController.getSalaryStatementController);

export default router;

