import { Router } from 'express';
import * as saasController from './saas.controller';

const router = Router();

/**
 * POST /api/saas/signup
 * Company admin signup
 */
router.post('/signup', saasController.companySignupController);

/**
 * POST /api/saas/login
 * Company admin login
 */
router.post('/login', saasController.companyLoginController);

export default router;

