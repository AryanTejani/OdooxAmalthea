import { Request, Response } from 'express';
import { orgService } from './org.service';
import { createOrgUnitSchema, createEmployeeSchema } from '../../domain/schemas';
import { logger } from '../../config/logger';
import { z } from 'zod';

export async function getOrgUnitsController(req: Request, res: Response): Promise<void> {
  try {
    const units = await orgService.getOrgUnits();
    res.json({ data: units });
  } catch (error) {
    logger.error({ error }, 'Failed to get org units');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch organization units',
      },
    });
  }
}

export async function createOrgUnitController(req: Request, res: Response): Promise<void> {
  try {
    const data = createOrgUnitSchema.parse(req.body);
    const unit = await orgService.createOrgUnit(data, req.user!.userId);
    res.status(201).json({ data: unit });
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

    logger.error({ error }, 'Failed to create org unit');
    const message = error instanceof Error ? error.message : 'Failed to create organization unit';
    res.status(400).json({
      error: {
        code: 'CREATE_FAILED',
        message,
      },
    });
  }
}

export async function createEmployeeController(req: Request, res: Response): Promise<void> {
  try {
    const data = createEmployeeSchema.parse(req.body);
    const employee = await orgService.createEmployee(data, req.user!.userId);
    res.status(201).json({ data: employee });
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

    logger.error({ error }, 'Failed to create employee');
    const message = error instanceof Error ? error.message : 'Failed to create employee';
    res.status(400).json({
      error: {
        code: 'CREATE_FAILED',
        message,
      },
    });
  }
}

export async function getEmployeeByUserIdController(req: Request, res: Response): Promise<void> {
  try {
    const employee = await orgService.getEmployeeByUserId(req.user!.userId);
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }
    res.json({ data: employee });
  } catch (error) {
    logger.error({ error }, 'Failed to get employee');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch employee',
      },
    });
  }
}


