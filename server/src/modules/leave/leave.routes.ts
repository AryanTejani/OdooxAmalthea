import { Router } from 'express';
import * as leaveController from './leave.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireManager } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Create leave request
router.post('/', leaveController.createLeaveRequestController);

// Get my leave requests
router.get('/mine', leaveController.getMyLeaveRequestsController);

// Get pending leave requests (manager/HR/admin only)
router.get('/pending', requireManager, leaveController.getPendingLeaveRequestsController);

// Approve leave request
router.post('/:id/approve', requireManager, leaveController.approveLeaveRequestController);

// Reject leave request
router.post('/:id/reject', requireManager, leaveController.rejectLeaveRequestController);

export default router;


