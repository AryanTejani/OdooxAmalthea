import { Router } from 'express';
import * as orgController from '../org/org.controller';
import { requireAuth } from '../../middleware/requireAuth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get employees grid with status (for landing page)
router.get('/grid', orgController.getEmployeesGridController);

export default router;

