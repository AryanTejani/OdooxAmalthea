import { Request, Response } from 'express';
import { attendanceService } from './attendance.service';
import { orgService } from '../org/org.service';
import { attendanceQuerySchema } from '../../domain/schemas';
import { logger } from '../../config/logger';
import { z } from 'zod';

export async function punchInController(req: Request, res: Response): Promise<void> {
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

    const inAt = req.body.inAt ? new Date(req.body.inAt) : undefined;
    const record = await attendanceService.punchIn(employee.id, userId, inAt);

    res.json({ data: record });
  } catch (error) {
    logger.error({ error }, 'Failed to punch in');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to punch in',
      },
    });
  }
}

export async function punchOutController(req: Request, res: Response): Promise<void> {
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

    const outAt = req.body.outAt ? new Date(req.body.outAt) : undefined;
    const record = await attendanceService.punchOut(employee.id, userId, outAt);

    res.json({ data: record });
  } catch (error) {
    logger.error({ error }, 'Failed to punch out');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to punch out',
      },
    });
  }
}

export async function getMyAttendanceController(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const query = attendanceQuerySchema.parse(req.query);

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

    const records = await attendanceService.getMyAttendance(employee.id, query.month);
    res.json({ data: records });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to get attendance');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch attendance',
      },
    });
  }
}

export async function getTeamBoardController(req: Request, res: Response): Promise<void> {
  try {
    const query = attendanceQuerySchema.parse(req.query);

    if (!query.day) {
      // Default to today
      const today = new Date();
      query.day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    const board = await attendanceService.getTeamBoard(query.day, query.orgUnitId);
    res.json({ data: board });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to get team board');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch team board',
      },
    });
  }
}


