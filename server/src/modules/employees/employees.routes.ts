import { Router } from 'express';
import * as orgController from '../org/org.controller';
import * as employeesController from './employees.controller';
import { requireAuth } from '../../middleware/requireAuth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get employees grid with status (for landing page)
router.get('/grid', orgController.getEmployeesGridController);

// Get employee salary (employees can view own, admin/payroll can view any)
router.get('/:id/salary', employeesController.getEmployeeSalaryController);

// Note: Salary configuration management moved to /api/salary routes

export default router;

