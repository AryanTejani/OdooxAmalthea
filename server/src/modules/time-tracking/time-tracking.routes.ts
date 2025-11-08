import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireHROfficer } from '../../middleware/rbac';
import * as timeTrackingController from './time-tracking.controller';

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// Time Logs
router.get('/time-logs', timeTrackingController.getTimeLogsController); // Employees see their own, HR sees all
router.get('/time-logs/active', timeTrackingController.getActiveTimerController); // Get active timer
router.get('/time-logs/:id', timeTrackingController.getTimeLogByIdController);
router.post('/time-logs/start', timeTrackingController.startTimerController); // Start timer
router.post('/time-logs/stop', timeTrackingController.stopTimerController); // Stop timer
router.post('/time-logs/heartbeat', timeTrackingController.heartbeatController); // Heartbeat
router.post('/time-logs', timeTrackingController.createTimeLogController); // Manual time log
router.put('/time-logs/:id', timeTrackingController.updateTimeLogController);
router.delete('/time-logs/:id', timeTrackingController.deleteTimeLogController);

export default router;

