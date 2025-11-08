import { Router } from 'express';
import * as dashboardController from './dashboard.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// Get dashboard statistics (role-based)
router.get('/stats', dashboardController.getDashboardStats);

export default router;

