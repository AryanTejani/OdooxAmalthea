import { Request, Response, NextFunction } from 'express';
import * as attendanceV2Repo from './attendance-v2.repo';
import { AppError } from '../../middleware/errors';
import { getEmployeeByUserId } from '../org/org.repo';
import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

/**
 * GET /api/attendance/day - Get attendance for all employees for a specific day (admin/hr/payroll)
 */
export async function getAttendanceDayController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parse date from query (default to today)
    let dateStr: string;
    if (req.query.date) {
      dateStr = req.query.date as string;
      // Validate date format
      const parseResult = dateSchema.safeParse(dateStr);
      if (!parseResult.success) {
        throw new AppError('VALIDATION_ERROR', 'Invalid date format. Expected YYYY-MM-DD', 400);
      }
      dateStr = parseResult.data;
    } else {
      // Default to today in UTC (YYYY-MM-DD)
      const today = new Date();
      dateStr = today.toISOString().split('T')[0];
    }
    
    // Validate the date is actually valid (e.g., not 2025-13-45)
    const [year, month, day] = dateStr.split('-').map(Number);
    const testDate = new Date(Date.UTC(year, month - 1, day));
    if (
      testDate.getUTCFullYear() !== year ||
      testDate.getUTCMonth() !== month - 1 ||
      testDate.getUTCDate() !== day
    ) {
      throw new AppError('VALIDATION_ERROR', 'Invalid date (e.g., month > 12 or day > 31)', 400);
    }
    
    const searchQuery = req.query.q as string | undefined;
    
    const rows = await attendanceV2Repo.getAttendanceDay(dateStr, searchQuery);
    
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attendance/me - Get own attendance for a month (employee)
 */
export async function getAttendanceMeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
    }
    
    // Get employee
    const employee = await getEmployeeByUserId(req.user.userId);
    if (!employee) {
      throw new AppError('NOT_FOUND', 'Employee not found', 404);
    }
    
    // Parse month from query (default to current month)
    const monthStr = req.query.month as string || 
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const month = monthSchema.parse(monthStr);
    const [year, monthNum] = month.split('-').map(Number);
    
    if (year < 2000 || year > 2100 || monthNum < 1 || monthNum > 12) {
      throw new AppError('VALIDATION_ERROR', 'Invalid month format', 400);
    }
    
    const result = await attendanceV2Repo.getAttendanceMe(employee.id, year, monthNum);
    
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attendance/payable-summary - Get payable summary for payroll (admin/payroll)
 */
export async function getPayableSummaryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parse month from query (default to current month)
    const monthStr = req.query.month as string || 
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const month = monthSchema.parse(monthStr);
    const [year, monthNum] = month.split('-').map(Number);
    
    if (year < 2000 || year > 2100 || monthNum < 1 || monthNum > 12) {
      throw new AppError('VALIDATION_ERROR', 'Invalid month format', 400);
    }
    
    const summary = await attendanceV2Repo.getPayableSummary(year, monthNum);
    
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
}

