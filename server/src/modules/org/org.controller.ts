import { Request, Response } from 'express';
import { orgService } from './org.service';
import { createOrgUnitSchema, createEmployeeSchema } from '../../domain/schemas';
import { logger } from '../../config/logger';
import { z } from 'zod';

export async function getOrgUnitsController(req: Request, res: Response): Promise<void> {
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
    const units = await orgService.getOrgUnits(req.companyId);
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
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }
    const data = createOrgUnitSchema.parse(req.body);
    const unit = await orgService.createOrgUnit(data, req.companyId);
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
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }
    
    // Log incoming request for debugging
    logger.debug({ 
      body: req.body,
      userId: req.user?.userId,
      companyId: req.companyId,
    }, 'Creating user/employee');
    
    const data = createEmployeeSchema.parse(req.body);
    const result = await orgService.createEmployee(data, req.user!.userId, req.companyId);
    res.status(201).json({ 
      data: result.employee || result.user, // Return employee if exists, otherwise return user
      credentials: result.credentials,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error({ 
        validationErrors: error.errors,
        body: req.body,
        formattedErrors: error.format(),
      }, 'Validation error when creating user/employee');
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }

    // Better error logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({ 
      error: errorMessage, 
      stack: errorStack,
      body: req.body,
      userId: req.user?.userId,
      companyId: req.companyId,
    }, 'Failed to create user/employee');
    
    res.status(400).json({
      error: {
        code: 'CREATE_FAILED',
        message: errorMessage || 'Failed to create user',
      },
    });
  }
}

export async function getEmployeeByUserIdController(req: Request, res: Response): Promise<void> {
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
    const employee = await orgService.getEmployeeByUserId(req.user!.userId, req.companyId);
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

export async function getAllEmployeesController(req: Request, res: Response): Promise<void> {
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
    const employees = await orgService.getAllEmployees(req.companyId);
    res.json({ data: employees });
  } catch (error) {
    logger.error({ error }, 'Failed to get all employees');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch employees',
      },
    });
  }
}

export async function getEmployeesGridController(req: Request, res: Response): Promise<void> {
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
    const search = req.query.search as string | undefined;
    const employees = await orgService.getEmployeesGrid(req.companyId, search);
    res.json({ data: employees });
  } catch (error) {
    logger.error({ error }, 'Failed to get employees grid');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch employees grid',
      },
    });
  }
}
