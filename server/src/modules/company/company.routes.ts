import { Router } from 'express';
import * as companyController from './company.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/rbac';

const router = Router();

/**
 * GET /api/company/me
 * Get current user's company
 */
router.get('/me', requireAuth, requireTenant, companyController.getMyCompanyController);

/**
 * PATCH /api/company
 * Update company (admin only)
 */
router.patch('/', requireAuth, requireTenant, requireRole(['admin']), companyController.updateCompanyController);

export default router;

