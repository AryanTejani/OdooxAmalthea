import { Router } from 'express';
import * as leaveController from './leave.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireLeaveApprover } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Create leave request
router.post('/', leaveController.createLeaveRequestController);

// Get my leave requests
router.get('/mine', leaveController.getMyLeaveRequestsController);

// Get pending leave requests (HR Officer, Payroll Officer, Admin only)
router.get('/pending', requireLeaveApprover, leaveController.getPendingLeaveRequestsController);

// Approve leave request (HR Officer, Payroll Officer, Admin only)
router.post('/:id/approve', requireLeaveApprover, leaveController.approveLeaveRequestController);

// Reject leave request (HR Officer, Payroll Officer, Admin only)
router.post('/:id/reject', requireLeaveApprover, leaveController.rejectLeaveRequestController);

export default router;


