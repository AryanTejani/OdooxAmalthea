import { Router } from 'express';
import * as leaveController from './leave.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTenant } from '../../middleware/tenant';
import { requireLeaveApprover } from '../../middleware/rbac';

const router = Router();

// All routes require authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// Create leave request
router.post('/', leaveController.createLeaveRequestController);

// Get my leave requests
router.get('/mine', leaveController.getMyLeaveRequestsController);

// Update leave request (only for PENDING status, employee can only update their own)
router.patch('/:id', leaveController.updateLeaveRequestController);

// Get pending leave requests (HR Officer and Admin only)
// Note: HR can see all pending leave requests except their own (which go to admin)
// Payroll officers cannot access leave requests (finance only)
router.get('/pending', requireLeaveApprover, leaveController.getPendingLeaveRequestsController);

// Approve leave request (HR Officer and Admin only)
// Note: HR's own leave requests must be approved by admin
router.post('/:id/approve', requireLeaveApprover, leaveController.approveLeaveRequestController);

// Reject leave request (HR Officer and Admin only)
// Note: HR's own leave requests must be rejected by admin
router.post('/:id/reject', requireLeaveApprover, leaveController.rejectLeaveRequestController);

export default router;


