import { Router } from 'express';
import * as attendanceController from './attendance.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireManager } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Punch in/out
router.post('/punch-in', attendanceController.punchInController);
router.post('/punch-out', attendanceController.punchOutController);

// Get my attendance
router.get('/me', attendanceController.getMyAttendanceController);

// Team board (manager/HR/admin only)
router.get('/board', requireManager, attendanceController.getTeamBoardController);

export default router;


