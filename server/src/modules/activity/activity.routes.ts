import { Router } from 'express';
import * as activityController from './activity.controller';
import { requireAuth } from '../../middleware/requireAuth';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get latest activities
router.get('/latest', activityController.getLatestActivitiesController);

export default router;


