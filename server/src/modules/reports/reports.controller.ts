import { Request, Response, NextFunction } from 'express';
import * as reportsService from './reports.service';
import { AppError } from '../../middleware/errors';
import { logger } from '../../config/logger';

export async function getReportEmployeesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Company ID not found',
        },
      });
      return;
    }

    const employees = await reportsService.getReportEmployees(req.companyId);

    res.json({
      data: employees,
    });
  } catch (error) {
    logger.error({ error, companyId: req.companyId }, 'Failed to get report employees');
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    next(error);
  }
}

export async function getSalaryStatementController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Company ID not found',
        },
      });
      return;
    }

    const employeeId = req.query.employeeId as string;
    const year = parseInt(req.query.year as string, 10);

    if (!employeeId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Employee ID is required',
        },
      });
      return;
    }

    if (!year || isNaN(year)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid year is required',
        },
      });
      return;
    }

    const statement = await reportsService.getSalaryStatement(
      req.companyId,
      employeeId,
      year
    );

    res.json({
      data: statement,
    });
  } catch (error) {
    logger.error({ error, companyId: req.companyId, params: req.params, query: req.query }, 'Failed to get salary statement');
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    next(error);
  }
}

