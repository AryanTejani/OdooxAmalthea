import { Request, Response } from 'express';
import { payrollService } from './payroll.service';
import { generatePayrunSchema } from '../../domain/schemas';
import { logger } from '../../config/logger';
import { z } from 'zod';

export async function generatePayrunController(req: Request, res: Response): Promise<void> {
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
    const query = generatePayrunSchema.parse(req.query);
    const summary = await payrollService.generatePayrun(query, req.user!.userId, req.companyId);
    res.status(201).json({ data: summary });
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

    logger.error({ error }, 'Failed to generate payrun');
    const message = error instanceof Error ? error.message : 'Failed to generate payrun';
    res.status(400).json({
      error: {
        code: 'GENERATE_FAILED',
        message,
      },
    });
  }
}

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
    const payruns = await payrollService.getPayruns(req.companyId);
    res.json({ data: payruns });
  } catch (error) {
    logger.error({ error }, 'Failed to get payruns');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payruns',
      },
    });
  }
}

export async function finalizePayrunController(req: Request, res: Response): Promise<void> {
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
    const { payrunId } = req.params;
    const payrun = await payrollService.finalizePayrun(payrunId, req.user!.userId, req.companyId);
    res.json({ data: payrun });
  } catch (error) {
    logger.error({ error }, 'Failed to finalize payrun');
    const message = error instanceof Error ? error.message : 'Failed to finalize payrun';
    res.status(400).json({
      error: {
        code: 'FINALIZE_FAILED',
        message,
      },
    });
  }
}

export async function getPayslipsByPayrunIdController(req: Request, res: Response): Promise<void> {
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
    const { payrunId } = req.params;
    const payslips = await payrollService.getPayslipsByPayrunId(payrunId, req.companyId);
    res.json({ data: payslips });
  } catch (error) {
    logger.error({ error }, 'Failed to get payslips');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payslips',
      },
    });
  }
}

export async function getPayslipByIdController(req: Request, res: Response): Promise<void> {
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
    const payslip = await payrollService.getPayslipById(id, req.companyId);
    if (!payslip) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Payslip not found',
        },
      });
      return;
    }
    res.json({ data: payslip });
  } catch (error) {
    logger.error({ error }, 'Failed to get payslip');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch payslip',
      },
    });
  }
}


