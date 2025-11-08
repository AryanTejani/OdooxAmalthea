import { Request, Response } from 'express';
import { leaveService } from './leave.service';
import { orgService } from '../org/org.service';
import {
  createLeaveRequestSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
} from '../../domain/schemas';
import { logger } from '../../config/logger';
import { z } from 'zod';

export async function createLeaveRequestController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Get employee for this user
    const employee = await orgService.getEmployeeByUserId(userId);
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
    const leave = await leaveService.createLeaveRequest(data, employee.id, userId);

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
    const userId = req.user!.userId;

    // Get employee for this user
    const employee = await orgService.getEmployeeByUserId(userId);
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }

    const leaves = await leaveService.getMyLeaveRequests(employee.id);
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
    const leaves = await leaveService.getPendingLeaveRequests();
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
    const { id } = req.params;
    const data = approveLeaveSchema.parse({
      ...req.body,
      approverId: req.user!.userId,
    });

    const leave = await leaveService.approveLeaveRequest(id, data);
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

export async function rejectLeaveRequestController(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const data = rejectLeaveSchema.parse({
      ...req.body,
      approverId: req.user!.userId,
    });

    const leave = await leaveService.rejectLeaveRequest(id, data);
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


