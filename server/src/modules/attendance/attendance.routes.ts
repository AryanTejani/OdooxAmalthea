import { Router } from 'express';
import * as attendanceController from './attendance.controller';
import * as attendanceV2Controller from './attendance-v2.controller';
import { requireAuth } from '../../middleware/auth';
import { requireManager, requireRole } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Punch in/out (legacy - kept for backward compatibility)
router.post('/punch-in', attendanceController.punchInController);
router.post('/punch-out', attendanceController.punchOutController);

// Legacy endpoints (kept for backward compatibility)
router.get('/board', requireManager, attendanceController.getTeamBoardController);

// New endpoints (computed from activity_samples)
// Get attendance day view (admin/hr/payroll only) - replaces /board for day view
router.get('/day', requireRole(['admin', 'hr', 'payroll']), attendanceV2Controller.getAttendanceDayController);

// Get own attendance month view (any authenticated user) - replaces /me
router.get('/me', attendanceV2Controller.getAttendanceMeController);

// Get payable summary for payroll (admin/payroll only)
router.get('/payable-summary', requireRole(['admin', 'manager']), attendanceV2Controller.getPayableSummaryController);

export default router;


