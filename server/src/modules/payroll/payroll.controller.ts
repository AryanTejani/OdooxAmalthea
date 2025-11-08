import { Request, Response } from 'express';
import { payrollService } from './payroll.service';
import {
  createPayrunSchema,
  payrunIdParamSchema,
  payslipIdParamSchema,
  getPayrunsQuerySchema,
  getMyPayslipsQuerySchema,
} from '../../domain/schemas';
import { logger } from '../../config/logger';
import { z } from 'zod';

/**
 * POST /api/payroll/payruns - Create a draft payrun
 */
export async function createPayrunController(req: Request, res: Response): Promise<void> {
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

    const data = createPayrunSchema.parse(req.body);
    const payrun = await payrollService.createPayrun(data, req.user!.userId, req.companyId);
    
    res.status(201).json({ data: payrun });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to create payrun');
    const message = error instanceof Error ? error.message : 'Failed to create payrun';
    res.status(400).json({
      error: {
        code: 'CREATE_FAILED',
        message,
      },
    });
  }
}

/**
 * POST /api/payroll/payruns/:id/compute - Compute payslips for a payrun
 */
export async function computePayslipsController(req: Request, res: Response): Promise<void> {
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

    const { id } = payrunIdParamSchema.parse(req.params);
    const result = await payrollService.computePayslips(id, req.user!.userId, req.companyId);
    
    res.json({ 
      data: result.payrun,
      warnings: result.warnings,
      processedCount: result.processedCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to compute payslips');
    const message = error instanceof Error ? error.message : 'Failed to compute payslips';
    const statusCode = (error as any).statusCode || 400;
    res.status(statusCode).json({
      error: {
        code: 'COMPUTE_FAILED',
        message,
      },
    });
  }
}

/**
 * POST /api/payroll/payruns/:id/validate - Validate a payrun
 */
export async function validatePayrunController(req: Request, res: Response): Promise<void> {
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

    const { id } = payrunIdParamSchema.parse(req.params);
    const payrun = await payrollService.validatePayrun(id, req.user!.userId, req.companyId);
    
    res.json({ data: payrun });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to validate payrun');
    const message = error instanceof Error ? error.message : 'Failed to validate payrun';
    const statusCode = (error as any).statusCode || 400;
    res.status(statusCode).json({
      error: {
        code: 'VALIDATE_FAILED',
        message,
      },
    });
  }
}

/**
 * POST /api/payroll/payruns/:id/cancel - Cancel a payrun
 */
export async function cancelPayrunController(req: Request, res: Response): Promise<void> {
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

    const { id } = payrunIdParamSchema.parse(req.params);
    const payrun = await payrollService.cancelPayrun(id, req.user!.userId, req.companyId);
    
    res.json({ data: payrun });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to cancel payrun');
    const message = error instanceof Error ? error.message : 'Failed to cancel payrun';
    const statusCode = (error as any).statusCode || 400;
    res.status(statusCode).json({
      error: {
        code: 'CANCEL_FAILED',
        message,
      },
    });
  }
}

/**
 * GET /api/payroll/payruns - Get all payruns (paginated)
 */
export async function getPayrunsController(req: Request, res: Response): Promise<void> {
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

    const query = getPayrunsQuerySchema.parse(req.query);
    const payruns = await payrollService.getPayruns(
      req.companyId,
      query.limit,
      query.offset
    );
    
    res.json({ data: payruns });
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

    logger.error({ error }, 'Failed to get payruns');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payruns',
      },
    });
  }
}

/**
 * GET /api/payroll/payruns/:id/payslips - Get payslips for a payrun
 */
export async function getPayslipsByPayrunController(req: Request, res: Response): Promise<void> {
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

    const { id } = payrunIdParamSchema.parse(req.params);
    const payslips = await payrollService.getPayslipsByPayrunId(
      id,
      req.companyId,
      req.user!.userId,
      req.user!.role
    );
    
    res.json({ data: payslips });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to get payslips');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payslips',
      },
    });
  }
}

/**
 * GET /api/payroll/payslips/:id - Get a single payslip by ID
 */
export async function getPayslipDetailController(req: Request, res: Response): Promise<void> {
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

    const { id } = payslipIdParamSchema.parse(req.params);
    const payslip = await payrollService.getPayslipById(
      id,
      req.companyId,
      req.user!.userId,
      req.user!.role
    );
    
    res.json({ data: payslip });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to get payslip');
    const statusCode = (error as any).statusCode || 500;
    res.status(statusCode).json({
      error: {
        code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch payslip',
      },
    });
  }
}

/**
 * GET /api/payroll/my - Get current user's payslips
 */
export async function getMyPayslipsController(req: Request, res: Response): Promise<void> {
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

    const query = getMyPayslipsQuerySchema.parse(req.query);
    const payslips = await payrollService.getMyPayslips(
      req.user!.userId,
      req.companyId,
      query.month
    );
    
    res.json({ data: payslips });
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

    logger.error({ error }, 'Failed to get my payslips');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payslips',
      },
    });
  }
}

/**
 * POST /api/payroll/payslips/:id/recompute - Recompute a single payslip
 */
export async function recomputePayslipController(req: Request, res: Response): Promise<void> {
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

    const { id } = payslipIdParamSchema.parse(req.params);
    const payslip = await payrollService.recomputePayslip(
      id,
      req.user!.userId,
      req.companyId
    );
    
    res.json({ data: payslip });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to recompute payslip');
    const message = error instanceof Error ? error.message : 'Failed to recompute payslip';
    const statusCode = (error as any).statusCode || 400;
    res.status(statusCode).json({
      error: {
        code: 'RECOMPUTE_FAILED',
        message,
      },
    });
  }
}

/**
 * GET /api/payroll/warnings - Get payroll warnings
 */
export async function getWarningsController(req: Request, res: Response): Promise<void> {
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

    const warnings = await payrollService.getWarnings(req.companyId);
    
    res.json({ data: warnings });
  } catch (error) {
    logger.error({ error }, 'Failed to get warnings');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch warnings',
      },
    });
  }
}

/**
 * GET /api/payroll/stats - Get monthly stats for dashboard charts
 */
export async function getMonthlyStatsController(req: Request, res: Response): Promise<void> {
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

    const months = req.query.months ? parseInt(req.query.months as string) : undefined;
    const stats = await payrollService.getMonthlyStats(req.companyId, months);
    
    res.json({ data: stats });
  } catch (error) {
    logger.error({ error }, 'Failed to get monthly stats');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch monthly stats',
      },
    });
  }
}
