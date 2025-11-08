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
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const leaves = await leaveService.getPendingLeaveRequests(req.companyId);
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
    const data = approveLeaveSchema.parse({
      ...req.body,
      approverId: req.user!.userId,
    });

    const leave = await leaveService.approveLeaveRequest(id, data, req.companyId);
    res.json({ data: leave });
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
    const data = rejectLeaveSchema.parse({
      ...req.body,
      approverId: req.user!.userId,
    });

    const leave = await leaveService.rejectLeaveRequest(id, data, req.companyId);
    res.json({ data: leave });
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


