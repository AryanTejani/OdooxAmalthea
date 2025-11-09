import { Request, Response } from 'express';
import { leaveService } from './leave.service';
import { orgService } from '../org/org.service';
import {
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
} from '../../domain/schemas';
import { logger } from '../../config/logger';
import { z } from 'zod';
import { AppError } from '../../middleware/errors';

export async function createLeaveRequestController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const userId = req.user!.userId;

    // Get employee for this user (filtered by company)
    const employee = await orgService.getEmployeeByUserId(userId, req.companyId);
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }

    const data = createLeaveRequestSchema.parse(req.body);
    const leave = await leaveService.createLeaveRequest(data, employee.id, userId, req.companyId);

    res.status(201).json({ data: leave });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ error: error.errors, body: req.body }, 'Leave request validation failed');
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error, body: req.body }, 'Failed to create leave request');
    const message = error instanceof Error ? error.message : 'Failed to create leave request';
    res.status(400).json({
      error: {
        code: 'CREATE_FAILED',
        message,
      },
    });
  }
}

export async function getMyLeaveRequestsController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const userId = req.user!.userId;

    // Get employee for this user (filtered by company)
    const employee = await orgService.getEmployeeByUserId(userId, req.companyId);
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }

    const leaves = await leaveService.getMyLeaveRequests(employee.id, req.companyId);
    res.json({ data: leaves });
  } catch (error) {
    logger.error({ error }, 'Failed to get leave requests');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch leave requests',
      },
    });
  }
}

export async function getPendingLeaveRequestsController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId || !req.user) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const userRole = req.user.role;
    const userId = req.user.userId;

    // Get employee record for the current user (to check if they are HR)
    let excludeEmployeeId: string | undefined;
    if (userRole === 'hr') {
      // HR can see all pending leave requests EXCEPT their own
      // HR's own leave requests go to admin for approval
      const employee = await orgService.getEmployeeByUserId(userId, req.companyId);
      if (employee) {
        excludeEmployeeId = employee.id;
      }
    }
    // Admin can see all pending leave requests (excludeEmployeeId is undefined)

    const leaves = await leaveService.getPendingLeaveRequests(req.companyId, excludeEmployeeId);
    res.json({ data: leaves });
  } catch (error) {
    logger.error({ error }, 'Failed to get pending leave requests');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch pending leave requests',
      },
    });
  }
}

export async function approveLeaveRequestController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId || !req.user) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user.userId;

    // Get the leave request directly by ID to check if it exists and get employee info
    const leaveRequest = await leaveService.getLeaveRequestById(id, req.companyId);
    
    if (!leaveRequest) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Leave request not found',
        },
      });
      return;
    }

    if (leaveRequest.status !== 'PENDING') {
      res.status(400).json({
        error: {
          code: 'INVALID_STATUS',
          message: 'Leave request is not pending',
        },
      });
      return;
    }

    // If HR is trying to approve their own leave request, deny it (must go to admin)
    // Verify that HR can see this leave request (it should not be their own)
    if (userRole === 'hr') {
      const employee = await orgService.getEmployeeByUserId(userId, req.companyId);
      if (employee) {
        // Check if HR is trying to approve their own request
        if (leaveRequest.employeeId === employee.id) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'HR cannot approve their own leave requests. Please contact admin for approval.',
            },
          });
          return;
        }
        
        // Verify that HR can see this leave request (it should not be their own)
        const visibleLeaves = await leaveService.getPendingLeaveRequests(req.companyId, employee.id);
        const canSeeLeave = visibleLeaves.some(l => l.id === id);
        if (!canSeeLeave) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to approve this leave request',
            },
          });
          return;
        }
      }
    }

    const data = approveLeaveSchema.parse({
      ...req.body,
      approverId: userId,
    });

    const approvedLeave = await leaveService.approveLeaveRequest(id, data, req.companyId);
    res.json({ data: approvedLeave });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to approve leave request');
    const message = error instanceof Error ? error.message : 'Failed to approve leave request';
    res.status(400).json({
      error: {
        code: 'APPROVE_FAILED',
        message,
      },
    });
  }
}

export async function updateLeaveRequestController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const { id } = req.params;
    const userId = req.user!.userId;

    // Get employee for this user (filtered by company)
    const employee = await orgService.getEmployeeByUserId(userId, req.companyId);
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }

    const data = updateLeaveRequestSchema.parse(req.body);
    const leave = await leaveService.updateLeaveRequest(id, data, userId, employee.id, req.companyId);

    res.json({ data: leave });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ error: error.errors, body: req.body }, 'Leave request update validation failed');
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    logger.error({ error, body: req.body }, 'Failed to update leave request');
    const message = error instanceof Error ? error.message : 'Failed to update leave request';
    res.status(400).json({
      error: {
        code: 'UPDATE_FAILED',
        message,
      },
    });
  }
}

export async function rejectLeaveRequestController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId || !req.user) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user.userId;

    // Get the leave request directly by ID to check if it exists and get employee info
    const leaveRequest = await leaveService.getLeaveRequestById(id, req.companyId);
    
    if (!leaveRequest) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Leave request not found',
        },
      });
      return;
    }

    if (leaveRequest.status !== 'PENDING') {
      res.status(400).json({
        error: {
          code: 'INVALID_STATUS',
          message: 'Leave request is not pending',
        },
      });
      return;
    }

    // If HR is trying to reject their own leave request, deny it (must go to admin)
    if (userRole === 'hr') {
      const employee = await orgService.getEmployeeByUserId(userId, req.companyId);
      if (employee && leaveRequest.employeeId === employee.id) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'HR cannot reject their own leave requests. Please contact admin.',
          },
        });
        return;
      }
      
      // Verify that HR can see this leave request (it should not be their own)
      if (employee) {
        const visibleLeaves = await leaveService.getPendingLeaveRequests(req.companyId, employee.id);
        const canSeeLeave = visibleLeaves.some(l => l.id === id);
        if (!canSeeLeave) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to reject this leave request',
            },
          });
          return;
        }
      }
    }

    const data = rejectLeaveSchema.parse({
      ...req.body,
      approverId: userId,
    });

    const rejectedLeave = await leaveService.rejectLeaveRequest(id, data, req.companyId);
    res.json({ data: rejectedLeave });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to reject leave request');
    const message = error instanceof Error ? error.message : 'Failed to reject leave request';
    res.status(400).json({
      error: {
        code: 'REJECT_FAILED',
        message,
      },
    });
  }
}


