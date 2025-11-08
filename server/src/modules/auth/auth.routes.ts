import { Router } from 'express';
import * as authController from './auth.controller';
import { requireAuth } from '../../middleware/auth';
import { authRateLimit } from '../../middleware/rateLimit';

const router = Router();

// Public routes with rate limiting
router.post('/register', authRateLimit, authController.registerController);
router.post('/login', authRateLimit, authController.loginController);

// Refresh token route (no rate limit - needed for silent refresh)
router.post('/refresh', authController.refreshController);

// Logout route
router.post('/logout', authController.logoutController);

// Protected routes
router.get('/me', requireAuth, authController.getMeController);

export default router;

