import { Router } from 'express';
import * as orgController from './org.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireAdmin, requireHROfficer } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get org units (all authenticated users)
router.get('/units', orgController.getOrgUnitsController);

// Create org unit (admin only)
router.post('/units', requireAdmin, orgController.createOrgUnitController);

// Create employee (HR Officer/Admin only)
router.post('/employees', requireHROfficer, orgController.createEmployeeController);

// Get employee by user ID
router.get('/employees/me', orgController.getEmployeeByUserIdController);

// Get all employees (all authenticated users can view employee directory)
router.get('/employees', orgController.getAllEmployeesController);

export default router;


