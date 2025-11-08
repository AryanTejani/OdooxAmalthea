import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { requireHROfficer } from '../../middleware/rbac';
import * as timeTrackingController from './time-tracking.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Projects
router.get('/projects', timeTrackingController.getAllProjectsController);
router.get('/projects/:id', timeTrackingController.getProjectByIdController);
router.post('/projects', requireHROfficer, timeTrackingController.createProjectController);
router.put('/projects/:id', requireHROfficer, timeTrackingController.updateProjectController);
router.delete('/projects/:id', requireHROfficer, timeTrackingController.deleteProjectController);

// Tasks
router.get('/projects/:projectId/tasks', timeTrackingController.getTasksByProjectController);
router.get('/tasks/me', timeTrackingController.getTasksByEmployeeController); // Get my tasks
router.get('/tasks/:id', timeTrackingController.getTaskByIdController);
router.post('/tasks', requireHROfficer, timeTrackingController.createTaskController);
router.put('/tasks/:id', requireHROfficer, timeTrackingController.updateTaskController);
router.delete('/tasks/:id', requireHROfficer, timeTrackingController.deleteTaskController);

// Time Logs
router.get('/time-logs', timeTrackingController.getTimeLogsController); // Employees see their own, HR sees all
router.get('/time-logs/active', timeTrackingController.getActiveTimerController); // Get active timer
router.get('/time-logs/:id', timeTrackingController.getTimeLogByIdController);
router.post('/time-logs/start', timeTrackingController.startTimerController); // Start timer
router.post('/time-logs/stop', timeTrackingController.stopTimerController); // Stop timer
router.post('/time-logs', timeTrackingController.createTimeLogController); // Manual time log
router.put('/time-logs/:id', timeTrackingController.updateTimeLogController);
router.delete('/time-logs/:id', timeTrackingController.deleteTimeLogController);

export default router;

