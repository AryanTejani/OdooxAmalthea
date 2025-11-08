import { Router } from 'express';
import * as adminController from './admin.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';

const router = Router();

// All routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// Get all users
router.get('/users', adminController.getAllUsersController);

// Update user role
router.patch('/users/:id/role', adminController.updateUserRoleController);

export default router;

