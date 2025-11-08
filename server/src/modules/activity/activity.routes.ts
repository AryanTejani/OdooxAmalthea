import { Router } from 'express';
import * as activityController from './activity.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// Get latest activities
router.get('/latest', activityController.getLatestActivitiesController);

export default router;


