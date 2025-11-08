import { Router } from 'express';
import * as attendanceV2Controller from './attendance-v2.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireRole } from '../../middleware/rbac';

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// New endpoints (computed from time_logs and activity_samples)
// Get attendance day view (admin/hr/payroll only)
router.get('/day', requireRole(['admin', 'hr', 'payroll']), attendanceV2Controller.getAttendanceDayController);

// Get own attendance month view (any authenticated user)
router.get('/me', attendanceV2Controller.getAttendanceMeController);

// Get payable summary for payroll (admin/payroll only)
router.get('/payable-summary', requireRole(['admin', 'payroll']), attendanceV2Controller.getPayableSummaryController);

export default router;


