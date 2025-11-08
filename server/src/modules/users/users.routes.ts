import { Router } from 'express';
import * as authController from '../auth/auth.controller';
import { requireAuth } from '../../middleware/auth';
import { authRateLimit } from '../../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Reset password (admin only)
router.post('/reset-password', authRateLimit, authController.resetPasswordController);

export default router;

